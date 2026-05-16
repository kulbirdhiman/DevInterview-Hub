import { Request, Response } from 'express';
import { Webhook } from 'svix';
import { User } from '../models/user.model';

export const handleClerkWebhook = async (req: Request, res: Response) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;

  if (!WEBHOOK_SECRET) {
    return res.status(500).json({
      error: 'Webhook secret not configured',
    });
  }

  try {
    const payload = req.body.toString();

    const headers = {
      'svix-id': req.headers['svix-id'] as string,
      'svix-timestamp': req.headers['svix-timestamp'] as string,
      'svix-signature': req.headers['svix-signature'] as string,
    };

    const wh = new Webhook(WEBHOOK_SECRET);

    const evt: any = wh.verify(payload, headers);

    const {
      id,
      email_addresses,
      first_name,
      last_name,
      image_url,
      username,
    } = evt.data;

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

        console.log('User synced');

        break;

      case 'user.deleted':
        await User.findOneAndDelete({
          clerkId: id,
        });

        console.log('User deleted');

        break;

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    return res.status(200).json({
      success: true,
    });
  } catch (err: any) {
    console.error('Webhook verification failed:', err.message);

    return res.status(400).json({
      error: 'Invalid webhook signature',
    });
  }
};