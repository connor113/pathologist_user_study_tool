/**
 * Admin Routes
 * User management, progress monitoring, and CSV export
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.ts';
import pool from '../db/index.ts';

const router = Router();

// Apply authentication and admin role check to all admin routes
router.use(authenticate);
router.use(requireAdmin);

/**
 * GET /api/admin/users
 * List all pathologists with completion stats
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    console.log(`[ADMIN] Fetching user stats by: ${req.user!.username}`);
    
    const usersQuery = `
      SELECT 
        u.id,
        u.username,
        u.role,
        u.created_at,
        COUNT(s.id) as total_sessions,
        COUNT(CASE WHEN s.completed_at IS NOT NULL THEN 1 END) as completed_sessions
      FROM users u
      LEFT JOIN sessions s ON u.id = s.user_id
      WHERE u.role = 'pathologist'
      GROUP BY u.id, u.username, u.role, u.created_at
      ORDER BY u.created_at ASC
    `;
    
    const result = await pool.query(usersQuery);
    
    const users = result.rows.map(row => ({
      id: row.id,
      username: row.username,
      role: row.role,
      created_at: row.created_at,
      total_sessions: parseInt(row.total_sessions),
      completed_sessions: parseInt(row.completed_sessions)
    }));
    
    console.log(`[ADMIN] Found ${users.length} pathologists`);
    
    res.json({
      data: {
        users
      }
    });
    
  } catch (error) {
    console.error('[ADMIN] Error fetching users:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user stats' 
    });
  }
});

/**
 * GET /api/admin/progress
 * Get overall study progress statistics
 */
router.get('/progress', async (req: Request, res: Response) => {
  try {
    console.log(`[ADMIN] Fetching progress stats by: ${req.user!.username}`);
    
    // Get total pathologists
    const pathologistCountQuery = `
      SELECT COUNT(*) as count 
      FROM users 
      WHERE role = 'pathologist'
    `;
    
    // Get total slides
    const slideCountQuery = `
      SELECT COUNT(*) as count 
      FROM slides
    `;
    
    // Get total sessions (pathologists × slides)
    const totalSessionsQuery = `
      SELECT COUNT(*) as count 
      FROM users u
      CROSS JOIN slides s
      WHERE u.role = 'pathologist'
    `;
    
    // Get completed sessions
    const completedSessionsQuery = `
      SELECT COUNT(*) as count 
      FROM sessions 
      WHERE completed_at IS NOT NULL
    `;
    
    const [pathologistResult, slideResult, totalSessionsResult, completedResult] = await Promise.all([
      pool.query(pathologistCountQuery),
      pool.query(slideCountQuery),
      pool.query(totalSessionsQuery),
      pool.query(completedSessionsQuery)
    ]);
    
    const totalPathologists = parseInt(pathologistResult.rows[0].count);
    const totalSlides = parseInt(slideResult.rows[0].count);
    const totalSessions = parseInt(totalSessionsResult.rows[0].count);
    const completedSessions = parseInt(completedResult.rows[0].count);
    
    const progressPercentage = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
    
    console.log(`[ADMIN] Progress: ${completedSessions}/${totalSessions} (${progressPercentage}%)`);
    
    res.json({
      data: {
        total_pathologists: totalPathologists,
        total_slides: totalSlides,
        total_sessions: totalSessions,
        completed_sessions: completedSessions,
        progress_percentage: progressPercentage
      }
    });
    
  } catch (error) {
    console.error('[ADMIN] Error fetching progress:', error);
    res.status(500).json({ 
      error: 'Failed to fetch progress stats' 
    });
  }
});

/**
 * POST /api/admin/users
 * Create new pathologist account
 */
router.post('/users', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      });
    }
    
    console.log(`[ADMIN] Creating pathologist account: ${username}`);
    
    // Hash password
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Insert new user
    const insertQuery = `
      INSERT INTO users (username, password_hash, role)
      VALUES ($1, $2, 'pathologist')
      RETURNING id, username, role, created_at
    `;
    
    const result = await pool.query(insertQuery, [username, passwordHash]);
    const user = result.rows[0];
    
    console.log(`[ADMIN] Created pathologist: ${username} (${user.id})`);
    
    res.status(201).json({
      data: {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          created_at: user.created_at
        }
      }
    });
    
  } catch (error: any) {
    console.error('[ADMIN] Error creating user:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: 'Username already exists' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create user' 
    });
  }
});

/**
 * GET /api/admin/sessions
 * List completed sessions, optionally filtered by user
 * Query params: user_id (optional)
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;
    
    console.log(`[ADMIN] Fetching sessions${user_id ? ` for user ${user_id}` : ''}`);
    
    let sessionsQuery = `
      SELECT 
        sess.id,
        sess.user_id,
        u.username,
        sess.slide_id,
        s.slide_id as slide_name,
        sess.started_at,
        sess.completed_at,
        sess.label,
        (SELECT COUNT(*) FROM events e WHERE e.session_id = sess.id) as event_count
      FROM sessions sess
      JOIN users u ON sess.user_id = u.id
      JOIN slides s ON sess.slide_id = s.id
      WHERE sess.completed_at IS NOT NULL
    `;
    
    const params: any[] = [];
    
    if (user_id) {
      params.push(user_id);
      sessionsQuery += ` AND sess.user_id = $${params.length}`;
    }
    
    sessionsQuery += ` ORDER BY sess.completed_at DESC`;
    
    const result = await pool.query(sessionsQuery, params);
    
    const sessions = result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      username: row.username,
      slide_id: row.slide_id,
      slide_name: row.slide_name,
      started_at: row.started_at,
      completed_at: row.completed_at,
      label: row.label,
      event_count: parseInt(row.event_count)
    }));
    
    console.log(`[ADMIN] Found ${sessions.length} completed sessions`);
    
    res.json({
      data: {
        sessions
      }
    });
    
  } catch (error) {
    console.error('[ADMIN] Error fetching sessions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch sessions' 
    });
  }
});

/**
 * GET /api/admin/sessions/:sessionId/events
 * Get all events for a specific session (for replay)
 */
