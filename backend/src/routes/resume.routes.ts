import { Router } from 'express';
import { requireUser } from '../middleware/user-auth';
import {
  listResumes,
  getResume,
  createResumeWithAI,
  updateResume,
  deleteResume,
  createResume,
  listVersions,
  saveVersion,
  restoreVersion,
} from '../controllers/resume.controller';

const router = Router();

router.use(requireUser);
for (const parameter of ['id', 'versionId']) {
  router.param(parameter, (_req, res, next, value) => {
    if (!/^[a-f\d]{24}$/i.test(value)) {
      res.status(400).json({ success: false, message: 'Invalid resume or version ID.' });
      return;
    }
    next();
  });
}

router.get('/', listResumes);
router.post('/', createResume);
router.post('/generate', createResumeWithAI);
router.get('/:id/versions', listVersions);
router.post('/:id/versions', saveVersion);
router.post('/:id/versions/:versionId/restore', restoreVersion);
router.get('/:id', getResume);
router.put('/:id', updateResume);
router.delete('/:id', deleteResume);

export default router;
