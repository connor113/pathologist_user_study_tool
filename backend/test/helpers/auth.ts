/**
 * Test auth helpers
 * Create users and obtain auth cookies for supertest agents
 */

import bcrypt from 'bcrypt';
import { pool } from './db.js';
import type { TestAgent } from 'supertest';

/**
 * Create a user directly in the database (fast: 4 bcrypt rounds)
 */
export async function createUserInDb(
  username: string,
  password: string,
  role: 'pathologist' | 'admin' = 'pathologist'
): Promise<{ id: string; username: string; role: string }> {
  const hash = await bcrypt.hash(password, 4);
  const result = await pool.query(
    'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
    [username, hash, role]
  );
  return result.rows[0];
}

/**
 * Login via the API and return the agent (which now carries the auth cookie)
 */
export async function loginAndGetCookie(
  agent: TestAgent,
  username: string,
  password: string
): Promise<void> {
  await agent
    .post('/api/auth/login')
    .send({ username, password })
    .expect(200);
}
