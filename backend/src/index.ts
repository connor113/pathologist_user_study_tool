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

// Bootstrap admin user if none exists
const bootstrapAdmin = async () => {
  try {
    const existing = await pool.query("SELECT id FROM users WHERE role='admin' LIMIT 1");
    if (existing.rows.length === 0) {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('admin123', 10);
      await pool.query(
        "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')",
        ['admin', hash]
      );
      console.log('[DB] Bootstrap admin user created (admin / admin123)');
    }
  } catch (err: any) {
    console.error('[DB] Bootstrap admin error:', err.message);
  }
};

await bootstrapAdmin();

// Seed slides from CloudFront manifests if none exist
const seedSlides = async () => {
  try {
    const existing = await pool.query('SELECT COUNT(*) FROM slides');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log(`[DB] Slides already seeded (${existing.rows[0].count} found)`);
      return;
    }
    const slideIds = ['CRC_0170','CRC_0423','CRC_0645','CRC_0908','CRC_1459','CRC_1472','CRC_2000','CRC_2103','CRC_2144','CRC_2198','CRC_2341','CRC_2593','CRC_2696','CRC_2739','CRC_2749','CRC_3060','CRC_3109','CRC_3138','CRC_3148','CRC_4240'];
    const cfUrl = process.env.CLOUDFRONT_URL || 'https://d28izxa5ffe64k.cloudfront.net';
    let seeded = 0;
    for (const id of slideIds) {
      try {
        const res = await fetch(`${cfUrl}/slides/${id}/manifest.json`);
        if (!res.ok) { console.error(`[DB] Manifest fetch failed for ${id}: ${res.status}`); continue; }
        const manifest = await res.json();
        await pool.query(
          'INSERT INTO slides (slide_id, s3_key_prefix, manifest_json) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [id, `slides/${id}`, JSON.stringify(manifest)]
        );
        seeded++;
      } catch (err: any) { console.error(`[DB] Seed error ${id}:`, err.message); }
    }
    console.log(`[DB] Seeded ${seeded} slides`);
  } catch (err: any) {
    console.error('[DB] Seed slides error:', err.message);
  }
};

await seedSlides();

// Start server
const server = app.listen(PORT, () => {
  console.log(`[API] Server running on port ${PORT}`);
  console.log(`[API] Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
