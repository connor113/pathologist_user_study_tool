/**
 * Express server entry point
 * Pathologist User Study - Backend API
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import pool from './db/index.ts';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - Allow multiple frontend origins for development
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Allow httpOnly cookies
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Import rate limiters
import { authLimiter, apiLimiter } from './middleware/rateLimiter.ts';

// Import route handlers
import authRoutes from './routes/auth.ts';
import slideRoutes from './routes/slides.ts';
import adminRoutes from './routes/admin.ts';

// Apply rate limiting to specific routes
// Auth endpoints get stricter rate limiting (5 req/min)
app.use('/api/auth/login', authLimiter);

// General API rate limiting (100 req/min)
app.use('/api', apiLimiter);

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/slides', slideRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API] Error:', err);
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message || 'Internal server error';
    
  res.status(err.status || 500).json({ 
    error: message 
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[API] SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[API] SIGINT received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
  console.log(`[API] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[API] Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});

export default app;
