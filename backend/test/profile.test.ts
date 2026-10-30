import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import { getCurrentUser, updateUserProfile } from '../src/controllers/user.controller';
import { requireUser } from '../src/middleware/user-auth';
import { completeProfileSchema, onboardingSchema, profileDefaults, profileUpdateSchema } from '../src/schemas/profile.schema';
import { User } from '../src/models/user.model';

function request(userId: string | null, body: unknown = {}, path = '/update-profile') {
  return { body, path, auth: () => ({ userId, sessionId: userId ? 'session' : null, tokenType: 'session_token' }) } as unknown as Request;
}
function response() {
  const result = { statusCode: 200, body: null as any };
  const res = { status(code: number) { result.statusCode = code; return res; }, json(body: unknown) { result.body = body; return res; } } as unknown as Response;
  return { result, res };
}

test('profile boundary rejects privilege, identity and completion timestamp injection', () => {
  for (const patch of [{ role: 'admin' }, { clerkId: 'victim' }, { email: 'victim@example.com' }, { onboardingCompletedAt: new Date() }]) {
    assert.equal(profileUpdateSchema.safeParse(patch).success, false);
  }
});

test('salary, URL, size and type constraints reject invalid saved profiles', () => {
  assert.equal(completeProfileSchema.safeParse({ ...profileDefaults, salaryMin: 100, salaryMax: 50 }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ portfolio: 'javascript:alert(1)' }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ portfolio: 'https://example.com' }).success, true);
  assert.equal(profileUpdateSchema.safeParse({ skills: Array(51).fill('React') }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ skills: 'React' }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ careerGoals: 'a'.repeat(2001) }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ salaryMin: -1 }).success, false);
});

test('drafts may be incomplete; onboarding requires a real name, experience and role', () => {
  assert.equal(completeProfileSchema.safeParse(profileDefaults).success, true);
  assert.equal(onboardingSchema.safeParse(profileDefaults).success, false);
  assert.equal(onboardingSchema.safeParse({ ...profileDefaults, displayName: '  ', targetRole: 'Developer', experienceLevel: 'student' }).success, false);
  assert.equal(onboardingSchema.safeParse({ ...profileDefaults, displayName: 'Asha', targetRole: 'Developer', experienceLevel: 'student' }).success, true);
});

test('anonymous API request returns JSON 401 instead of a redirect', () => {
  const { res, result } = response();
  let continued = false;
  requireUser(request(null), res, () => { continued = true; });
  assert.equal(result.statusCode, 401);
  assert.equal(continued, false);
});

test('signed-in guard uses Clerk function-style auth and continues', () => {
  const { res } = response();
  let continued = false;
  requireUser(request('candidate-a'), res, () => { continued = true; });
  assert.equal(continued, true);
});

test('read and write use the authenticated owner; completion is server controlled', async () => {
  const originalFind = User.findOne;
  const originalUpdate = User.findOneAndUpdate;
  const filters: unknown[] = [];
  const mutations: any[] = [];
  const profile = { ...profileDefaults, displayName: 'Asha', targetRole: 'Developer', experienceLevel: 'student' };
  const local = { _id: 'local-a', __v: 2, onboardingCompletedAt: null, get(key: string) { return profile[key as keyof typeof profile]; } };
  try {
    User.findOne = ((filter: unknown) => { filters.push(filter); return Promise.resolve(local); }) as any;
    User.findOneAndUpdate = ((filter: unknown, mutation: unknown) => { filters.push(filter); mutations.push(mutation); return Promise.resolve(local); }) as any;
    const read = response();
    await getCurrentUser(request('candidate-a'), read.res);
    assert.deepEqual(filters[0], { clerkId: 'candidate-a' });
    const draft = response();
    await updateUserProfile(request('candidate-a', { careerGoals: 'Build reliable applications' }), draft.res);
    assert.equal(draft.result.statusCode, 200);
    assert.deepEqual(filters[2], { _id: 'local-a', clerkId: 'candidate-a', __v: 2 });
    assert.equal(mutations[0].$set.onboardingCompletedAt, undefined);
    const complete = response();
    await updateUserProfile(request('candidate-a', {}, '/onboarding/complete'), complete.res);
    assert.equal(complete.result.statusCode, 200);
    assert.ok(mutations[1].$set.onboardingCompletedAt instanceof Date);
  } finally {
    User.findOne = originalFind;
    User.findOneAndUpdate = originalUpdate;
  }
});

test('partial salary update is checked against saved salary and never written when invalid', async () => {
  const original = User.findOne;
  try {
    User.findOne = (() => Promise.resolve({ get(key: string) { return key === 'salaryMin' ? 100 : profileDefaults[key as keyof typeof profileDefaults]; } })) as any;
    const { res, result } = response();
    await updateUserProfile(request('candidate-a', { salaryMax: 50 }), res);
    assert.equal(result.statusCode, 422);
  } finally { User.findOne = original; }
});

