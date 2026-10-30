import { getAuth } from '@clerk/express';
import type { RequestHandler } from 'express';

// API clients need JSON 401 responses, not Clerk's browser sign-in redirects.
export const requireUser: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ success: false, message: 'Sign in to continue.' });
    return;
  }
  next();
};
