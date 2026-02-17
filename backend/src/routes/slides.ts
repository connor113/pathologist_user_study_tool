/**
 * Slide Management Routes
 * Slide listing, manifests, and session management
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import pool from '../db/index.js';

const router = Router();

// Apply authentication to all slide routes
router.use(authenticate);

/**
 * GET /api/slides
 * Get slide list for current user with completion status
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    console.log(`[API] Fetching slides for user: ${req.user!.username}`);
    
    // Get all slides with completion status for this user
    const slidesQuery = `
      SELECT 
        s.id,
        s.slide_id,
        s.s3_key_prefix,
        s.manifest_json,
        s.uploaded_at,
        CASE 
          WHEN sess.completed_at IS NOT NULL THEN true 
          ELSE false 
        END as completed,
        sess.id as session_id,
        sess.label,
        sess.started_at,
        sess.completed_at
      FROM slides s
      LEFT JOIN sessions sess ON s.id = sess.slide_id AND sess.user_id = $1
      ORDER BY s.uploaded_at ASC
    `;
    
    const result = await pool.query(slidesQuery, [userId]);
    
    const slides = result.rows.map(row => ({
      id: row.id,
      slide_id: row.slide_id,
      s3_key_prefix: row.s3_key_prefix,
      completed: row.completed,
      session_id: row.session_id,
      label: row.label,
      started_at: row.started_at,
      completed_at: row.completed_at
    }));
    
    // Count completed slides
    const completedCount = slides.filter(slide => slide.completed).length;
    
    console.log(`[API] Found ${slides.length} slides, ${completedCount} completed`);
    
    res.json({
      data: {
        slides,
        total: slides.length,
        completed: completedCount
      }
    });
    
  } catch (error) {
    console.error('[API] Error fetching slides:', error);
    res.status(500).json({ 
      error: 'Failed to fetch slides' 
    });
  }
});

/**
 * GET /api/slides/:slideId/manifest
 * Get slide manifest JSON
 */
router.get('/:slideId/manifest', async (req: Request, res: Response) => {
  try {
    const { slideId } = req.params;
    
    console.log(`[API] Fetching manifest for slide: ${slideId}`);
    
    // Get slide manifest from database
    const manifestQuery = `
      SELECT manifest_json 
      FROM slides 
      WHERE slide_id = $1
    `;
    
    const result = await pool.query(manifestQuery, [slideId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Slide not found' 
      });
    }
    
    const manifest = result.rows[0].manifest_json;
    
    console.log(`[API] Manifest found for slide: ${slideId}`);
    
    res.json({
      data: {
        manifest
      }
    });
    
  } catch (error) {
    console.error('[API] Error fetching manifest:', error);
    res.status(500).json({ 
      error: 'Failed to fetch manifest' 
    });
  }
});

/**
 * POST /api/slides/:slideId/start
 * Create new session for slide, or resume existing session with incremented attempt
 * 
 * Returns:
 * - session_id: UUID of the session
 * - viewing_attempt: Current viewing attempt number (1 = first time, 2+ = resumed)
 */
router.post('/:slideId/start', async (req: Request, res: Response) => {
  try {
    const { slideId } = req.params;
    const userId = req.user!.id;
    
    console.log(`[API] Starting session for slide: ${slideId}, user: ${req.user!.username}`);
    
    // Check if slide exists
    const slideQuery = `
      SELECT id FROM slides WHERE slide_id = $1
    `;
    
    const slideResult = await pool.query(slideQuery, [slideId]);
    
    if (slideResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Slide not found' 
      });
    }
    
    const slideDbId = slideResult.rows[0].id;
    
    // Check if session already exists
    const existingSessionQuery = `
      SELECT id, completed_at, current_attempt, last_started_at FROM sessions 
      WHERE user_id = $1 AND slide_id = $2
    `;
    
    const existingResult = await pool.query(existingSessionQuery, [userId, slideDbId]);
    
    if (existingResult.rows.length > 0) {
      const session = existingResult.rows[0];
      
      if (session.completed_at) {
        return res.status(400).json({ 
          error: 'Session already completed' 
        });
      }
      
      // Check if this is a new viewing attempt based on time since last start
      // Threshold: If session was last started more than 60 seconds ago, it's a new viewing attempt
      // This fixes the race condition where events haven't been uploaded yet
      const VIEWING_ATTEMPT_THRESHOLD_MS = 60 * 1000; // 60 seconds
      
      let currentAttempt = session.current_attempt || 1;
      let shouldIncrementAttempt = false;
      
      if (session.last_started_at) {
        const timeSinceLastStart = Date.now() - new Date(session.last_started_at).getTime();
        
        if (timeSinceLastStart > VIEWING_ATTEMPT_THRESHOLD_MS) {
          // It's been more than threshold since last start - this is a new viewing attempt
          shouldIncrementAttempt = true;
          currentAttempt += 1;
          console.log(`[API] New viewing attempt detected (${Math.round(timeSinceLastStart / 1000)}s since last start)`);
        } else {
          console.log(`[API] Same viewing attempt (only ${Math.round(timeSinceLastStart / 1000)}s since last start)`);
        }
      } else {
        // No last_started_at recorded yet (legacy session) - this is the first proper start
        console.log(`[API] Legacy session - setting initial start time`);
      }
      
      // Update session with new attempt (if incremented) and current timestamp
      const updateSessionQuery = `
        UPDATE sessions 
        SET current_attempt = $1, last_started_at = NOW() 
        WHERE id = $2
      `;
      await pool.query(updateSessionQuery, [currentAttempt, session.id]);
      
      console.log(`[API] Resuming session ${session.id}, attempt: ${currentAttempt}`);
      
      return res.json({
        data: {
          session_id: session.id,
          viewing_attempt: currentAttempt
        }
      });
    }
    
    // Create new session with attempt = 1 and set initial start time
    const sessionQuery = `
      INSERT INTO sessions (user_id, slide_id, current_attempt, last_started_at)
      VALUES ($1, $2, 1, NOW())
      RETURNING id, current_attempt
    `;
    
    const sessionResult = await pool.query(sessionQuery, [userId, slideDbId]);
    const sessionId = sessionResult.rows[0].id;
    const viewingAttempt = sessionResult.rows[0].current_attempt;
    
    console.log(`[API] Created new session: ${sessionId}, attempt: ${viewingAttempt}`);
    
    res.json({
      data: {
        session_id: sessionId,
        viewing_attempt: viewingAttempt
      }
    });
    
  } catch (error) {
    console.error('[API] Error starting session:', error);
    res.status(500).json({ 
      error: 'Failed to start session' 
    });
  }
});