test('concurrent write conflict is reported without claiming save success', async () => {
  const originalFind = User.findOne;
  const originalUpdate = User.findOneAndUpdate;
  try {
    User.findOne = (() => Promise.resolve({ _id: 'local-a', __v: 1, get(key: string) { return profileDefaults[key as keyof typeof profileDefaults]; } })) as any;
    User.findOneAndUpdate = (() => Promise.resolve(null)) as any;
    const { res, result } = response();
    await updateUserProfile(request('candidate-a', { bio: 'New bio' }), res);
    assert.equal(result.statusCode, 409);
  } finally { User.findOne = originalFind; User.findOneAndUpdate = originalUpdate; }
});

test('delayed webhook recovery provisions verified identity without browser-supplied identity', async () => {
  const { ensureUser } = await import('../src/services/user.service');
  const originalFind = User.findOne;
  const originalUpdate = User.findOneAndUpdate;
  const inserted: any[] = [];
  try {
    User.findOne = (() => Promise.resolve(null)) as any;
    const readIdentity = (async (id: string) => {
      assert.equal(id, 'new-candidate');
      return { primaryEmailAddressId: 'primary', emailAddresses: [
        { id: 'other', emailAddress: 'other@example.com', verification: { status: 'verified' } },
        { id: 'primary', emailAddress: 'asha@example.com', verification: { status: 'verified' } },
      ], firstName: 'Asha', lastName: 'Rao' };
    }) as any;
    User.findOneAndUpdate = ((filter: unknown, mutation: unknown) => {
      inserted.push({ filter, mutation });
      return { orFail: () => Promise.resolve({ clerkId: 'new-candidate' }) };
    }) as any;
    const user = await ensureUser('new-candidate', readIdentity);
    assert.equal(user.clerkId, 'new-candidate');
    assert.equal(inserted[0].mutation.$setOnInsert.email, 'asha@example.com');
    assert.equal(inserted[0].mutation.$setOnInsert.displayName, 'Asha Rao');
  } finally { User.findOne = originalFind; User.findOneAndUpdate = originalUpdate; }
});

test('delayed webhook recovery refuses unverified primary email', async () => {
  const { ensureUser, UnverifiedEmailError } = await import('../src/services/user.service');
  const originalFind = User.findOne;
  try {
    User.findOne = (() => Promise.resolve(null)) as any;
    const readIdentity = (async () => ({ primaryEmailAddressId: 'primary', emailAddresses: [
      { id: 'primary', emailAddress: 'asha@example.com', verification: { status: 'unverified' } },
    ] })) as any;
    await assert.rejects(() => ensureUser('new-candidate', readIdentity), UnverifiedEmailError);
  } finally { User.findOne = originalFind; }
});

test('signed webhook selects the primary email and never overwrites career preferences', async () => {
  const { Webhook } = await import('svix');
  const { handleClerkWebhook } = await import('../src/controllers/webhook.controller');
  const oldSecret = process.env.CLERK_WEBHOOK_SECRET;
  const originalUpdate = User.findOneAndUpdate;
  const secret = `whsec_${Buffer.from('unit-test-signing-secret-only').toString('base64')}`;
  process.env.CLERK_WEBHOOK_SECRET = secret;
  try {
    const payload = JSON.stringify({ type: 'user.updated', data: {
      id: 'candidate-a', primary_email_address_id: 'primary', first_name: 'Asha',
      email_addresses: [{ id: 'secondary', email_address: 'other@example.com' }, { id: 'primary', email_address: 'asha@example.com' }],
    } });
    const timestamp = new Date();
    const headers: Record<string, string> = { 'svix-id': 'event-test', 'svix-timestamp': String(Math.floor(timestamp.getTime() / 1000)), 'svix-signature': new Webhook(secret).sign('event-test', timestamp, payload) };
    const req = { body: Buffer.from(payload), get: (key: string) => headers[key] } as unknown as Request;
    let writes = 0;
    User.findOneAndUpdate = ((filter: unknown, mutation: any) => {
      writes++;
      assert.deepEqual(filter, { clerkId: 'candidate-a' });
      assert.equal(mutation.$set.email, 'asha@example.com');
      assert.equal(mutation.$set.skills, undefined);
      assert.equal(mutation.$set.onboardingCompletedAt, undefined);
      return Promise.resolve({});
    }) as any;
    const valid = response();
    await handleClerkWebhook(req, valid.res);
    assert.equal(valid.result.statusCode, 200);
    assert.equal(writes, 1);
    req.body = Buffer.from(payload.replace('Asha', 'Tampered'));
    const invalid = response();
    await handleClerkWebhook(req, invalid.res);
    assert.equal(invalid.result.statusCode, 400);
    assert.equal(writes, 1);
  } finally {
    User.findOneAndUpdate = originalUpdate;
    if (oldSecret === undefined) delete process.env.CLERK_WEBHOOK_SECRET;
    else process.env.CLERK_WEBHOOK_SECRET = oldSecret;
  }
});
