import { Router } from 'express';
import { handleClerkWebhook } from '../controllers/webhook.controller';

const router = Router();

// Important: Disable bodyParser for this route (Clerk sends raw body)
router.post('/clerk', handleClerkWebhook);

export default router;