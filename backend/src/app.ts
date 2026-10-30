import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import mongoose from 'mongoose';
import { clerkMiddleware, getAuth } from '@clerk/express';

import { requireUser } from './middleware/user-auth';

import webhookRoutes from './routes/webhook.routes';
import userRoutes from './routes/user.routes';
import resumeRoutes from './routes/resume.routes';
import prepRoutes from './routes/prep.routes';
import healthRoutes from './routes/health.routes';
import platformRoutes from './platform/routes';
import { observe, rateLimit, activeAccount, errors } from './platform/observability';
import { startWorker } from './platform/worker';

import { isAiConfigured } from './services/ai.service';

const app = express();
app.disable('x-powered-by');
app.use(observe);

// ====================== MIDDLEWARE ======================
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Raw body parser for Clerk Webhooks (MUST be before express.json())
app.use('/api/webhooks', express.raw({ type: 'application/json' }));

// Normal JSON parser for all other routes
app.use(express.json({ limit: '128kb' }));
app.use(express.urlencoded({ extended: true }));

// Clerk Middleware - This adds `req.auth`
app.use(clerkMiddleware());

// ====================== ROUTES ======================

// Webhook Route (Clerk)
app.use('/api/webhooks', webhookRoutes);

// Health probe used by the Docker healthcheck and uptime checks.
app.use('/api/health', healthRoutes);

// Lets the dashboard show a setup banner instead of failing on first use.
app.get('/api/ai/status', (req, res) => {
  res.json({ success: true, configured: isAiConfigured() });
});

// Public Route
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Express + Clerk + MongoDB Backend is running!' 
  });
});

app.use('/api', rateLimit, activeAccount);

// Protected Routes
app.get('/api/me', requireUser, async (req, res) => {
  try {
    const { userId } = getAuth(req);

    // You can fetch user from your database
    // const user = await User.findOne({ clerkId: userId });

    res.json({
      success: true,
      userId,
      // user,           // Uncomment when you connect User model
      message: 'User authenticated successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Example of another protected route
app.get('/api/protected', requireUser, (req, res) => {
  const { userId, sessionId } = getAuth(req);
  
  res.json({
    success: true,
    message: 'This is protected data',
    userId,
    sessionId
  });
});

// ====================== DATABASE CONNECTION ======================
// ====================== START SERVER ======================
const PORT = process.env.PORT || 5000;

//routes
app.use('/api/users', userRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/prep', prepRoutes);


app.use('/api', platformRoutes);
app.use(errors);

async function start() {
  await mongoose.connect(process.env.MONGODB_URI!);
  // Build unique indexes before accepting work or claiming background tasks.
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
  const stopWorker = startWorker();
  const server = app.listen(PORT, () => console.log(JSON.stringify({ event: 'server_ready', port: PORT })));
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => {
    stopWorker(); server.close(() => { void mongoose.disconnect().finally(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 15000).unref();
  });
}
start().catch(() => { console.error(JSON.stringify({ event: 'startup_failed', code: 'DEPENDENCY_UNAVAILABLE' })); process.exit(1); });
