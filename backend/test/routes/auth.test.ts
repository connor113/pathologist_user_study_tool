import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { truncateAll } from '../helpers/db.js';
import { createUserInDb } from '../helpers/auth.js';

const app = createApp({ disableRateLimiting: true });

describe('Auth routes', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  // ── POST /api/auth/login ──────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('returns user and sets cookie on valid credentials', async () => {
      await createUserInDb('doc1', 'password123', 'pathologist');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'doc1', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.username).toBe('doc1');
      expect(res.body.data.user.role).toBe('pathologist');
      expect(res.body.data.user.id).toBeDefined();
      // Cookie should be set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('token=');
    });

    it('returns 401 for wrong password', async () => {
      await createUserInDb('doc1', 'password123', 'pathologist');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'doc1', password: 'wrongpass' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('returns 401 for nonexistent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nobody', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('returns 400 when fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'doc1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });
  });

  // ── POST /api/auth/logout ─────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('clears the token cookie', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      // Cookie should be cleared (expires in the past or empty value)
      expect(cookies[0]).toContain('token=');
    });
  });

  // ── GET /api/auth/me ──────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('returns user when authenticated', async () => {
      await createUserInDb('doc1', 'password123', 'pathologist');

      const agent = request.agent(app);
      await agent
        .post('/api/auth/login')
        .send({ username: 'doc1', password: 'password123' })
        .expect(200);

      const res = await agent.get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.body.data.user.username).toBe('doc1');
      expect(res.body.data.user.role).toBe('pathologist');
    });

    it('returns 401 without cookie', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with an invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'token=invalid.jwt.token');

      expect(res.status).toBe(401);
    });
  });
});
