import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import mongoose from 'mongoose';
import routes, { CareerTask } from '../src/platform/phase2';
import { errors } from '../src/platform/observability';
import { setAIProviderForTests } from '../src/platform/ai';
import { workerTick, reconcile } from '../src/platform/worker';
import { Task } from '../src/platform/models';
import { Resume } from '../src/models/resume.model';
import { User } from '../src/models/user.model';
import { resumeContentSchema } from '../src/schemas/resume.schema';
import { purgeAccount, setIdentityDeleterForTests } from '../src/platform/lifecycle';

test('career jobs recover, preserve frozen evidence, isolate owners and checkpoint reviewed edits', { skip: !process.env.TEST_MONGODB_URI }, async () => {
  await mongoose.connect(process.env.TEST_MONGODB_URI!, { dbName: `phase2_test_${randomUUID().replaceAll('-', '')}` });
  await Promise.all([CareerTask.init(), Resume.init(), User.init(), Task.init()]);
  setIdentityDeleterForTests(async () => ({}));
  setAIProviderForTests({ async generate({ operation, context }) {
    const input = context as any;
    const data = operation === 'reviewed_rewrite' ? { edits: [{ field: 'summary', before: input.current.summary, after: 'Built TypeScript tools for internal teams.', reason: 'Clearer wording.', evidenceRefs: ['summary'] }] } : { days: Array.from({ length: 7 }, (_, index) => ({ day: index + 1, exercise: 'Explain one actual tradeoff.', completion: 'Write three sentences.', evidenceRefs: ['summary'], generalGuidance: false })) };
    return { data, provider: 'fixture', model: 'fixture', inputTokens: 1, outputTokens: 1 };
  } });
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { Object.defineProperty(req, 'auth', { value: () => ({ userId: req.get('x-test-user') ?? 'a', tokenType: 'session_token', sessionId: 'test' }) }); next(); });
  app.use('/api', routes); app.use(errors);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  async function call(path: string, method = 'GET', body?: unknown, owner = 'a', key = randomUUID()) {
    const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-test-user': owner, 'Idempotency-Key': key }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() as any };
  }
  try {
    await User.create({ clerkId: 'a', email: 'a@example.com' });
    const resume = await Resume.create({ ...resumeContentSchema.parse({ summary: 'Built tools using TypeScript.', targetRole: 'Developer' }), clerkId: 'a' });
    const body = { kind: 'rewrite', resumeId: String(resume._id), expectedRevision: 0 };
    const key = randomUUID(), started = await call('/career', 'POST', body, 'a', key);
    assert.equal(started.status, 202);
    assert.equal((await call('/career', 'POST', body, 'a', key)).data.item._id, started.data.item._id);
    assert.equal((await call('/career', 'GET', undefined, 'b')).data.items.length, 0);
    await Task.deleteMany({ resourceId: started.data.item._id }); await reconcile(); await workerTick();
    let item = (await call('/career')).data.items[0]; assert.equal(item.state, 'completed'); assert.equal(item.input, undefined);
    assert.equal((await call(`/career/${item._id}/apply`, 'POST', { expectedRevision: 0, edits: [0], confirmation: 'REVIEWED' }, 'b')).status, 404);
    assert.equal((await call(`/career/${item._id}/apply`, 'POST', { expectedRevision: 0, edits: [0], confirmation: 'REVIEWED' })).status, 200);
    const updated = await Resume.findById(resume._id).select('+versions');
    assert.equal(updated!.summary, 'Built TypeScript tools for internal teams.'); assert.equal(updated!.versions[0].snapshot.summary, resume.summary); assert.equal(updated!.versionCount, 1);
    assert.equal((await call(`/career/${item._id}/apply`, 'POST', { expectedRevision: 0, edits: [0], confirmation: 'REVIEWED' })).status, 409);
    await call('/career', 'POST', { ...body, kind: 'coach', expectedRevision: 1 }); await workerTick();
    item = (await call('/career')).data.items.find((row: any) => row.kind === 'coach');
    assert.equal(item.report.days.length, 7);
    assert.deepEqual((await call(`/career/${item._id}/progress`, 'PATCH', { completedDays: [1, 1, 3] })).data.item.completedDays, [1, 3]);
    assert.equal((await call(`/career/${item._id}/days/1`, 'PATCH', { exercise: 'Practice an explanation.', completion: 'Write a paragraph.' })).data.item.report.days[0].userEdited, true);
    await purgeAccount('a'); assert.equal(await CareerTask.countDocuments({ owner: 'a' }), 0);
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    setAIProviderForTests(null); setIdentityDeleterForTests(null); await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
});
