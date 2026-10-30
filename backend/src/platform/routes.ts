import { Router, type Request, type Response } from 'express';
import { getAuth } from '@clerk/express';
import mongoose, { type InferSchemaType } from 'mongoose';
import { z } from 'zod';
import { requireUser } from '../middleware/user-auth';
import { Resume } from '../models/resume.model';
import { User } from '../models/user.model';
import { PrepSession } from '../models/prep.model';
import { resumeSnapshot } from '../schemas/resume.schema';
import { Analysis, Interview, Task, Audit, AiUsage, UsageBucket } from './models';
import { activeAccount, adminOnly, requestMetrics } from './observability';
import { isAIConfigured } from './ai';
import { reserve, settle, settleKey, usage } from './quota';
import { enqueue, expiration, requestDeletion, taskKey, assertActiveOwner } from './lifecycle';
import { categories, levels, resumeEvidence, sessionReport, type Evaluation } from './rubrics';
import { workerState } from './worker';
import { renderPdf } from './pdf';

const router = Router();
router.use(requireUser, activeAccount);
const owner = (req: Request) => getAuth(req).userId!;
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const revision = z.number().int().min(0);
const operationKey = (req: Request) => validated(z.string().uuid(), req.get('Idempotency-Key'));
function validated<T>(schema: z.ZodType<T>, input: unknown): T { const result = schema.safeParse(input); if (!result.success) throw Object.assign(new Error(result.error.issues[0].message), { status: 422 }); return result.data; }
function absent(res: Response) { return res.status(404).json({ message: 'Resource not found.' }); }
function stale(res: Response) { return res.status(409).json({ message: 'This resource changed. Reload before retrying.' }); }
function requireAI() { if (!isAIConfigured()) throw Object.assign(new Error('AI is not configured. Editing and PDF export remain available.'), { status: 422 }); }
export function publicInterview(session: InferSchemaType<typeof Interview.schema>) {
  const { resumeSnapshot: snapshot, ...visible } = session;
  return { ...visible, evidence: [...resumeEvidence(snapshot), ...session.turns.filter(turn => turn.answeredAt).map(turn => ({ id: `answer:${turn._id}`, section: 'previous answer', text: (turn.answer ?? '').slice(0, 4000) }))], turns: session.turns.map((turn) => {
    const { expectedEvidence, ...row } = turn;
    return turn.evaluation ? { ...row, expectedEvidence } : row;
  }) };
}

router.post('/resumes/:id/pdf', async (req, res) => {
  const input = validated(z.object({ expectedRevision: revision, pageSize: z.enum(['A4', 'LETTER']).default('A4'), versionId: objectId.optional() }).strict(), req.body);
  const id = validated(objectId, req.params.id), key = operationKey(req);
  const resume = await Resume.findOne({ _id: id, clerkId: owner(req) }).select('+versions');
  if (!resume) return absent(res);
  if (!input.versionId && (resume.revision ?? 0) !== input.expectedRevision) return stale(res);
  const snapshot = input.versionId ? resume.versions.id(input.versionId)?.snapshot : resumeSnapshot(resume.toObject());
  if (!snapshot) return absent(res);
  const reservation = await reserve(owner(req), 'pdf', key);
  if (!reservation.fresh) return res.status(409).json({ message: 'This download was already requested. Start a new download.' });
  try {
    const buffer = await renderPdf(snapshot, input.pageSize);
    await settle(reservation, 'consumed');
    const name = snapshot.title.replace(/[^a-z\d_-]/gi, '_').slice(0, 80) || 'resume';
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${name}.pdf"`);
    res.setHeader('X-Resume-Revision', resume.revision ?? 0); res.send(buffer);
  } catch (error) { await settle(reservation, 'released'); throw error; }
});

