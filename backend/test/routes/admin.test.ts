import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { truncateAll } from '../helpers/db.js';
import { createUserInDb, loginAndGetCookie } from '../helpers/auth.js';
import { createTestSlide, makeEvent } from '../helpers/factories.js';

const app = createApp({ disableRateLimiting: true });

describe('Admin routes', () => {
  let adminAgent: ReturnType<typeof request.agent>;

  beforeEach(async () => {
    await truncateAll();
    await createUserInDb('admin1', 'admin123', 'admin');
    adminAgent = request.agent(app);
    await loginAndGetCookie(adminAgent, 'admin1', 'admin123');
  });

  // ── Access control ────────────────────────────────────────────

  describe('Access control', () => {
    it('returns 403 for pathologist user', async () => {
      await createUserInDb('doc1', 'pass123', 'pathologist');
      const docAgent = request.agent(app);
      await loginAndGetCookie(docAgent, 'doc1', 'pass123');

      const res = await docAgent.get('/api/admin/users');
      expect(res.status).toBe(403);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/admin/users ──────────────────────────────────────

  describe('GET /api/admin/users', () => {
    it('returns pathologist list with session stats', async () => {
      await createUserInDb('doc1', 'pass123', 'pathologist');
      await createUserInDb('doc2', 'pass456', 'pathologist');

      const res = await adminAgent.get('/api/admin/users');
      expect(res.status).toBe(200);
      // Only pathologists, not admin
      expect(res.body.data.users).toHaveLength(2);
      expect(res.body.data.users[0]).toHaveProperty('total_sessions');
      expect(res.body.data.users[0]).toHaveProperty('completed_sessions');
    });
  });

  // ── GET /api/admin/progress ───────────────────────────────────

  describe('GET /api/admin/progress', () => {
    it('returns correct counts and percentages', async () => {
      // Create 2 pathologists and 2 slides → 4 possible sessions
      const doc1 = await createUserInDb('doc1', 'pass123', 'pathologist');
      await createUserInDb('doc2', 'pass456', 'pathologist');
      const slide1 = await createTestSlide({ slide_id: 'progress_s1' });
      await createTestSlide({ slide_id: 'progress_s2' });

      // doc1 completes slide1
      const docAgent = request.agent(app);
      await loginAndGetCookie(docAgent, 'doc1', 'pass123');
      const startRes = await docAgent.post('/api/slides/progress_s1/start');
      const sessionId = startRes.body.data.session_id;
      await docAgent
        .post(`/api/slides/sessions/${sessionId}/events`)
        .send({ events: [makeEvent()] });
      await docAgent
        .post(`/api/slides/sessions/${sessionId}/complete`)
        .send({ label: 'low-grade' });

      const res = await adminAgent.get('/api/admin/progress');
      expect(res.status).toBe(200);
      expect(res.body.data.total_pathologists).toBe(2);
      expect(res.body.data.total_slides).toBe(2);
      expect(res.body.data.total_sessions).toBe(4); // 2 pathologists × 2 slides
      expect(res.body.data.completed_sessions).toBe(1);
      expect(res.body.data.progress_percentage).toBe(25);
    });

    it('returns 0% when nothing is completed', async () => {
      await createUserInDb('doc1', 'pass123', 'pathologist');
      await createTestSlide({ slide_id: 'empty_progress' });

      const res = await adminAgent.get('/api/admin/progress');
      expect(res.status).toBe(200);
      expect(res.body.data.completed_sessions).toBe(0);
      expect(res.body.data.progress_percentage).toBe(0);
    });
  });

  // ── POST /api/admin/users ─────────────────────────────────────

  describe('POST /api/admin/users', () => {
    it('creates a new pathologist (201)', async () => {
      const res = await adminAgent
        .post('/api/admin/users')
        .send({ username: 'newdoc', password: 'secure123' });

      expect(res.status).toBe(201);
      expect(res.body.data.user.username).toBe('newdoc');
      expect(res.body.data.user.role).toBe('pathologist');
    });

    it('returns 409 for duplicate username', async () => {
      await createUserInDb('existing', 'pass123', 'pathologist');

      const res = await adminAgent
        .post('/api/admin/users')
        .send({ username: 'existing', password: 'secure123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('returns 400 for short password', async () => {
      const res = await adminAgent
        .post('/api/admin/users')
        .send({ username: 'shortpw', password: 'abc' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('6 characters');
    });

    it('returns 400 for missing fields', async () => {
      const res = await adminAgent
        .post('/api/admin/users')
        .send({ username: 'nopw' });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/admin/sessions ───────────────────────────────────

  describe('GET /api/admin/sessions', () => {
    it('lists completed sessions', async () => {
      // Set up a completed session
      const doc = await createUserInDb('doc1', 'pass123', 'pathologist');
      await createTestSlide({ slide_id: 'sess_list' });
      const docAgent = request.agent(app);
      await loginAndGetCookie(docAgent, 'doc1', 'pass123');
      const startRes = await docAgent.post('/api/slides/sess_list/start');
      const sessionId = startRes.body.data.session_id;
      await docAgent
        .post(`/api/slides/sessions/${sessionId}/events`)
        .send({ events: [makeEvent()] });
      await docAgent
        .post(`/api/slides/sessions/${sessionId}/complete`)
        .send({ label: 'non-neoplastic' });

      const res = await adminAgent.get('/api/admin/sessions');
      expect(res.status).toBe(200);
      expect(res.body.data.sessions).toHaveLength(1);
      expect(res.body.data.sessions[0].label).toBe('non-neoplastic');
      expect(res.body.data.sessions[0].event_count).toBe(1);
    });

    it('filters by user_id', async () => {
      const doc1 = await createUserInDb('doc1', 'pass123', 'pathologist');
      const doc2 = await createUserInDb('doc2', 'pass456', 'pathologist');
      await createTestSlide({ slide_id: 'filter_s1' });
      await createTestSlide({ slide_id: 'filter_s2' });

      // doc1 completes slide1
      const docAgent1 = request.agent(app);
      await loginAndGetCookie(docAgent1, 'doc1', 'pass123');
      const s1 = await docAgent1.post('/api/slides/filter_s1/start');
      await docAgent1
        .post(`/api/slides/sessions/${s1.body.data.session_id}/events`)
        .send({ events: [makeEvent()] });
      await docAgent1
        .post(`/api/slides/sessions/${s1.body.data.session_id}/complete`)
        .send({ label: 'low-grade' });

      // doc2 completes slide2
      const docAgent2 = request.agent(app);
      await loginAndGetCookie(docAgent2, 'doc2', 'pass456');
      const s2 = await docAgent2.post('/api/slides/filter_s2/start');
      await docAgent2
        .post(`/api/slides/sessions/${s2.body.data.session_id}/events`)
        .send({ events: [makeEvent()] });
      await docAgent2
        .post(`/api/slides/sessions/${s2.body.data.session_id}/complete`)
        .send({ label: 'high-grade' });

      // Filter by doc1
      const res = await adminAgent.get(`/api/admin/sessions?user_id=${doc1.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.sessions).toHaveLength(1);
      expect(res.body.data.sessions[0].username).toBe('doc1');
    });
  });

  // ── GET /api/admin/sessions/:sessionId/events ─────────────────

  describe('GET /api/admin/sessions/:sessionId/events', () => {
    it('returns events for a session', async () => {
      await createUserInDb('doc1', 'pass123', 'pathologist');
      await createTestSlide({ slide_id: 'events_admin' });
      const docAgent = request.agent(app);
      await loginAndGetCookie(docAgent, 'doc1', 'pass123');
      const startRes = await docAgent.post('/api/slides/events_admin/start');
      const sessionId = startRes.body.data.session_id;
      await docAgent
        .post(`/api/slides/sessions/${sessionId}/events`)
        .send({ events: [makeEvent(), makeEvent({ event: 'zoom_step' })] });

      const res = await adminAgent.get(`/api/admin/sessions/${sessionId}/events`);
      expect(res.status).toBe(200);
      expect(res.body.data.session.id).toBe(sessionId);
      expect(res.body.data.events).toHaveLength(2);
    });

    it('returns 404 for unknown session', async () => {
      const res = await adminAgent.get('/api/admin/sessions/00000000-0000-0000-0000-000000000000/events');
      expect(res.status).toBe(404);
    });
  });

  // ── GET /api/admin/export/csv ─────────────────────────────────

  describe('GET /api/admin/export/csv', () => {
    it('returns CSV with correct headers', async () => {
      await createUserInDb('doc1', 'pass123', 'pathologist');
      await createTestSlide({ slide_id: 'csv_test', ground_truth: 'low-grade' });
      const docAgent = request.agent(app);
      await loginAndGetCookie(docAgent, 'doc1', 'pass123');
      const startRes = await docAgent.post('/api/slides/csv_test/start');
      const sessionId = startRes.body.data.session_id;
      await docAgent
        .post(`/api/slides/sessions/${sessionId}/events`)
        .send({ events: [makeEvent()] });
      await docAgent
        .post(`/api/slides/sessions/${sessionId}/complete`)
        .send({ label: 'low-grade' });

      const res = await adminAgent.get('/api/admin/export/csv');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const lines = res.text.split('\n');
      // Header row
      expect(lines[0]).toContain('ts_iso8601');
      expect(lines[0]).toContain('session_id');
      expect(lines[0]).toContain('user_id');
      expect(lines[0]).toContain('ground_truth');
      // At least one data row
      expect(lines.length).toBeGreaterThanOrEqual(2);
    });

    it('returns 404 when no events exist', async () => {
      const res = await adminAgent.get('/api/admin/export/csv');
      expect(res.status).toBe(404);
    });
  });
});
