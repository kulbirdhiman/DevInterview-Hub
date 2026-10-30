import { Router } from 'express';
import mongoose from 'mongoose';
import { workerState } from '../platform/worker';
const router = Router();
router.get('/', (_req, res) => res.json({ ok: true }));
router.get('/ready', (_req, res) => { const ready = mongoose.connection.readyState === 1 && workerState.heartbeat > 0 && Date.now() - workerState.heartbeat < 120000; res.status(ready ? 200 : 503).json({ ready }); });
export default router;