router.get('/sessions/:sessionId/events', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    console.log(`[ADMIN] Fetching events for session: ${sessionId}`);
    
    // First, get session metadata
    const sessionQuery = `
      SELECT 
        sess.id,
        sess.user_id,
        u.username,
        sess.slide_id as slide_uuid,
        s.slide_id as slide_name,
        s.manifest_json,
        sess.started_at,
        sess.completed_at,
        sess.label
      FROM sessions sess
      JOIN users u ON sess.user_id = u.id
      JOIN slides s ON sess.slide_id = s.id
      WHERE sess.id = $1
    `;
    
    const sessionResult = await pool.query(sessionQuery, [sessionId]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }
    
    const session = sessionResult.rows[0];
    
    // Get all events for this session, ordered by timestamp
    const eventsQuery = `
      SELECT 
        id,
        ts_iso8601,
        event,
        zoom_level,
        dzi_level,
        click_x0,
        click_y0,
        center_x0,
        center_y0,
        vbx0,
        vby0,
        vtx0,
        vty0,
        container_w,
        container_h,
        dpr,
        app_version,
        label,
        notes
      FROM events
      WHERE session_id = $1
      ORDER BY ts_iso8601 ASC
    `;
    
    const eventsResult = await pool.query(eventsQuery, [sessionId]);
    
    const events = eventsResult.rows.map(row => ({
      id: row.id,
      ts_iso8601: row.ts_iso8601,
      event: row.event,
      zoom_level: row.zoom_level ? parseFloat(row.zoom_level) : null,
      dzi_level: row.dzi_level,
      click_x0: row.click_x0 ? parseFloat(row.click_x0) : null,
      click_y0: row.click_y0 ? parseFloat(row.click_y0) : null,
      center_x0: row.center_x0 ? parseFloat(row.center_x0) : null,
      center_y0: row.center_y0 ? parseFloat(row.center_y0) : null,
      vbx0: row.vbx0 ? parseFloat(row.vbx0) : null,
      vby0: row.vby0 ? parseFloat(row.vby0) : null,
      vtx0: row.vtx0 ? parseFloat(row.vtx0) : null,
      vty0: row.vty0 ? parseFloat(row.vty0) : null,
      container_w: row.container_w,
      container_h: row.container_h,
      dpr: row.dpr ? parseFloat(row.dpr) : null,
      app_version: row.app_version,
      label: row.label,
      notes: row.notes
    }));
    
    console.log(`[ADMIN] Found ${events.length} events for session ${sessionId}`);
    
    res.json({
      data: {
        session: {
          id: session.id,
          user_id: session.user_id,
          username: session.username,
          slide_id: session.slide_uuid,
          slide_name: session.slide_name,
          manifest: session.manifest_json,
          started_at: session.started_at,
          completed_at: session.completed_at,
          label: session.label
        },
        events
      }
    });
    
  } catch (error) {
    console.error('[ADMIN] Error fetching session events:', error);
    res.status(500).json({ 
      error: 'Failed to fetch session events' 
    });
  }
});

/**
 * GET /api/admin/export/csv
 * Download all events as CSV
 */
router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    console.log(`[ADMIN] CSV export requested by: ${req.user!.username}`);
    
    // Get all events with user and session info
    const eventsQuery = `
      SELECT 
        e.ts_iso8601,
        e.session_id,
        u.username as user_id,
        s.slide_id,
        e.event,
        e.zoom_level,
        e.dzi_level,
        e.click_x0,
        e.click_y0,
        e.center_x0,
        e.center_y0,
        e.vbx0,
        e.vby0,
        e.vtx0,
        e.vty0,
        e.container_w,
        e.container_h,
        e.dpr,
        e.app_version,
        e.label,
        e.notes
      FROM events e
      JOIN sessions sess ON e.session_id = sess.id
      JOIN users u ON sess.user_id = u.id
      JOIN slides s ON sess.slide_id = s.id
      ORDER BY e.ts_iso8601 ASC
    `;
    
    const result = await pool.query(eventsQuery);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No events found' 
      });
    }
    
    // Generate CSV
    const headers = [
      'ts_iso8601', 'session_id', 'user_id', 'slide_id', 'event', 'zoom_level', 'dzi_level',
      'click_x0', 'click_y0', 'center_x0', 'center_y0', 'vbx0', 'vby0', 'vtx0', 'vty0',
      'container_w', 'container_h', 'dpr', 'app_version', 'label', 'notes'
    ];
    
    const csvRows = [
      headers.join(','),
      ...result.rows.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape CSV values
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ];
    
    const csv = csvRows.join('\n');
    
    console.log(`[ADMIN] Generated CSV with ${result.rows.length} events`);
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="pathology_events_${new Date().toISOString().split('T')[0]}.csv"`);
    
    res.send(csv);
    
  } catch (error) {
    console.error('[ADMIN] Error generating CSV:', error);
    res.status(500).json({ 
      error: 'Failed to generate CSV export' 
    });
  }
});

export default router;
