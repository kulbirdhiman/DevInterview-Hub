import { User } from '../models/user.model';
import { UsageBucket } from './models';

export const betaLimits = { resumeSlots: 1, resumeAI: 2, analysis: 3, interview: 2, pdf: 10, dataExport: 2, providerCalls: 40 } as const;
export type Metric = keyof typeof betaLimits;
export class QuotaError extends Error { status = 429; constructor(metric: string) { super(`Free beta ${metric} limit reached. Check Usage for your remaining allowance.`); } }

export function periodFor(metric: Metric, now = new Date()) {
  return metric === 'resumeSlots' ? 'lifetime' : now.toISOString().slice(0, 7);
}
function bucketId(owner: string, period: string) { return `${owner}:${period}`; }

// Each bucket holds both idempotency keys and counters. Reservation and limit
// checking are one MongoDB write, including under concurrent API/worker calls.
export async function reserve(owner: string, metric: Metric, key: string, limit: number = betaLimits[metric]) {
  const period = periodFor(metric), id = bucketId(owner, period);
  try {
    await UsageBucket.updateOne({ _id: id }, { $setOnInsert: { owner, period, entries: [],
      ...(period !== 'lifetime' ? { expiresAt: new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)) + 3, 1)) } : {}) } }, { upsert: true });
  } catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
  const entryKey = `${metric}:${key}`;
  const claimed = await UsageBucket.findOneAndUpdate({ _id: id,
    'entries.key': { $ne: entryKey },
    $expr: { $and: [{ $lt: [{ $size: '$entries' }, 2000] }, { $lt: [{ $size: { $filter: { input: '$entries', as: 'entry', cond: { $and: [{ $eq: ['$$entry.metric', metric] }, { $ne: ['$$entry.state', 'released'] }] } } } }, limit] }] },
  }, { $push: { entries: { key: entryKey, metric, state: 'reserved', createdAt: new Date() } } }, { returnDocument: 'after' });
  if (!claimed) {
    const existing = await UsageBucket.findById(id);
    const entry = existing?.entries.find(item => item.key === entryKey);
    if (!entry || entry.state === 'released') throw new QuotaError(metric);
  }
  if (await User.exists({ clerkId: owner, status: { $in: ['deleting', 'deleted'] } })) { await UsageBucket.deleteMany({ owner }); throw Object.assign(new Error('This account is unavailable.'), { status: 403 }); }
  return { owner, metric, key: entryKey, period, fresh: Boolean(claimed) };
}
export type Reservation = Awaited<ReturnType<typeof reserve>>;
export async function settle(reservation: Reservation, state: 'consumed' | 'released') {
  await UsageBucket.updateOne({ _id: bucketId(reservation.owner, reservation.period), entries: { $elemMatch: { key: reservation.key, state: 'reserved' } } }, { $set: { 'entries.$.state': state } });
}
export async function settleKey(owner: string, metric: Metric, key: string, state: 'consumed' | 'released') {
  await UsageBucket.updateMany({ owner, entries: { $elemMatch: { key: `${metric}:${key}`, state: 'reserved' } } }, { $set: { 'entries.$[entry].state': state } }, { arrayFilters: [{ 'entry.key': `${metric}:${key}`, 'entry.state': 'reserved' }] });
}
export async function releaseResumeSlot(owner: string) {
  await UsageBucket.updateOne({ _id: bucketId(owner, 'lifetime') }, { $set: { 'entries.$[entry].state': 'released' } }, { arrayFilters: [{ 'entry.metric': 'resumeSlots', 'entry.state': { $ne: 'released' } }] });
}
export async function usage(owner: string) {
  const buckets = await UsageBucket.find({ owner, period: { $in: ['lifetime', periodFor('analysis')] } });
  return Object.entries(betaLimits).map(([metric, limit]) => ({ metric, limit, period: periodFor(metric as Metric),
    used: buckets.flatMap(bucket => bucket.entries).filter(entry => entry.metric === metric && entry.state !== 'released').length }));
}
