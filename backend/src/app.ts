/**
 * Express application factory
 * Extracted from index.ts so tests can import the app without calling listen()
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pool from './db/index.js';
import { authLimiter, apiLimiter } from './middleware/rateLimiter.js';
import authRoutes from './routes/auth.js';
import slideRoutes from './routes/slides.js';
import adminRoutes from './routes/admin.js';

export interface AppOptions {
  /** Disable rate limiting (useful for tests) */
  disableRateLimiting?: boolean;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

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
      if (!origin) {
        if (isProduction) {
          return callback(new Error('Origin header required'));
        }
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));

  // Body parsing with size limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Request logging middleware (suppress in test)
  if (!isTest) {
    app.use((req, res, next) => {
      console.log(`[API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
      next();
    });
  }

  // Health check endpoint
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

  // Apply rate limiting (unless disabled for tests)
  if (!options.disableRateLimiting) {
    app.use('/api/auth/login', authLimiter);
    app.use('/api', apiLimiter);
  }

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
    if (!isTest) {
      console.error('[API] Error:', err);
    }

    const message = isProduction
      ? 'Internal server error'
      : err.message || 'Internal server error';

    res.status(err.status || 500).json({
      error: message
    });
  });

  return app;
}
