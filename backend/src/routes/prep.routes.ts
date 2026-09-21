import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import {
  listSessions,
  getSession,
  createSession,
  answerQuestion,
  deleteSession,
  getStats,
} from '../controllers/prep.controller';

const router = Router();

router.use(requireAuth());

router.get('/stats', getStats);
router.get('/', listSessions);
router.post('/', createSession);
router.get('/:id', getSession);
router.post('/:id/questions/:questionId/answer', answerQuestion);
router.delete('/:id', deleteSession);

export default router;
