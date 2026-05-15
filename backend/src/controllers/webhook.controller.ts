import { Request, Response } from 'express';
import { Webhook } from 'svix';
import { User } from '../models/user.model';

export const handleClerkWebhook = async (req: Request, res: Response) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;

  if (!WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  const svix = new Webhook(WEBHOOK_SECRET);
  const payload = JSON.stringify(req.body);
  const headers = req.headers as any;

  try {
    const evt = svix.verify(payload, {
      'svix-id': headers['svix-id'],
      'svix-timestamp': headers['svix-timestamp'],
      'svix-signature': headers['svix-signature'],
    }) as any;

    const { id, email_addresses, first_name, last_name, image_url, username } = evt.data;
    const eventType = evt.type;

    switch (eventType) {
      case 'user.created':
      case 'user.updated':
        await User.findOneAndUpdate(
          { clerkId: id },
          {
            clerkId: id,
            email: email_addresses[0]?.email_address,
            firstName: first_name,
            lastName: last_name,
            imageUrl: image_url,
            username,
            updatedAt: new Date(),
          },
          { upsert: true, new: true }
        );
        break;

      case 'user.deleted':
        await User.findOneAndDelete({ clerkId: id });
        break;

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Webhook verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }
};