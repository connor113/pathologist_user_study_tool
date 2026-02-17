/**
 * Vitest global setup
 * Closes the database pool after all tests complete
 */

import { afterAll } from 'vitest';
import pool from '../src/db/index.js';

afterAll(async () => {
  await pool.end();
});
