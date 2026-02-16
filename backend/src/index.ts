/**
 * Express server entry point
 * Pathologist User Study - Backend API
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import pool from './db/index.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy (required for rate limiting behind reverse proxies like Railway/Render)
app.set('trust proxy', 1);

// Security headers
app.use(helmet());
app.disable('x-powered-by');

// CORS - only allow localhost origins in development
const allowedOrigins: string[] = [];
if (!isProduction) {
  allowedOrigins.push('http://localhost:5173', 'http://localhost:5174');
}
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // In production, require an origin header
    if (!origin) {
      if (isProduction) {
        return callback(new Error('Origin header required'));
      }
      // Allow no-origin requests in development (curl, Postman)
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Allow httpOnly cookies
}));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Health check endpoint - actually queries database
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected'
    });
  }
});

// Import rate limiters
import { authLimiter, apiLimiter } from './middleware/rateLimiter.js';

// Import route handlers
import authRoutes from './routes/auth.js';
import slideRoutes from './routes/slides.js';
import adminRoutes from './routes/admin.js';

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
  const message = isProduction
    ? 'Internal server error'
    : err.message || 'Internal server error';

  res.status(err.status || 500).json({
    error: message
  });
});

// Graceful shutdown
let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[API] ${signal} received, shutting down gracefully`);

  // Stop accepting new connections
  server.close(async () => {
    console.log('[API] HTTP server closed');
    await pool.end();
    console.log('[API] Database connections closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('[API] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const server = app.listen(PORT, () => {
  console.log(`[API] Server running on port ${PORT}`);
  console.log(`[API] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[API] Allowed origins: ${allowedOrigins.join(', ')}`);
});

export default app;
