/**
 * Test database helpers
 * Provides pool access and cleanup utilities
 */

import pool from '../../src/db/index.js';

export { pool };

/**
 * Truncate all tables (CASCADE) for a clean slate between tests
 */
export async function truncateAll(): Promise<void> {
  await pool.query('TRUNCATE events, sessions, slides, users CASCADE');
}
