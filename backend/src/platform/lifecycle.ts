import { createHash } from 'node:crypto';
import { clerkClient } from '@clerk/express';
import { User } from '../models/user.model';
import { Resume } from '../models/resume.model';
import { PrepSession } from '../models/prep.model';
import { Analysis, Interview, Task, UsageBucket, AiUsage } from './models';

export const taskKey = (...parts: string[]) => createHash('sha256').update(parts.join(':')).digest('hex');
export async function enqueue(input: { _id: string; owner: string; type: string; resourceId: string; revision?: number }) {
  if (input.type !== 'delete_account') await assertActiveOwner(input.owner);
  await Task.updateOne({ _id: input._id }, { $setOnInsert: input }, { upsert: true });
}
export async function expiration(owner: string) {
  const user = await User.findOne({ clerkId: owner }).select('retentionDays');
  return new Date(Date.now() + (user?.retentionDays ?? 90) * 86400000);
}
export async function requestDeletion(owner: string) {
  if (await User.exists({ clerkId: owner, status: 'deleted' })) return taskKey(owner, 'delete-account');
  // A minimal tombstone blocks existing sessions and prevents local recreation.
  await User.updateOne({ clerkId: owner }, { $set: { status: 'deleting' }, $setOnInsert: { clerkId: owner, email: 'deletion-pending@invalid.local' } }, { upsert: true });
  const id = taskKey(owner, 'delete-account');
  await Task.updateMany({ owner, type: { $ne: 'delete_account' }, status: { $in: ['pending', 'running'] } }, { $set: { status: 'canceled' } });
  await enqueue({ _id: id, owner, type: 'delete_account', resourceId: owner });
  return id;
}
let identityDeleter: (owner: string) => Promise<unknown> = owner => clerkClient.users.deleteUser(owner);
export function setIdentityDeleterForTests(deleter: ((owner: string) => Promise<unknown>) | null) { identityDeleter = deleter ?? (owner => clerkClient.users.deleteUser(owner)); }
export async function assertActiveOwner(owner: string, cleanup?: () => Promise<unknown>) {
  if (await User.exists({ clerkId: owner, status: { $in: ['deleting', 'deleted'] } })) {
    if (cleanup) await cleanup();
    throw Object.assign(new Error('This account is unavailable.'), { status: 403 });
  }
}
export async function purgeAccount(owner: string) {
  await Promise.all([
    Resume.deleteMany({ clerkId: owner }), PrepSession.deleteMany({ clerkId: owner }),
    Analysis.deleteMany({ owner }), Interview.deleteMany({ owner }), UsageBucket.deleteMany({ owner }), AiUsage.updateMany({ owner }, { $set: { owner: 'deleted' }, $unset: { taskId: '' } }),
    Task.deleteMany({ owner, type: { $ne: 'delete_account' } }),
  ]);
  try { await identityDeleter(owner); }
  catch (error) { if ((error as { status?: number }).status !== 404) throw new Error('Remote identity deletion pending'); }
  const retained = new Set(['_id', 'clerkId', 'status', 'deletedAt', 'role']);
  const personal = Object.keys(User.schema.paths).filter(key => !retained.has(key));
  await User.collection.updateOne({ clerkId: owner }, { $set: { status: 'deleted', deletedAt: new Date(), role: 'user' }, $unset: Object.fromEntries(personal.map(key => [key, ''])) });
}
