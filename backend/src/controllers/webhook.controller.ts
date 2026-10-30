import type { Request, Response } from 'express';
import { Webhook } from 'svix';
import { z } from 'zod';
import { requestDeletion } from '../platform/lifecycle';
import { User } from '../models/user.model';

const userEventSchema = z.object({
  type: z.string(),
  data: z.object({
    id: z.string().min(1),
    primary_email_address_id: z.string().nullable().optional(),
    email_addresses: z.array(z.object({ id: z.string(), email_address: z.string().email() })).optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    image_url: z.string().optional(),
    username: z.string().nullable().optional(),
  }),
});

export const handleClerkWebhook = async (req: Request, res: Response) => {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Webhook unavailable' });

  let verified: unknown;
  try {
    if (!Buffer.isBuffer(req.body)) throw new Error('Raw body required');
    verified = new Webhook(secret).verify(req.body.toString(), {
      'svix-id': req.get('svix-id') ?? '',
      'svix-timestamp': req.get('svix-timestamp') ?? '',
      'svix-signature': req.get('svix-signature') ?? '',
    });
  } catch {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const parsed = userEventSchema.safeParse(verified);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid webhook payload' });
  const { type, data } = parsed.data;
  try {
    if (type === 'user.created' || type === 'user.updated') {
      if (await User.exists({ clerkId: data.id, status: { $in: ['deleting', 'deleted'] } })) return res.json({ success: true });
      const email = data.email_addresses?.find(address => address.id === data.primary_email_address_id);
      if (!email) return res.status(422).json({ error: 'Primary email required' });
      await User.findOneAndUpdate({ clerkId: data.id }, {
        $set: { email: email.email_address, firstName: data.first_name,
          lastName: data.last_name, imageUrl: data.image_url, username: data.username,
          updatedAt: new Date() },
        // A retried identity webhook must not overwrite career preferences.
        $setOnInsert: { clerkId: data.id },
      }, { upsert: true, new: true, runValidators: true });
    } else if (type === 'user.deleted') {
      await requestDeletion(data.id);
    }
    return res.json({ success: true });
  } catch {
    // Let Clerk retry persistence failures; they are not signature failures.
    console.error('Clerk webhook persistence failed');
    return res.status(503).json({ error: 'Could not synchronize account. Retry later.' });
  }
};
