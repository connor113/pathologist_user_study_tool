/**
 * Express server entry point
 * Pathologist User Study - Backend API
 */

import dotenv from 'dotenv';
import pool from './db/index.js';
import { createApp } from './app.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;

const app = createApp();

// Graceful shutdown
let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[API] ${signal} received, shutting down gracefully`);

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
});

export default app;
