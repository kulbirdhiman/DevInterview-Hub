import { clerkClient } from '@clerk/express';
import { User } from '../models/user.model';

// The first authenticated request can arrive before user.created is delivered.
// Read identity from Clerk, never from fields supplied by the browser.
const loadIdentity = (id: string) => clerkClient.users.getUser(id);

export async function ensureUser(clerkId: string, readIdentity = loadIdentity) {
  const existing = await User.findOne({ clerkId });
  if (existing?.status === 'deleting' || existing?.status === 'deleted') throw Object.assign(new Error('Account unavailable'), { status: 403 });
  if (existing) return existing;

  const identity = await readIdentity(clerkId);
  const email = identity.emailAddresses.find(e => e.id === identity.primaryEmailAddressId);
  if (!email || email.verification?.status !== 'verified') {
    throw new UnverifiedEmailError();
  }
  try {
    return await User.findOneAndUpdate({ clerkId }, { $setOnInsert: {
      clerkId, email: email.emailAddress, firstName: identity.firstName,
      lastName: identity.lastName, imageUrl: identity.imageUrl,
      displayName: [identity.firstName, identity.lastName].filter(Boolean).join(' '),
    } }, { upsert: true, new: true, setDefaultsOnInsert: true }).orFail();
  } catch (error) {
    // Concurrent initial requests may both observe no local user.
    if ((error as { code?: number }).code === 11000) {
      return User.findOne({ clerkId }).orFail();
    }
    throw error;
  }
}

export class UnverifiedEmailError extends Error {}
