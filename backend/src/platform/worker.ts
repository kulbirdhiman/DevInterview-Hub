import { randomUUID } from 'node:crypto';
import { Task, Analysis, Interview, UsageBucket } from './models';
import { Resume } from '../models/resume.model';
import { User } from '../models/user.model';
import { MissingApiKeyError, structured } from './ai';
import { analysisOutput, analysisReport, answerOutput, evaluateAnswer, nextDifficulty, questionOutput, resumeEvidence, sessionReport, validateRefs, type Evaluation } from './rubrics';
import { renderPdf } from './pdf';
import { enqueue, purgeAccount } from './lifecycle';
import { QuotaError, settleKey } from './quota';
import type { ResumeContent } from '../schemas/resume.schema';

const instruction = 'Use observable evidence. Ratings 0=absent/incorrect, 1=major gaps, 2=adequate but incomplete, 3=strong with minor gaps, 4=clear, accurate and well-supported. Do not invent metrics or candidate experience. Omitted details are gaps, not proof of inability.';
export async function processTask(task: { _id: string; owner: string; type: string; resourceId: string; revision: number; attempts: number; adminRetries?: number; leaseToken?: string | null }) {
  if (task.type === 'delete_account') { await purgeAccount(task.owner); return; }
  if (await User.exists({ clerkId: task.owner, status: { $in: ['deleting', 'deleted'] } })) return;
  const attemptKey = `${task._id}:${task.adminRetries ?? 0}:${task.attempts}`;
  if (task.type === 'analysis') {
    const analysis = await Analysis.findOne({ _id: task.resourceId, owner: task.owner, state: 'pending' });
    if (!analysis) return;
    const snapshot = analysis.snapshot as ResumeContent, evidence = resumeEvidence(snapshot);
    const output = await structured(task.owner, 'resume_analysis', analysisOutput,
      `${instruction} Rate exactly four dimensions: content, impact, relevance, readability. Every rating, issue and strength must cite existing evidence IDs. Missing sections have missing: IDs. Provide severity and actionable suggestions, never fabricated before/after achievements. Quantified impact is helpful only when factual; qualitative outcomes are valid. Relevance is against the supplied target role.`,
      { role: snapshot.targetRole, evidence }, attemptKey);
    let pdfValid = false;
    try { await renderPdf(snapshot); pdfValid = true; } catch { /* Provisional formatting coverage, not a fabricated score. */ }
    const report = analysisReport(snapshot, output, evidence, pdfValid);
    // Tombstone recheck and state filter prevent late provider writes after deletion.
    if (await User.exists({ clerkId: task.owner, status: { $in: ['deleting', 'deleted'] } })) return;
    const committed = await Analysis.updateOne({ _id: analysis._id, owner: task.owner, state: 'pending' }, { $set: { report, state: 'completed' }, $unset: { snapshot: '' } });
    if (committed.modifiedCount) await settleKey(task.owner, 'analysis', analysis.operationKey, 'consumed');
    return;
  }
  const session = await Interview.findOne({ _id: task.resourceId, owner: task.owner, revision: task.revision, state: { $in: ['preparing', 'processing'] } });
  if (!session) return;
  const evidence = resumeEvidence(session.resumeSnapshot as ResumeContent).filter(item => !item.id.startsWith('missing:'));
  const evaluated = session.turns.flatMap(turn => turn.evaluation ? [turn.evaluation as Evaluation] : []);
  const difficulty = nextDifficulty(session.turns.at(-1)?.difficulty ?? session.difficulty!, evaluated);
  let next: import('zod').z.infer<typeof questionOutput> | null = null;
  let evaluation: Evaluation | undefined;
  const last = session.turns.at(-1);
  const followup = task.type === 'interview_answer' && last?.intent !== 'followup';
  if (last?.answeredAt) evidence.push({ id: `answer:${last._id}`, section: 'previous answer', text: (last.answer ?? '').slice(0, 4000) });
  const context = { role: session.role, category: session.category, difficulty, language: session.language, evidence,
    dimensions: Object.keys((await import('./rubrics')).interviewWeights[session.category!]),
    transcript: session.turns.map(turn => ({ id: String(turn._id), question: turn.prompt, answer: turn.answer, expectedEvidence: turn.expectedEvidence })),
    nextIntent: followup ? 'followup' : 'topic', remaining: session.maxQuestions - session.turns.length,
  };
  if (task.type === 'interview_start') {
    next = await structured(task.owner, 'interview_start', questionOutput,
      `${instruction} Introduce yourself briefly as a practice interviewer and ask one concise opening question grounded in an actual resume evidence ID for this category/role/difficulty/language. Do not claim affiliation with employers. expectedEvidence is a rubric outline, never an invented candidate answer.`, context, attemptKey);
  } else {
    const output = await structured(task.owner, 'interview_answer', answerOutput,
      `${instruction} Evaluate ONLY the last committed answer. Return each supplied dimension exactly once. Each assessed dimension needs an exact excerpt from that answer; use null for genuinely unassessable dimensions. Strengths/gaps and a better answer OUTLINE must reflect evidence, not invented candidate achievements. Provide study topics. Then propose ONE next question. If nextIntent is followup, refer directly to the actual last answer and cite its answer: ID. Otherwise cover a new resume topic. If no time/questions remain, nextQuestion may be null. Never grade appearance, accent, protected traits or inferred emotion.`, context, attemptKey);
    evaluation = evaluateAnswer(session.category!, last?.answer ?? '', output.evaluation);
    next = output.nextQuestion;
  }
  if (next) {
    validateRefs(next.sourceRefs, evidence);
    if (followup && !next.sourceRefs.includes(`answer:${last!._id}`)) throw new Error('Follow-up is not grounded in the previous answer');
  }
  // Read current flags again; end may have been requested during inference.
  const latest = await Interview.findOne({ _id: session._id, owner: task.owner, revision: task.revision });
  if (!latest || await User.exists({ clerkId: task.owner, status: { $in: ['deleting', 'deleted'] } })) return;
  if (evaluation) { const turn = latest.turns.id(last!._id); if (turn) turn.evaluation = evaluation; }
  const completed = latest.endRequested || (task.type === 'interview_answer' && (latest.turns.length >= latest.maxQuestions || latest.activeMs >= (latest.durationMinutes ?? 5) * 60000 || !next));
  if (!completed && next) latest.turns.push({ ...next, intent: followup ? 'followup' : 'topic', difficulty });
  const state = completed ? 'completed' : 'awaiting_answer';
  const report = completed ? sessionReport(latest.category!, latest.turns.map(turn => ({ answer: turn.answer, evaluation: turn.evaluation as Evaluation | undefined }))) : null;
  const committed = await Interview.updateOne({ _id: latest._id, owner: task.owner, revision: task.revision, state: { $in: ['preparing', 'processing'] } }, {
    $set: { turns: latest.turns, state, report, ...(completed ? { completedAt: new Date(), lastActiveAt: null } : { lastActiveAt: new Date() }) }, $inc: { revision: 1 },
  });
  if (committed.modifiedCount && task.type === 'interview_start') await settleKey(task.owner, 'interview', latest.operationKey, 'consumed');
}

