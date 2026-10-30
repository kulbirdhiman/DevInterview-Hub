import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import express from 'express';
import mongoose from 'mongoose';
import type { AddressInfo } from 'node:net';
import routes from '../src/routes/resume.routes';
import { Resume } from '../src/models/resume.model';

// Explicit opt-in; the unique dbName overrides the URI database. Only that
// disposable test database is removed afterward, never the application's DB.
test('resume API integration: drafts, ownership, concurrent writes and immutable restoration', { skip: !process.env.TEST_MONGODB_URI }, async () => {
  const databaseName = `devinterview_editor_test_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.TEST_MONGODB_URI!, { dbName: databaseName });
  const app = express();
  app.use(express.json({ limit: '128kb' }));
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'auth', { value: () => ({ userId: req.get('x-test-user') ?? null, sessionId: 'test-session', tokenType: 'session_token' }) });
    next();
  });
  app.use('/api/resumes', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/resumes`;
  async function call(path: string, method = 'GET', body?: unknown, user = 'candidate-a') {
    const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() as any };
  }
  try {
    assert.equal((await call('', 'GET', undefined, '')).status, 401);
    const created = await call('', 'POST', { fullName: 'Asha Rao', title: 'Developer resume' });
    assert.equal(created.status, 201);
    const id = created.data.resume._id;
    const baseContent = created.data.resume;
    assert.equal((await call(`/${id}`, 'GET', undefined, 'candidate-b')).status, 404);
    assert.equal((await call(`/${id}/versions`, 'POST', { expectedRevision: 0 }, 'candidate-b')).status, 404);
    assert.equal((await call('/invalid-id')).status, 400);
    const editable = Object.fromEntries(Object.keys((await import('../src/schemas/resume.schema')).resumeContentSchema.shape).map(key => [key, baseContent[key]]));
    const idCustom = randomUUID();
    const content = { ...editable, summary: 'Built internal tools.', customSections: [{ id: idCustom, title: 'Volunteering', body: 'Taught a workshop.' }], sectionOrder: [`custom:${idCustom}`, ...baseContent.sectionOrder], presentation: { ...baseContent.presentation, font: 'serif', color: 'blue' } };
    const requests = await Promise.all([
      call(`/${id}`, 'PUT', { expectedRevision: 0, content }),
      call(`/${id}`, 'PUT', { expectedRevision: 0, content: { ...content, summary: 'A competing edit.' } }),
    ]);
    assert.deepEqual(requests.map(result => result.status).sort(), [200, 409]);
    const winner = requests.find(result => result.status === 200)!.data.resume;
    assert.equal(winner.revision, 1);
    const checkpoint = await call(`/${id}/versions`, 'POST', { expectedRevision: 1, label: 'Application A' });
    assert.equal(checkpoint.status, 201);
    assert.equal(checkpoint.data.resume.revision, 2);
    assert.equal(checkpoint.data.resume.versions, undefined);
    const history = await call(`/${id}/versions`);
    assert.equal(history.data.versions.length, 1);
    assert.equal(history.data.versions[0].snapshot, undefined);
    const versionId = history.data.versions[0]._id;
    assert.equal((await call(`/${id}/versions/${versionId}/restore`, 'POST', { expectedRevision: 2 }, 'candidate-b')).status, 404);
    const newDraft = await call(`/${id}`, 'PUT', { expectedRevision: 2, content: { ...content, summary: 'An intentional later draft.' } });
    assert.equal(newDraft.status, 200);
    const restored = await call(`/${id}/versions/${versionId}/restore`, 'POST', { expectedRevision: 3 });
    assert.equal(restored.status, 200);
    assert.equal(restored.data.resume.summary, winner.summary);
    assert.equal(restored.data.resume.presentation.font, 'serif');
    assert.equal(restored.data.resume.customSections[0].body, 'Taught a workshop.');
    assert.equal(restored.data.resume.sectionOrder[0], `custom:${idCustom}`);
    assert.equal(restored.data.resume.versionCount, 2);
    const stored = await Resume.findById(id).select('+versions');
    assert.equal(stored!.versions[0].snapshot.summary, winner.summary);
    assert.equal(stored!.versions[1].snapshot.summary, 'An intentional later draft.');
    const revision = restored.data.resume.revision;
    await Resume.updateOne({ _id: id }, { $set: { versionCount: 30 } });
    assert.equal((await call(`/${id}/versions`, 'POST', { expectedRevision: revision })).status, 422);
    assert.equal((await call(`/${id}/versions/${versionId}/restore`, 'POST', { expectedRevision: revision })).status, 422);
    // A pre-editor document lacks revision/presentation/order in raw BSON.
    const legacy = await Resume.collection.insertOne({ clerkId: 'candidate-a', title: 'Legacy', fullName: 'Legacy candidate', summary: 'Original summary', skills: [], experience: [], projects: [], education: [] });
    const legacySave = await call(`/${legacy.insertedId}`, 'PUT', { expectedRevision: 0, content: { ...editable, title: 'Legacy updated' } });
    assert.equal(legacySave.status, 200);
    assert.equal(legacySave.data.resume.revision, 1);
    assert.equal((await call(`/${id}`, 'DELETE', undefined, 'candidate-b')).status, 404);
    assert.equal((await call(`/${id}`, 'DELETE')).status, 200);
    assert.equal((await call(`/${id}/versions`)).status, 404);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await mongoose.connection.db!.dropDatabase();
    await mongoose.disconnect();
  }
});