router.post('/resumes/:id/analyses', async (req, res) => {
  requireAI();
  const input = validated(z.object({ expectedRevision: revision }).strict(), req.body);
  const id = validated(objectId, req.params.id), key = operationKey(req), userId = owner(req);
  const existing = await Analysis.findOne({ owner: userId, operationKey: key }).select('-snapshot');
  if (existing) return res.json({ analysis: existing });
  const resume = await Resume.findOne({ _id: id, clerkId: userId });
  if (!resume) return absent(res);
  if ((resume.revision ?? 0) !== input.expectedRevision) return stale(res);
  const reservation = await reserve(userId, 'analysis', key);
  if (!reservation.fresh) return stale(res);
  const report = await Analysis.create({ owner: userId, resumeId: id, revision: input.expectedRevision, operationKey: key,
    taskId: taskKey(userId, 'analysis', key), snapshot: resumeSnapshot(resume.toObject()), expiresAt: await expiration(userId) });
  await assertActiveOwner(userId, () => Analysis.deleteOne({ _id: report._id }));
  await enqueue({ _id: report.taskId!, owner: userId, type: 'analysis', resourceId: String(report._id) });
  res.status(202).json({ analysis: { _id: report._id, state: report.state, taskId: report.taskId } });
});
router.get('/resumes/:id/analyses', async (req, res) => {
  const id = validated(objectId, req.params.id);
  if (!await Resume.exists({ _id: id, clerkId: owner(req) })) return absent(res);
  res.json({ analyses: await Analysis.find({ owner: owner(req), resumeId: id }).select('-snapshot').sort({ createdAt: -1 }).limit(20) });
});
router.get('/analyses/:id', async (req, res) => {
  const id = validated(objectId, req.params.id);
  const analysis = await Analysis.findOne({ _id: id, owner: owner(req) }).select('-snapshot');
  return analysis ? res.json({ analysis }) : absent(res);
});

