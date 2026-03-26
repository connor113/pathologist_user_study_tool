/**
 * Express server entry point
 * Pathologist User Study - Backend API
 */

import dotenv from 'dotenv';
import pool from './db/index.js';
import { createApp } from './app.js';

// Load environment variables
dotenv.config();

// Validate critical env vars
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('[FATAL] JWT_SECRET must be set and at least 32 characters in production');
    process.exit(1);
  }
}

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

// Run migrations on startup
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const runMigrations = async () => {
  try {
    const migrationPath = join(__dirname, 'db', 'migrations', '000_railway_full.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('[DB] Migrations applied successfully');
  } catch (err: any) {
    console.error('[DB] Migration error:', err.message);
    // Don't exit — tables might already exist
  }
};

await runMigrations();

// Bootstrap admin user if none exists (uses ADMIN_PASSWORD env var or fallback)
const bootstrapAdmin = async () => {
  try {
    const existing = await pool.query("SELECT id FROM users WHERE role='admin' LIMIT 1");
    if (existing.rows.length === 0) {
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash(adminPassword, 12);
      await pool.query(
        "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')",
        ['admin', hash]
      );
      console.log('[DB] Bootstrap admin user created (username: admin)');
      if (!process.env.ADMIN_PASSWORD) {
        console.warn('[DB] WARNING: Using default admin password. Set ADMIN_PASSWORD env var for production.');
      }
    }
  } catch (err: any) {
    console.error('[DB] Bootstrap admin error:', err.message);
  }
};

await bootstrapAdmin();

// Skip auto-seed — slides are managed via seed-200-slides.cjs script
// Previous auto-seed deleted all slides on every restart (dangerous!)
const checkSlides = async () => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM slides');
    console.log(`[DB] ${result.rows[0].count} slides in database`);
    if (parseInt(result.rows[0].count) === 0) {
      console.log('[DB] WARNING: No slides found. Run: node backend/scripts/seed-200-slides.cjs');
    }
  } catch (err: any) {
    console.error('[DB] Slide check error:', err.message);
  }
};

await checkSlides();

// Start server
const server = app.listen(PORT, () => {
  console.log(`[API] Server running on port ${PORT}`);
  console.log(`[API] Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
