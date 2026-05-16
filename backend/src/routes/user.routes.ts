import { Router } from 'express';
import {
  getCurrentUser,
  updateUserProfile,
} from '../controllers/user.controller';
import { requireAuth } from '@clerk/express';

const router = Router();

// Get Logged In User
router.get('/me', requireAuth(), getCurrentUser);

// Update Profile
router.put('/update-profile', requireAuth(), updateUserProfile);

export default router;