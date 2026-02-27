/**
 * Authentication Routes
 * Login, logout, and user info endpoints
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db/index.js';

const router = Router();

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }
    
    console.log(`[AUTH] Login attempt for user: ${username}`);
    
    // Find user in database
    const userQuery = `
      SELECT id, username, password_hash, role 
      FROM users 
      WHERE username = $1
    `;
    
    const result = await pool.query(userQuery, [username]);
    
    if (result.rows.length === 0) {
      console.log(`[AUTH] User not found: ${username}`);
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      console.log(`[AUTH] Invalid password for user: ${username}`);
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }
    
    // Create JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    
    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    console.log(`[AUTH] Login successful for user: ${username} (${user.role})`);
    
    res.json({
      data: {
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      }
    });
    
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout and clear session cookie
 */
router.post('/logout', (req: Request, res: Response) => {
  try {
    // Clear the httpOnly cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none'
    });
    
    console.log('[AUTH] User logged out');
    
    res.json({
      data: {
        success: true
      }
    });
    
  } catch (error) {
    console.error('[AUTH] Logout error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires authentication)
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    // Get token from httpOnly cookie
    const token = req.cookies?.token;
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required' 
      });
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Get fresh user data from database
    const userQuery = `
      SELECT id, username, role, created_at 
      FROM users 
      WHERE id = $1
    `;
    
    const result = await pool.query(userQuery, [decoded.id]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'User not found' 
      });
    }
    
    const user = result.rows[0];
    
    res.json({
      data: {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          created_at: user.created_at
        }
      }
    });
    
  } catch (error) {
    console.error('[AUTH] Me endpoint error:', error);
    res.status(401).json({ 
      error: 'Invalid or expired token' 
    });
  }
});

export default router;
