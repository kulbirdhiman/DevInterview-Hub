import { Router } from 'express';
import {
  getCurrentUser,
  updateUserProfile,
} from '../controllers/user.controller';
import { requireUser } from '../middleware/user-auth';

const router = Router();
router.use(requireUser);

// Get Logged In User
router.get('/me', getCurrentUser);

// Update Profile
router.put('/update-profile', updateUserProfile);
router.post('/onboarding/complete', updateUserProfile);

export default router;
