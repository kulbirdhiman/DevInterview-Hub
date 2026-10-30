import { getAuth } from '@clerk/express';
import type { Request, Response } from 'express';
import { User } from '../models/user.model';
import { ensureUser, UnverifiedEmailError } from '../services/user.service';
import { completeProfileSchema, onboardingSchema, profileDefaults, profileUpdateSchema } from '../schemas/profile.schema';

function profileError(error: unknown, res: Response) {
  if (error instanceof UnverifiedEmailError) {
    return res.status(403).json({ success: false, message: 'Verify your primary email address before continuing.' });
  }
  console.error('Profile operation failed');
  return res.status(503).json({ success: false, message: 'Could not load or save your profile. Please retry.' });
}

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const user = await ensureUser(getAuth(req).userId!);
    return res.json({ success: true, user });
  } catch (error) {
    return profileError(error, res);
  }
};

export const updateUserProfile = async (req: Request, res: Response) => {
  const patch = profileUpdateSchema.safeParse(req.body);
  if (!patch.success) {
    return res.status(422).json({ success: false, message: patch.error.issues[0].message, issues: patch.error.issues });
  }
  try {
    const user = await ensureUser(getAuth(req).userId!);
    const merged = { ...profileDefaults, ...Object.fromEntries(
      Object.keys(profileDefaults).map(key => [key, user.get(key) ?? profileDefaults[key as keyof typeof profileDefaults]])
    ), ...patch.data };
    const complete = req.path === '/onboarding/complete';
    const parsed = (complete ? onboardingSchema : completeProfileSchema).safeParse(merged);
    if (!parsed.success) {
      return res.status(422).json({ success: false, message: parsed.error.issues[0].message, issues: parsed.error.issues });
    }
    // Compare the document revision so two simultaneous updates cannot create
    // an invalid salary range or silently discard each other's profile edits.
    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id, clerkId: getAuth(req).userId, __v: user.__v },
      { $set: { ...parsed.data, updatedAt: new Date(),
        ...(complete && !user.onboardingCompletedAt ? { onboardingCompletedAt: new Date() } : {}) },
        $inc: { __v: 1 } },
      { new: true, runValidators: true }
    );
    if (!updatedUser) return res.status(409).json({ success: false, message: 'Your profile changed in another request. Reload before saving.' });
    return res.json({ success: true, user: updatedUser });
  } catch (error) {
    return profileError(error, res);
  }
};
