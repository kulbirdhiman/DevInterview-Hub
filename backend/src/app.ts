import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import mongoose from 'mongoose';
import { clerkMiddleware, requireAuth } from '@clerk/express';

import webhookRoutes from './routes/webhook.routes';
// Import other routes here later
import userRoutes from './routes/user.routes';

const app = express();

// ====================== MIDDLEWARE ======================
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Raw body parser for Clerk Webhooks (MUST be before express.json())
app.use('/api/webhooks', express.raw({ type: 'application/json' }));

// Normal JSON parser for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Clerk Middleware - This adds `req.auth`
app.use(clerkMiddleware());

// ====================== ROUTES ======================

// Webhook Route (Clerk)
app.use('/api/webhooks', webhookRoutes);

// Public Route
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Express + Clerk + MongoDB Backend is running!' 
  });
});

// Protected Routes
app.get('/api/me', requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth;

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
app.get('/api/protected', requireAuth(), (req, res) => {
  const { userId, sessionId } = req.auth;
  
  res.json({
    success: true,
    message: 'This is protected data',
    userId,
    sessionId
  });
});

// ====================== DATABASE CONNECTION ======================
mongoose.connect(process.env.MONGODB_URI!)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// ====================== START SERVER ======================
const PORT = process.env.PORT || 5000;

//routes
app.use('/api/users', userRoutes);


app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`✅ Clerk Auth Middleware Active`);
});