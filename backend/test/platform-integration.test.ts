import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import mongoose from 'mongoose';
import routes from '../src/platform/routes';
import resumeRoutes from '../src/routes/resume.routes';
import { errors } from '../src/platform/observability';
import { setAIProviderForTests, type StructuredProvider } from '../src/platform/ai';
import { workerTick, reconcile } from '../src/platform/worker';
import { Analysis, Interview, Task, UsageBucket, AiUsage } from '../src/platform/models';
import { User } from '../src/models/user.model';
import { Resume } from '../src/models/resume.model';
import { reserve, settle, QuotaError } from '../src/platform/quota';
import { setIdentityDeleterForTests, purgeAccount } from '../src/platform/lifecycle';

const provider: StructuredProvider = { async generate(input) {
  const context = input.context as any;
  let data: unknown;
  if (input.operation === 'resume_analysis') data = { dimensions: ['content', 'impact', 'relevance', 'readability'].map(key => ({ key, rating: 3, reason: 'Supported career evidence.', evidenceRefs: [context.evidence[0].id] })), issues: [{ title: 'Explain an outcome', detail: 'The outcome could be more specific.', severity: 'moderate', evidenceRefs: [context.evidence[0].id], suggestion: 'Describe a genuine observed outcome without inventing numbers.' }], strengths: [{ title: 'Relevant experience', detail: 'Explicit resume evidence.', evidenceRefs: [context.evidence[0].id] }] };
  else {
    const last = context.transcript.at(-1);
    const question = { prompt: context.nextIntent === 'followup' ? `You said “${last.answer.slice(0, 30)}”. Which tradeoff mattered most?` : 'Describe an implementation decision from your resume and explain its tradeoffs.', sourceRefs: [context.nextIntent === 'followup' ? `answer:${last.id}` : context.evidence[0].id], expectedEvidence: ['Actual decision', 'Tradeoffs and reasoning'] };
    if (input.operation === 'interview_start') data = question;
    else data = { evaluation: { dimensions: context.dimensions.map((key: string) => ({ key, rating: last.answer.trim() ? 3 : 0, reason: 'Assessment based on the exact excerpt.', excerpts: last.answer.trim() ? [last.answer.slice(0, 40)] : [] })), strengths: ['Concrete explanation'], gaps: ['Clarify an observed outcome'], betterAnswerOutline: ['Explain the decision, alternatives and actual outcome.'], studyTopics: ['Decision tradeoffs'] }, nextQuestion: context.remaining ? question : null };
  }
  return { data, provider: 'offline-fixture', model: 'fixture-v1', inputTokens: 100, outputTokens: 100 };
} };