router.post('/interviews', async (req, res) => {
  requireAI();
  const input = validated(z.object({ resumeId: objectId, expectedRevision: revision, role: z.string().trim().min(1).max(120), category: z.enum(categories), difficulty: z.enum(levels), language: z.enum(['English', 'Hindi']).default('English'), durationMinutes: z.union([z.literal(5), z.literal(15)]).default(5) }).strict(), req.body);
  const userId = owner(req), key = operationKey(req);
  const existing = await Interview.findOne({ owner: userId, operationKey: key });
  if (existing) return res.json({ session: publicInterview(existing.toObject()) });
  const resume = await Resume.findOne({ _id: input.resumeId, clerkId: userId });
  if (!resume) return absent(res);
  if ((resume.revision ?? 0) !== input.expectedRevision) return stale(res);
  const snapshot = resumeSnapshot(resume.toObject());
  if (!resumeEvidence(snapshot).some(item => ['summary', 'experience', 'projects', 'skills', 'education'].includes(item.section) && !item.id.startsWith('missing:'))) return res.status(422).json({ message: 'Add skills, education, a summary or work/project details before starting an interview.' });
  const reservation = await reserve(userId, 'interview', key);
  if (!reservation.fresh) return stale(res);
  const session = await Interview.create({ ...input, owner: userId, operationKey: key, resumeRevision: input.expectedRevision, resumeSnapshot: snapshot,
    taskId: taskKey(userId, 'interview', key), expiresAt: await expiration(userId) });
  await assertActiveOwner(userId, () => Interview.deleteOne({ _id: session._id }));
  await enqueue({ _id: session.taskId!, owner: userId, type: 'interview_start', resourceId: String(session._id), revision: 0 });
  res.status(202).json({ session: publicInterview(session.toObject()) });
});
router.get('/interviews', async (req, res) => {
  const sessions = await Interview.find({ owner: owner(req) }).select('-resumeSnapshot -turns.expectedEvidence').sort({ createdAt: -1 }).limit(100);
  res.json({ sessions });
});
router.get('/interviews/:id', async (req, res) => {
  const session = await Interview.findOne({ _id: validated(objectId, req.params.id), owner: owner(req) });
  return session ? res.json({ session: publicInterview(session.toObject()) }) : absent(res);
});
router.post('/interviews/:id/answers', async (req, res) => {
  const input = validated(z.object({ expectedRevision: revision, questionId: objectId, submissionKey: z.string().uuid(), answer: z.string().max(5000) }).strict(), req.body);
  const userId = owner(req), id = validated(objectId, req.params.id);
  const session = await Interview.findOne({ _id: id, owner: userId });
  if (!session) return absent(res);
  if (session.turns.some(turn => turn.submissionKey === input.submissionKey)) return res.json({ session: publicInterview(session.toObject()) });
  const last = session.turns.at(-1);
  if (session.state !== 'awaiting_answer' || session.revision !== input.expectedRevision || String(last?._id) !== input.questionId) return stale(res);
  const activeMs = session.activeMs + (session.lastActiveAt ? Math.max(0, Date.now() - session.lastActiveAt.getTime()) : 0);
  const taskId = taskKey(id, input.questionId, input.submissionKey);
  const changed = await Interview.findOneAndUpdate({ _id: id, owner: userId, revision: input.expectedRevision, state: 'awaiting_answer', 'turns._id': input.questionId }, {
    $set: { 'turns.$.answer': input.answer, 'turns.$.answeredAt': new Date(), 'turns.$.submissionKey': input.submissionKey, state: 'processing', taskId, activeMs, lastActiveAt: null }, $inc: { revision: 1 },
  }, { returnDocument: 'after' });
  if (!changed) {
    const replay = await Interview.findOne({ _id: id, owner: userId, 'turns.submissionKey': input.submissionKey });
    return replay ? res.json({ session: publicInterview(replay.toObject()) }) : stale(res);
  }
  await enqueue({ _id: taskId, owner: userId, type: 'interview_answer', resourceId: id, revision: changed.revision });
  res.status(202).json({ session: publicInterview(changed.toObject()) });
});
router.post('/interviews/:id/:action', async (req, res, next) => {
  if (!['pause', 'resume', 'end'].includes(req.params.action as string)) return next();
  const input = validated(z.object({ expectedRevision: revision }).strict(), req.body), userId = owner(req);
  const session = await Interview.findOne({ _id: validated(objectId, req.params.id), owner: userId });
  if (!session) return absent(res);
  if (session.state === 'completed' && req.params.action === 'end') return res.json({ session: publicInterview(session.toObject()) });
  if (session.revision !== input.expectedRevision) return stale(res);
  const action = req.params.action;
  if (action === 'end' && session.state === 'processing') {
    const changed = await Interview.findOneAndUpdate({ _id: session._id, owner: userId, revision: session.revision, state: 'processing' }, { $set: { endRequested: true } }, { returnDocument: 'after' });
    return changed ? res.json({ session: publicInterview(changed.toObject()) }) : stale(res);
  }
  if (action === 'pause' && session.state !== 'awaiting_answer' || action === 'resume' && session.state !== 'paused') return stale(res);
  const activeMs = session.activeMs + (session.lastActiveAt ? Math.max(0, Date.now() - session.lastActiveAt.getTime()) : 0);
  const state = action === 'pause' ? 'paused' : action === 'resume' ? 'awaiting_answer' : 'completed';
  const changed = await Interview.findOneAndUpdate({ _id: session._id, owner: userId, revision: session.revision, state: session.state }, {
    $set: { state, activeMs, lastActiveAt: action === 'resume' ? new Date() : null,
      ...(state === 'completed' ? { completedAt: new Date(), report: sessionReport(session.category!, session.turns.map(turn => ({ answer: turn.answer, evaluation: turn.evaluation as Evaluation | undefined }))) } : {}) }, $inc: { revision: 1 },
  }, { returnDocument: 'after' });
  if (changed && state === 'completed' && session.state === 'preparing') await settleKey(userId, 'interview', session.operationKey, 'released');
  if (changed && state === 'completed' && session.state === 'preparing') await Task.updateOne({ _id: session.taskId, status: { $in: ['pending', 'running'] } }, { $set: { status: 'canceled' } });
  return changed ? res.json({ session: publicInterview(changed.toObject()) }) : stale(res);
});
router.delete('/interviews/:id', async (req, res) => {
  const id = validated(objectId, req.params.id), userId = owner(req);
  const deleted = await Interview.findOneAndDelete({ _id: id, owner: userId });
  if (!deleted) return absent(res);
  await Task.deleteMany({ owner: userId, resourceId: id });
  res.json({ success: true });
});

