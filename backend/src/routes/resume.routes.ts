import { Router } from 'express';
import { requireUser } from '../middleware/user-auth';
import {
  listResumes,
  getResume,
  createResumeWithAI,
  updateResume,
  deleteResume,
} from '../controllers/resume.controller';

const router = Router();

router.use(requireUser);

router.get('/', listResumes);
router.post('/generate', createResumeWithAI);
router.get('/:id', getResume);
router.put('/:id', updateResume);
router.delete('/:id', deleteResume);

export default router;