test('Phase 1 integration: quotas, durable adaptive turns, evidence reports, privacy and ops authorization', { skip: !process.env.TEST_MONGODB_URI }, async () => {
  await mongoose.connect(process.env.TEST_MONGODB_URI!, { dbName: `devinterview_phase1_test_${randomUUID().replaceAll('-', '')}` });
  await Promise.all([Task.init(), Analysis.init(), Interview.init(), User.init(), Resume.init()]);
  setAIProviderForTests(provider); setIdentityDeleterForTests(async () => ({}));
  const app = express(); app.use(express.json({ limit: '128kb' }));
  app.use((req, _res, next) => { Object.defineProperty(req, 'auth', { value: () => ({ userId: req.get('x-test-user') ?? null, tokenType: 'session_token', sessionId: 'test' }) }); next(); });
  app.use('/api/resumes', resumeRoutes); app.use('/api', routes); app.use(errors);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  async function call(path: string, method = 'GET', body?: unknown, user = 'candidate-a', key = randomUUID()) {
    const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-test-user': user, 'Idempotency-Key': key }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.headers.get('content-type')?.includes('application/pdf')) return { status: response.status, data: Buffer.from(await response.arrayBuffer()) as any };
    return { status: response.status, data: await response.json() as any };
  }
  try {
    await User.create({ clerkId: 'candidate-a', email: 'asha@example.com' });
    await User.create({ clerkId: 'admin', email: 'admin@example.com', role: 'admin' });
    const created = await call('/resumes', 'POST', { fullName: 'Asha Rao', contact: { email: 'asha@example.com' }, targetRole: 'Developer', summary: 'Built internal tools and documented deployment tradeoffs.', skills: ['TypeScript'] });
    assert.equal(created.status, 201); const resumeId = created.data.resume._id;
    assert.equal((await call('/resumes', 'POST', {})).status, 429);
    const quotas = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => reserve('quota-race', 'analysis', `key-${i}`)));
    assert.equal(quotas.filter(result => result.status === 'fulfilled').length, 3);
    assert.ok(quotas.filter(result => result.status === 'rejected').every(result => result.reason instanceof QuotaError));
    const duplicate = await reserve('idempotent-user', 'analysis', 'same'); await settle(duplicate, 'consumed');
    assert.equal((await reserve('idempotent-user', 'analysis', 'same')).fresh, false);
    const pdf = await call(`/resumes/${resumeId}/pdf`, 'POST', { expectedRevision: 0 });
    assert.equal(pdf.status, 200); assert.equal(pdf.data.subarray(0, 5).toString(), '%PDF-');
    assert.equal((await call(`/resumes/${resumeId}/pdf`, 'POST', { expectedRevision: 0 }, 'other')).status, 404);
    const keyAnalysis = randomUUID();
    const analysis = await call(`/resumes/${resumeId}/analyses`, 'POST', { expectedRevision: 0 }, 'candidate-a', keyAnalysis);
    assert.equal(analysis.status, 202);
    assert.equal((await call(`/resumes/${resumeId}/analyses`, 'POST', { expectedRevision: 0 }, 'candidate-a', keyAnalysis)).data.analysis._id, analysis.data.analysis._id);
    // Simulate queue dispatch loss; the DB reconciliation recreates the task.
    await Task.deleteMany({ resourceId: analysis.data.analysis._id }); await reconcile(); await workerTick();
    const analyzed = await call(`/analyses/${analysis.data.analysis._id}`);
    assert.equal(analyzed.data.analysis.state, 'completed'); assert.equal(analyzed.data.analysis.report.coverage, 100);
    assert.equal(analyzed.data.analysis.snapshot, undefined);
    assert.equal((await call(`/analyses/${analysis.data.analysis._id}`, 'GET', undefined, 'other')).status, 404);
    const start = await call('/interviews', 'POST', { resumeId, expectedRevision: 0, role: 'Developer', category: 'technical', difficulty: 'expert', language: 'English', durationMinutes: 15 });
    assert.equal(start.status, 202); const sessionId = start.data.session._id;
    await workerTick();
    let session = (await call(`/interviews/${sessionId}`)).data.session;
    assert.equal(session.state, 'awaiting_answer'); assert.equal(session.turns[0].expectedEvidence, undefined);
    let paused = await call(`/interviews/${sessionId}/pause`, 'POST', { expectedRevision: session.revision });
    assert.equal(paused.data.session.state, 'paused');
    session = (await call(`/interviews/${sessionId}/resume`, 'POST', { expectedRevision: paused.data.session.revision })).data.session;
    for (let i = 0; i < 3; i++) {
      const answer = `I built the internal TypeScript tool, compared alternatives, and documented the tradeoffs for the team. Answer ${i}.`;
      const submissionKey = randomUUID(), turn = session.turns.at(-1);
      const submitted = await call(`/interviews/${sessionId}/answers`, 'POST', { expectedRevision: session.revision, questionId: turn._id, submissionKey, answer });
      assert.equal(submitted.status, 202);
      const replay = await call(`/interviews/${sessionId}/answers`, 'POST', { expectedRevision: session.revision, questionId: turn._id, submissionKey, answer });
      assert.equal(replay.status, 200);
      await workerTick(); session = (await call(`/interviews/${sessionId}`)).data.session;
      assert.equal(session.turns[i].evaluation.score, 75);
      assert.ok(session.turns[i].evaluation.dimensions.every((row: any) => answer.includes(row.excerpts[0])));
      if (i === 0) { assert.equal(session.turns.at(-1).intent, 'followup'); assert.ok(session.turns.at(-1).sourceRefs.includes(`answer:${turn._id}`)); }
    }
    const ended = await call(`/interviews/${sessionId}/end`, 'POST', { expectedRevision: session.revision });
    assert.equal(ended.data.session.state, 'completed'); assert.equal(ended.data.session.report.score, 75);
    assert.equal((await call(`/interviews/${sessionId}/answers`, 'POST', { expectedRevision: ended.data.session.revision, questionId: ended.data.session.turns.at(-1)._id, submissionKey: randomUUID(), answer: 'Too late' })).status, 409);
    const dashboard = await call('/dashboard'); assert.equal(dashboard.data.stats.completedInterviews, 1); assert.equal(dashboard.data.stats.series.length, 1);
    assert.equal((await call('/ops')).status, 403); assert.equal((await call('/ops', 'GET', undefined, 'admin')).status, 200);
    const checkpoint = await call(`/resumes/${resumeId}/versions`, 'POST', { expectedRevision: 0, label: 'Before tailoring' });
    assert.equal(checkpoint.status, 201);
    const history = await call(`/resumes/${resumeId}/versions`);
    assert.equal((await call(`/resumes/${resumeId}/pdf`, 'POST', { expectedRevision: 1, versionId: history.data.versions[0]._id, pageSize: 'LETTER' })).status, 200);
    const exported = await call('/account/export', 'POST', {}); assert.equal(exported.status, 200); assert.equal(exported.data.resumes[0].fullName, 'Asha Rao'); assert.equal(exported.data.interviews.length, 1); assert.equal(exported.data.resumes[0].versions[0].snapshot.fullName, 'Asha Rao');
    assert.equal((await call('/account/preferences', 'PUT', { retentionDays: 30 })).status, 200);
    await Analysis.updateOne({ _id: analysis.data.analysis._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await reconcile();
    assert.equal(await Analysis.countDocuments({ _id: analysis.data.analysis._id }), 0);
    assert.equal(await Resume.countDocuments({ _id: resumeId }), 1);
    // Bounded failure preserves the session; a privileged retry can recover it.
    await User.create({ clerkId: 'retry-owner', email: 'retry@example.com' });
    const retryResume = await call('/resumes', 'POST', { fullName: 'Retry candidate', summary: 'Built and tested a real project.' }, 'retry-owner');
    const retrySession = await call('/interviews', 'POST', { resumeId: retryResume.data.resume._id, expectedRevision: 0, role: 'Developer', category: 'hr', difficulty: 'beginner', language: 'English', durationMinutes: 5 }, 'retry-owner');
    setAIProviderForTests({ async generate() { throw new Error('offline provider outage'); } });
    await workerTick(); await workerTick();
    const failedSession = (await call(`/interviews/${retrySession.data.session._id}`, 'GET', undefined, 'retry-owner')).data.session;
    assert.equal(failedSession.state, 'failed');
    const failedTask = await Task.findOne({ resourceId: failedSession._id, status: 'failed' });
    assert.ok(failedTask);
    setAIProviderForTests(provider);
    assert.equal((await call(`/ops/tasks/${failedTask!._id}/retry`, 'POST', {}, 'admin')).status, 200);
    await workerTick();
    let recovered = (await call(`/interviews/${failedSession._id}`, 'GET', undefined, 'retry-owner')).data.session;
    assert.equal(recovered.state, 'awaiting_answer');
    const submitted = await call(`/interviews/${recovered._id}/answers`, 'POST', { expectedRevision: recovered.revision, questionId: recovered.turns[0]._id, submissionKey: randomUUID(), answer: 'I built a real tool and documented the reasoning for the team.' }, 'retry-owner');
    recovered = submitted.data.session;
    assert.equal((await call(`/interviews/${recovered._id}/end`, 'POST', { expectedRevision: recovered.revision }, 'retry-owner')).data.session.endRequested, true);
    await workerTick();
    recovered = (await call(`/interviews/${recovered._id}`, 'GET', undefined, 'retry-owner')).data.session;
    assert.equal(recovered.state, 'completed'); assert.equal(recovered.turns.length, 1); assert.equal(recovered.report.score, null);
    // A provider result arriving after a completed account purge must not
    // recreate resume content, task data, quota buckets or identifiable usage.
    await User.create({ clerkId: 'late-owner', email: 'late@example.com' });
    const lateResume = await call('/resumes', 'POST', { fullName: 'Late candidate', summary: 'A real project description.', skills: ['TypeScript'] }, 'late-owner');
    const lateAnalysis = await call(`/resumes/${lateResume.data.resume._id}/analyses`, 'POST', { expectedRevision: 0 }, 'late-owner');
    assert.equal(lateAnalysis.status, 202);
    let releaseProvider!: () => void, notifyStarted!: () => void;
    const gate = new Promise<void>(resolve => { releaseProvider = resolve; });
    const started = new Promise<void>(resolve => { notifyStarted = resolve; });
    setAIProviderForTests({ async generate(input) { notifyStarted(); await gate; return provider.generate(input); } });
    const inFlight = workerTick(); await started;
    assert.equal((await call('/account/deletion', 'POST', { confirmation: 'DELETE' }, 'late-owner')).status, 202);
    await purgeAccount('late-owner'); releaseProvider(); await inFlight;
    setAIProviderForTests(provider);
    assert.equal(await Analysis.countDocuments({ owner: 'late-owner' }), 0);
    assert.equal(await Resume.countDocuments({ clerkId: 'late-owner' }), 0);
    assert.equal(await AiUsage.countDocuments({ owner: 'late-owner' }), 0);
    assert.equal(await UsageBucket.countDocuments({ owner: 'late-owner' }), 0);
    await workerTick();
    const deletion = await call('/account/deletion', 'POST', { confirmation: 'DELETE' }); assert.equal(deletion.status, 202);
    assert.equal((await call('/interviews')).status, 403);
    await workerTick();
    assert.equal(await Resume.countDocuments({ clerkId: 'candidate-a' }), 0);
    assert.equal(await Interview.countDocuments({ owner: 'candidate-a' }), 0);
    assert.equal(await Analysis.countDocuments({ owner: 'candidate-a' }), 0);
    assert.equal(await UsageBucket.countDocuments({ owner: 'candidate-a' }), 0);
    assert.equal(await AiUsage.countDocuments({ owner: 'candidate-a' }), 0);
    assert.equal((await User.findOne({ clerkId: 'candidate-a' }))!.status, 'deleted');
    assert.equal((await call('/account/preferences')).status, 403);
  } finally {
    setAIProviderForTests(null); setIdentityDeleterForTests(null);
    await new Promise<void>(resolve => server.close(() => resolve()));
    await mongoose.connection.db!.dropDatabase(); await mongoose.disconnect();
  }
});
