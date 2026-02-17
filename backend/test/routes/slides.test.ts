import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { truncateAll } from '../helpers/db.js';
import { createUserInDb, loginAndGetCookie } from '../helpers/auth.js';
import { createTestSlide, makeEvent } from '../helpers/factories.js';

const app = createApp({ disableRateLimiting: true });

describe('Slide & session routes', () => {
  let agent: ReturnType<typeof request.agent>;
  let userId: string;

  beforeEach(async () => {
    await truncateAll();
    const user = await createUserInDb('pathologist1', 'pass123', 'pathologist');
    userId = user.id;
    agent = request.agent(app);
    await loginAndGetCookie(agent, 'pathologist1', 'pass123');
  });

  // ── GET /api/slides ───────────────────────────────────────────

  describe('GET /api/slides', () => {
    it('returns empty list when no slides exist', async () => {
      const res = await agent.get('/api/slides');
      expect(res.status).toBe(200);
      expect(res.body.data.slides).toEqual([]);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.completed).toBe(0);
    });

    it('returns slides with completion status', async () => {
      await createTestSlide({ slide_id: 'slide_A' });
      await createTestSlide({ slide_id: 'slide_B' });

      const res = await agent.get('/api/slides');
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.slides).toHaveLength(2);
      expect(res.body.data.slides[0].completed).toBe(false);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/slides');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/slides/:slideId/manifest ─────────────────────────

  describe('GET /api/slides/:slideId/manifest', () => {
    it('returns manifest for existing slide', async () => {
      await createTestSlide({ slide_id: 'manifest_test' });

      const res = await agent.get('/api/slides/manifest_test/manifest');
      expect(res.status).toBe(200);
      expect(res.body.data.manifest).toBeDefined();
      expect(res.body.data.manifest.slide_id).toBe('manifest_test');
      expect(res.body.data.manifest.level0_width).toBe(98304);
    });

    it('returns 404 for unknown slide', async () => {
      const res = await agent.get('/api/slides/nonexistent/manifest');
      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/slides/:slideId/start ───────────────────────────

  describe('POST /api/slides/:slideId/start', () => {
    it('creates a new session (attempt 1)', async () => {
      await createTestSlide({ slide_id: 'start_test' });

      const res = await agent.post('/api/slides/start_test/start');
      expect(res.status).toBe(200);
      expect(res.body.data.session_id).toBeDefined();
      expect(res.body.data.viewing_attempt).toBe(1);
    });

    it('resumes an existing incomplete session', async () => {
      await createTestSlide({ slide_id: 'resume_test' });

      const first = await agent.post('/api/slides/resume_test/start');
      expect(first.status).toBe(200);
      const sessionId = first.body.data.session_id;

      // Immediately calling start again → same session, same attempt (within 60s threshold)
      const second = await agent.post('/api/slides/resume_test/start');
      expect(second.status).toBe(200);
      expect(second.body.data.session_id).toBe(sessionId);
      expect(second.body.data.viewing_attempt).toBe(1);
    });

    it('returns 404 for unknown slide', async () => {
      const res = await agent.post('/api/slides/nonexistent/start');
      expect(res.status).toBe(404);
    });

    it('returns 400 if session is already completed', async () => {
      const slide = await createTestSlide({ slide_id: 'completed_test' });

      // Start and complete
      const startRes = await agent.post('/api/slides/completed_test/start');
      const sessionId = startRes.body.data.session_id;

      await agent
        .post(`/api/slides/sessions/${sessionId}/events`)
        .send({ events: [makeEvent()] });

      await agent
        .post(`/api/slides/sessions/${sessionId}/complete`)
        .send({ label: 'low-grade' });

      // Try to start again
      const res = await agent.post('/api/slides/completed_test/start');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already completed');
    });
  });

  // ── POST /api/sessions/:sessionId/events ──────────────────────

  describe('POST /api/slides/sessions/:sessionId/events', () => {
    let sessionId: string;

    beforeEach(async () => {
      await createTestSlide({ slide_id: 'events_test' });
      const res = await agent.post('/api/slides/events_test/start');
      sessionId = res.body.data.session_id;
    });

    it('inserts a batch of events', async () => {
      const events = [makeEvent(), makeEvent({ event: 'zoom_step', zoom_level: 20 })];

      const res = await agent
        .post(`/api/slides/sessions/${sessionId}/events`)
        .send({ events });

      expect(res.status).toBe(200);
      expect(res.body.data.inserted).toBe(2);
    });

    it('returns 400 for empty events array', async () => {
      const res = await agent
        .post(`/api/slides/sessions/${sessionId}/events`)
        .send({ events: [] });

      expect(res.status).toBe(400);
    });

    it('returns 404 when session belongs to another user', async () => {
      // Create another user and try to upload events to first user's session
      await createUserInDb('other_doc', 'pass123', 'pathologist');
      const otherAgent = request.agent(app);
      await loginAndGetCookie(otherAgent, 'other_doc', 'pass123');

      const res = await otherAgent
        .post(`/api/slides/sessions/${sessionId}/events`)
        .send({ events: [makeEvent()] });

      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/sessions/:sessionId/complete ────────────────────

  describe('POST /api/slides/sessions/:sessionId/complete', () => {
    let sessionId: string;

    beforeEach(async () => {
      await createTestSlide({ slide_id: 'complete_test' });
      const res = await agent.post('/api/slides/complete_test/start');
      sessionId = res.body.data.session_id;
    });

    it('completes with non-neoplastic label', async () => {
      const res = await agent
        .post(`/api/slides/sessions/${sessionId}/complete`)
        .send({ label: 'non-neoplastic' });
      expect(res.status).toBe(200);
      expect(res.body.data.session.label).toBe('non-neoplastic');
    });

    it('completes with low-grade label', async () => {
      const res = await agent
        .post(`/api/slides/sessions/${sessionId}/complete`)
        .send({ label: 'low-grade' });
      expect(res.status).toBe(200);
      expect(res.body.data.session.label).toBe('low-grade');
    });

    it('completes with high-grade label', async () => {
      const res = await agent
        .post(`/api/slides/sessions/${sessionId}/complete`)
        .send({ label: 'high-grade' });
      expect(res.status).toBe(200);
      expect(res.body.data.session.label).toBe('high-grade');
    });

    it('returns 400 for invalid label', async () => {
      const res = await agent
        .post(`/api/slides/sessions/${sessionId}/complete`)
        .send({ label: 'benign' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing label', async () => {
      const res = await agent
        .post(`/api/slides/sessions/${sessionId}/complete`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // ── Full lifecycle ────────────────────────────────────────────

  describe('Full session lifecycle', () => {
    it('start → upload events → complete', async () => {
      await createTestSlide({ slide_id: 'lifecycle_test' });

      // Start session
      const startRes = await agent.post('/api/slides/lifecycle_test/start');
      expect(startRes.status).toBe(200);
      const sessionId = startRes.body.data.session_id;

      // Upload events
      const events = [
        makeEvent({ event: 'slide_load' }),
        makeEvent({ event: 'cell_click', click_x0: 12345, click_y0: 67890 }),
        makeEvent({ event: 'zoom_step', zoom_level: 20 }),
      ];
      const eventsRes = await agent
        .post(`/api/slides/sessions/${sessionId}/events`)
        .send({ events });
      expect(eventsRes.status).toBe(200);
      expect(eventsRes.body.data.inserted).toBe(3);

      // Complete
      const completeRes = await agent
        .post(`/api/slides/sessions/${sessionId}/complete`)
        .send({ label: 'high-grade' });
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.session.label).toBe('high-grade');
      expect(completeRes.body.data.session.completed_at).toBeDefined();

      // Verify slide now shows as completed
      const slidesRes = await agent.get('/api/slides');
      const slide = slidesRes.body.data.slides.find((s: any) => s.slide_id === 'lifecycle_test');
      expect(slide.completed).toBe(true);
    });
  });
});
