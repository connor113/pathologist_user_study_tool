/**
 * Database connection pool
 * Uses PostgreSQL pg library with connection pooling for efficient queries
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Only load .env file in development (Railway provides env vars natively)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}
// ENV debug removed for production security

if (!process.env.DATABASE_URL) {
  console.error('[DB] FATAL: DATABASE_URL environment variable is not set');
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection fails
  // Cloud PostgreSQL providers require SSL
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// Log connection info (without password)
pool.on('connect', () => {
  console.log('[DB] Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;