router.get('/dashboard', async (req, res) => {
  const userId = owner(req);
  const [resumeCount, sessions, analysis, legacyCount] = await Promise.all([Resume.countDocuments({ clerkId: userId }), Interview.find({ owner: userId }).select('-resumeSnapshot'), Analysis.findOne({ owner: userId, state: 'completed' }).sort({ createdAt: -1 }), PrepSession.countDocuments({ clerkId: userId })]);
  const completed = sessions.filter(session => session.state === 'completed');
  const scored = completed.filter(session => typeof session.report?.score === 'number');
  const series = scored.map(session => ({ id: session._id, date: session.completedAt, score: session.report.score as number, category: session.category, rubricVersion: session.report.rubricVersion as string })).sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
  const resume = analysis ? await Resume.findOne({ _id: analysis.resumeId, clerkId: userId }).select('revision') : null;
  res.json({ stats: { resumeCount, completedInterviews: completed.length, answeredQuestions: sessions.reduce((sum, session) => sum + session.turns.filter(turn => turn.evaluation).length, 0), averageScore: scored.length ? Math.round(scored.reduce((sum, session) => sum + session.report.score, 0) / scored.length) : null,
    latestResumeScore: analysis?.report?.score ?? null, latestResumeStale: Boolean(analysis && (resume?.revision ?? 0) !== analysis.revision), legacySessionCount: legacyCount, series } });
});
router.get('/usage', async (req, res) => {
  const rows = await usage(owner(req));
  const count = await Resume.countDocuments({ clerkId: owner(req) });
  res.json({ plan: 'Free beta', limits: rows.map(row => row.metric === 'resumeSlots' ? { ...row, used: Math.max(row.used, count) } : row), resets: 'Monthly operations reset on the first day of the month (UTC). Active resume slots are released on deletion.' });
});
router.get('/account/preferences', async (req, res) => { const user = await User.findOne({ clerkId: owner(req) }); res.json({ retentionDays: user?.retentionDays ?? 90 }); });
router.put('/account/preferences', async (req, res) => {
  const input = validated(z.object({ retentionDays: z.union([z.literal(30), z.literal(90), z.literal(180)]) }).strict(), req.body);
  const userId = owner(req);
  await User.updateOne({ clerkId: userId }, { $set: input });
  for (const collection of [Analysis.collection, Interview.collection]) await collection.updateMany({ owner: userId }, [{ $set: { expiresAt: { $add: ['$createdAt', input.retentionDays * 86400000] } } }]);
  res.json({ ...input, message: 'Retention updated. Expired analyses and interviews are removed by the next cleanup sweep.' });
});
router.post('/account/export', async (req, res) => {
  const reservation = await reserve(owner(req), 'dataExport', operationKey(req));
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Content-Disposition', 'attachment; filename="career-data.json"');
  const write = async (chunk: string) => {
    if (res.destroyed) throw new Error('Download canceled');
    if (!res.write(chunk)) await new Promise<void>((resolve, reject) => {
      const drain = () => { res.off('close', close); resolve(); };
      const close = () => { res.off('drain', drain); reject(new Error('Download canceled')); };
      res.once('drain', drain); res.once('close', close);
    });
  };
  try {
    await write('{"schemaVersion":1,"exportedAt":' + JSON.stringify(new Date().toISOString()));
    for (const [name, collection, query] of [
      ['profile', User, { clerkId: owner(req) }], ['resumes', Resume, { clerkId: owner(req) }],
      ['legacyPractice', PrepSession, { clerkId: owner(req) }], ['interviews', Interview, { owner: owner(req) }],
      ['analyses', Analysis, { owner: owner(req) }], ['usage', UsageBucket, { owner: owner(req) }], ['aiUsage', AiUsage, { owner: owner(req) }], ['tasks', Task, { owner: owner(req) }], ['audit', Audit, { actor: owner(req) }],
    ] as const) {
      await write(`,${JSON.stringify(name)}:[`); let first = true;
      const cursor = collection.collection.find(query);
      for await (const row of cursor) { if (!first) await write(','); await write(JSON.stringify(row)); first = false; }
      await write(']');
    }
    res.end('}'); await settle(reservation, 'consumed');
  } catch (error) { await settle(reservation, 'released'); throw error; }
});
router.post('/account/deletion', async (req, res) => {
  validated(z.object({ confirmation: z.literal('DELETE') }).strict(), req.body);
  const taskId = await requestDeletion(owner(req)); res.status(202).json({ taskId, message: 'Account access disabled. App data and Clerk identity deletion have been queued.' });
});