async function failResource(task: { owner: string; type: string; resourceId: string; revision: number }, code: string) {
  if (task.type === 'analysis') {
    const report = await Analysis.findOneAndUpdate({ _id: task.resourceId, state: 'pending' }, { $set: { state: 'failed', errorCode: code } });
    if (report) await settleKey(task.owner, 'analysis', report.operationKey, 'released');
  } else if (task.type.startsWith('interview')) {
    const session = await Interview.findOneAndUpdate({ _id: task.resourceId, revision: task.revision, state: { $in: ['preparing', 'processing'] } }, { $set: { state: 'failed', errorCode: code } });
    if (session && task.type === 'interview_start') await settleKey(task.owner, 'interview', session.operationKey, 'released');
  }
}
export async function workerTick() {
  const exhausted = await Task.find({ status: 'running', leaseUntil: { $lt: new Date() }, attempts: { $gte: 2 } }).limit(10);
  for (const task of exhausted) {
    const changed = await Task.updateOne({ _id: task._id, status: 'running', leaseToken: task.leaseToken }, { $set: { status: 'failed', errorCode: 'WORKER_LEASE_EXPIRED', expiresAt: new Date(Date.now() + 7 * 86400000) } });
    if (changed.modifiedCount) await failResource(task, 'WORKER_LEASE_EXPIRED');
  }
  const token = randomUUID();
  const task = await Task.findOneAndUpdate({ attempts: { $lt: 2 }, $or: [{ status: 'pending' }, { status: 'running', leaseUntil: { $lt: new Date() } }] }, {
    $set: { status: 'running', leaseToken: token, leaseUntil: new Date(Date.now() + 120000) }, $inc: { attempts: 1 },
  }, { returnDocument: 'after', sort: { createdAt: 1 } });
  if (!task) return false;
  try {
    await processTask(task);
    await Task.updateOne({ _id: task._id, leaseToken: token, status: 'running' }, { $set: { status: 'completed', expiresAt: new Date(Date.now() + 7 * 86400000) } });
  } catch (error) {
    const final = task.attempts >= 2;
    const status = (error as { status?: number }).status;
    const code = error instanceof MissingApiKeyError ? 'AI_NOT_CONFIGURED' : error instanceof QuotaError ? 'QUOTA_EXCEEDED' : status === 401 || status === 403 ? 'PROVIDER_AUTH_FAILED' : status === 404 ? 'MODEL_UNAVAILABLE' : status === 429 ? 'PROVIDER_RATE_LIMIT' : 'PROCESSING_OR_EVIDENCE_FAILED';
    if (final) await failResource(task, code);
    await Task.updateOne({ _id: task._id, leaseToken: token, status: 'running' }, { $set: { status: final ? 'failed' : 'pending', errorCode: code, ...(final ? { expiresAt: new Date(Date.now() + 7 * 86400000) } : {}) } });
    console.log(JSON.stringify({ event: 'task_failure', taskId: task._id, type: task.type, attempt: task.attempts, code }));
  }
  return true;
}
export async function reconcile() {
  await Task.updateMany({ status: { $in: ['completed', 'failed', 'canceled'] }, expiresAt: { $exists: false } }, { $set: { expiresAt: new Date(Date.now() + 7 * 86400000) } });
  const analyses = await Analysis.find({ state: 'pending' }).limit(100);
  for (const analysis of analyses) await enqueue({ _id: analysis.taskId!, owner: analysis.owner, type: 'analysis', resourceId: String(analysis._id) });
  const sessions = await Interview.find({ state: { $in: ['preparing', 'processing'] } }).limit(100);
  for (const session of sessions) await enqueue({ _id: session.taskId!, owner: session.owner, type: session.state === 'preparing' ? 'interview_start' : 'interview_answer', resourceId: String(session._id), revision: session.revision });
  for (const account of await User.find({ status: 'deleting' }).limit(100)) {
    const { requestDeletion } = await import('./lifecycle'); await requestDeletion(account.clerkId);
  }
  const stale = await UsageBucket.find({ entries: { $elemMatch: { state: 'reserved', createdAt: { $lt: new Date(Date.now() - 600000) } } } }).limit(100);
  for (const bucket of stale) for (const entry of bucket.entries) {
    if (entry.state !== 'reserved' || !entry.createdAt || entry.createdAt.getTime() > Date.now() - 600000) continue;
    const key = entry.key!.slice(entry.metric!.length + 1);
    const resource = entry.metric === 'analysis' ? await Analysis.exists({ owner: bucket.owner, operationKey: key }) : entry.metric === 'interview' ? await Interview.exists({ owner: bucket.owner, operationKey: key }) : ['resumeSlots', 'resumeAI'].includes(entry.metric!) ? await Resume.exists({ clerkId: bucket.owner, creationOperation: key }) : null;
    if (!resource) await settleKey(bucket.owner, entry.metric as import('./quota').Metric, key, 'released');
  }
  await Promise.all([Analysis.deleteMany({ expiresAt: { $lt: new Date() } }), Interview.deleteMany({ expiresAt: { $lt: new Date() } })]);
}
export const workerState = { heartbeat: 0 };
export function startWorker() {
  workerState.heartbeat = Date.now();
  let busy = false, ticks = 0;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true; workerState.heartbeat = Date.now();
    try { if (ticks++ % 30 === 0) await reconcile(); await workerTick(); }
    catch { console.error(JSON.stringify({ event: 'worker_error', code: 'DEPENDENCY_UNAVAILABLE' })); }
    finally { busy = false; }
  }, 1000);
  timer.unref();
  return () => clearInterval(timer);
}
