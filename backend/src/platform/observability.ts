import { randomUUID } from 'node:crypto';
import { getAuth } from '@clerk/express';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { User } from '../models/user.model';

export const requestMetrics = { requests: 0, failures: 0, durations: [] as number[] };
export const observe: RequestHandler = (req, res, next) => {
  const requestId = randomUUID(), started = performance.now();
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.path.startsWith('/api/') && !req.path.startsWith('/api/health')) res.setHeader('Cache-Control', 'no-store');
  res.on('finish', () => {
    const durationMs = Math.round(performance.now() - started);
    requestMetrics.requests++; if (res.statusCode >= 500) requestMetrics.failures++;
    requestMetrics.durations.push(durationMs); if (requestMetrics.durations.length > 500) requestMetrics.durations.shift();
    console.log(JSON.stringify({ event: 'request', requestId, method: req.method,
      path: (req.baseUrl + (req.route?.path ?? 'unmatched')).replace(/[a-f\d]{24}/gi, ':id'), status: res.statusCode, durationMs }));
  });
  next();
};

const windows = new Map<string, { count: number; until: number }>();
export const rateLimit: RequestHandler = (req, res, next) => {
  const key = getAuth(req).userId ?? req.ip ?? 'unknown', now = Date.now();
  let window = windows.get(key);
  if (!window || window.until < now) { window = { count: 0, until: now + 60000 }; windows.set(key, window); }
  if (windows.size > 10000) for (const [id, item] of windows) if (item.until < now) windows.delete(id);
  if (++window.count > 120) { res.setHeader('Retry-After', Math.ceil((window.until - now) / 1000)); res.status(429).json({ message: 'Too many requests. Please wait a minute.' }); return; }
  next();
};
export const activeAccount: RequestHandler = async (req, res, next) => {
  try {
    if (!getAuth(req).userId) { next(); return; }
    if (await User.exists({ clerkId: getAuth(req).userId, status: { $in: ['deleting', 'deleted'] } })) {
      res.status(403).json({ message: 'This account is being deleted or has been deleted.' }); return;
    }
    next();
  } catch (error) { next(error); }
};
export const adminOnly: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuth(req).userId!;
    const allowed = (process.env.ADMIN_CLERK_IDS ?? '').split(',').map(value => value.trim()).filter(Boolean);
    if (!allowed.includes(userId) && !await User.exists({ clerkId: userId, role: 'admin', status: { $nin: ['deleting', 'deleted'] } })) {
      res.status(403).json({ message: 'Administrator access required.' }); return;
    }
    next();
  } catch (error) { next(error); }
};
export const errors: ErrorRequestHandler = (error, _req, res, _next) => {
  if (res.headersSent) { res.destroy(); return; }
  const status = error?.status === 403 ? 403 : error?.status === 429 ? 429 : error?.type === 'entity.too.large' ? 413 : error?.type === 'entity.parse.failed' ? 400 : error?.status === 422 ? 422 : 503;
  res.status(status).json({ message: status === 403 || status === 429 || status === 422 ? error.message : status === 413 ? 'Request is too large.' : status === 400 ? 'Invalid JSON request.' : 'Service unavailable. Please retry.', requestId: res.getHeader('X-Request-Id') });
};