router.get('/capabilities', async (req, res) => {
  const allowed = (process.env.ADMIN_CLERK_IDS ?? '').split(',').map(value => value.trim());
  res.json({ admin: allowed.includes(owner(req)) || Boolean(await User.exists({ clerkId: owner(req), role: 'admin' })) });
});
router.get('/ops', adminOnly, async (_req, res) => {
  const [tasks, usageRows, recent] = await Promise.all([
    Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    AiUsage.aggregate([{ $group: { _id: '$model', calls: { $sum: 1 }, inputTokens: { $sum: '$inputTokens' }, outputTokens: { $sum: '$outputTokens' }, configuredCostUsd: { $sum: '$costUsd' }, unpricedCalls: { $sum: { $cond: [{ $eq: ['$costUsd', null] }, 1, 0] } } } }]),
    Task.find({ status: 'failed' }).select('-owner').sort({ updatedAt: -1 }).limit(30),
  ]);
  const durations = [...requestMetrics.durations].sort((a, b) => a - b);
  res.json({ databaseReady: mongoose.connection.readyState === 1, workerHeartbeatSeconds: workerState.heartbeat ? Math.round((Date.now() - workerState.heartbeat) / 1000) : null, aiConfigured: isAIConfigured(), uptimeSeconds: Math.round(process.uptime()), requests: requestMetrics.requests, serverErrors: requestMetrics.failures, p95Ms: durations[Math.floor(durations.length * 0.95)] ?? null, tasks, models: usageRows, failedTasks: recent, note: 'Configured token-price estimates exclude provider taxes/cache charges. Unpriced calls are shown explicitly. Request metrics reset on process restart.' });
});
router.post('/ops/tasks/:id/retry', adminOnly, async (req, res) => {
  const id = validated(z.string().regex(/^[a-f\d]{64}$/), req.params.id);
  const task = await Task.findOne({ _id: id, status: 'failed', adminRetries: { $lt: 2 } });
  if (!task) return stale(res);
  if (task.type === 'analysis') await Analysis.updateOne({ _id: task.resourceId, state: 'failed' }, { $set: { state: 'pending' } });
  else if (task.type.startsWith('interview')) await Interview.updateOne({ _id: task.resourceId, state: 'failed', revision: task.revision }, { $set: { state: task.type === 'interview_start' ? 'preparing' : 'processing' } });
  const changed = await Task.updateOne({ _id: id, status: 'failed', adminRetries: task.adminRetries }, { $set: { status: 'pending', attempts: 0 }, $inc: { adminRetries: 1 }, $unset: { expiresAt: '' } });
  if (!changed.modifiedCount) return stale(res);
  await Audit.create({ actor: owner(req), action: 'task_retry', resourceId: id });
  res.json({ success: true });
});
export default router;