/**
 * POST /api/sessions/:sessionId/events
 * Batch upload events for a session
 */
router.post('/sessions/:sessionId/events', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { events } = req.body;
    const userId = req.user!.id;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ 
        error: 'Events array is required' 
      });
    }
    
    console.log(`[API] Uploading ${events.length} events for session: ${sessionId}`);
    
    // Verify session belongs to user
    const sessionQuery = `
      SELECT id FROM sessions 
      WHERE id = $1 AND user_id = $2
    `;
    
    const sessionResult = await pool.query(sessionQuery, [sessionId, userId]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }
    
    // CRITICAL: Use transaction for atomicity and concurrency safety
    // This ensures all events are inserted together or none at all
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const columns = [
        'session_id', 'ts_iso8601', 'event', 'zoom_level', 'dzi_level',
        'click_x0', 'click_y0',  // Exact click coordinates
        'center_x0', 'center_y0', 'vbx0', 'vby0', 'vtx0', 'vty0',
        'container_w', 'container_h', 'dpr', 'app_version', 'label', 'notes',
        'viewing_attempt'  // Track which viewing attempt this event belongs to
      ];

      const values: any[] = [];
      const placeholders: string[] = [];

      events.forEach((event, index) => {
        const baseIndex = index * columns.length;
        const placeholder = columns
          .map((_, colIndex) => `$${baseIndex + colIndex + 1}`)
          .join(', ');
        placeholders.push(`(${placeholder})`);

        values.push(
          sessionId,
          event.ts_iso8601,
          event.event,
          event.zoom_level,
          event.dzi_level,
          event.click_x0 ?? null,  // Exact click X (only for cell_click)
          event.click_y0 ?? null,  // Exact click Y (only for cell_click)
          event.center_x0,
          event.center_y0,
          event.vbx0,
          event.vby0,
          event.vtx0,
          event.vty0,
          event.container_w,
          event.container_h,
          event.dpr,
          event.app_version,
          event.label ?? null,
          event.notes ?? null,
          event.viewing_attempt ?? 1  // Default to 1 for backwards compatibility
        );
      });

      const insertQuery = `
        INSERT INTO events (${columns.join(', ')})
        VALUES ${placeholders.join(', ')}
      `;

      await client.query(insertQuery, values);

      await client.query('COMMIT');
      console.log(`[API] Inserted ${events.length}/${events.length} events (transaction committed)`);
      
    } catch (eventError) {
      await client.query('ROLLBACK');
      console.error(`[API] Error inserting events, rolled back transaction:`, eventError);
      throw eventError; // Re-throw to be caught by outer catch
    } finally {
      client.release();
    }
    
    res.json({
      data: {
        inserted: events.length
      }
    });
    
  } catch (error) {
    console.error('[API] Error uploading events:', error);
    res.status(500).json({ 
      error: 'Failed to upload events' 
    });
  }
});

/**
 * POST /api/sessions/:sessionId/complete
 * Mark session as complete with label
 */
router.post('/sessions/:sessionId/complete', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { label } = req.body;
    const userId = req.user!.id;
    
    if (!label || !['non-neoplastic', 'low-grade', 'high-grade'].includes(label)) {
      return res.status(400).json({
        error: 'Valid label is required (non-neoplastic, low-grade, or high-grade)'
      });
    }
    
    console.log(`[API] Completing session: ${sessionId} with label: ${label}`);
    
    // Update session with completion
    const updateQuery = `
      UPDATE sessions 
      SET completed_at = CURRENT_TIMESTAMP, label = $1
      WHERE id = $2 AND user_id = $3
      RETURNING id, started_at, completed_at, label
    `;
    
    const result = await pool.query(updateQuery, [label, sessionId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }
    
    const session = result.rows[0];
    
    console.log(`[API] Session completed: ${sessionId}`);
    
    res.json({
      data: {
        session: {
          id: session.id,
          started_at: session.started_at,
          completed_at: session.completed_at,
          label: session.label
        }
      }
    });
    
  } catch (error) {
    console.error('[API] Error completing session:', error);
    res.status(500).json({ 
      error: 'Failed to complete session' 
    });
  }
});

export default router;
