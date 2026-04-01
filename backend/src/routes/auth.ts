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
      SELECT id, username, password_hash, role, must_change_password 
      FROM users 
      WHERE username = $1 OR email = $1
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
        role: user.role,
        must_change_password: user.must_change_password || false
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
          role: user.role,
          must_change_password: user.must_change_password || false
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

/**
 * POST /api/auth/change-password
 * Change password for logged-in users
 * Requires authentication (valid JWT)
 */
router.post('/change-password', async (req: Request, res: Response) => {
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
    
    const { currentPassword, newPassword } = req.body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Current password and new password are required' 
      });
    }
    
    // Validate new password: minimum 6 chars, at least 1 uppercase, 1 lowercase, 1 number
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      });
    }
    
    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must contain at least one uppercase letter' 
      });
    }
    
    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must contain at least one lowercase letter' 
      });
    }
    
    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must contain at least one number' 
      });
    }
    
    console.log(`[AUTH] Change password for user: ${decoded.username}`);
    
    // Get current user password hash
    const userQuery = `
      SELECT id, username, password_hash, role
      FROM users 
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [decoded.id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    const user = userResult.rows[0];
    
    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!passwordMatch) {
      console.log(`[AUTH] Invalid current password for user: ${decoded.username}`);
      return res.status(401).json({ 
        error: 'Current password is incorrect' 
      });
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Update password
    const updateQuery = `
      UPDATE users 
      SET password_hash = $1
      WHERE id = $2
      RETURNING id, username, role
    `;
    
    const result = await pool.query(updateQuery, [passwordHash, decoded.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    console.log(`[AUTH] Password changed successfully for user: ${user.username}`);
    
    res.json({
      data: {
        success: true,
        message: 'Password changed successfully'
      }
    });
    
  } catch (error) {
    console.error('[AUTH] Change password error:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        error: 'Invalid or expired token' 
      });
    }
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

/**
 * POST /api/auth/setup
 * First-login setup: set email and new password
 * Requires authentication (valid JWT with must_change_password=true)
 */
router.post('/setup', async (req: Request, res: Response) => {
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
    
    const { email, newPassword } = req.body;
    
    // Validate input
    if (!email || !newPassword) {
      return res.status(400).json({ 
        error: 'Email and new password are required' 
      });
    }
    
    // Validate email format (basic regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }
    
    // Validate password: minimum 6 chars, at least 1 uppercase, 1 lowercase, 1 number
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      });
    }
    
    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must contain at least one uppercase letter' 
      });
    }
    
    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must contain at least one lowercase letter' 
      });
    }
    
    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must contain at least one number' 
      });
    }
    
    console.log(`[AUTH] Setup for user: ${decoded.username}`);
    
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Update user
    const updateQuery = `
      UPDATE users 
      SET password_hash = $1, email = $2, must_change_password = false
      WHERE id = $3
      RETURNING id, username, role, email
    `;
    
    const result = await pool.query(updateQuery, [passwordHash, email, decoded.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    const user = result.rows[0];
    
    // Create new JWT token (without must_change_password flag)
    const newToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        must_change_password: false
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    
    // Set new httpOnly cookie
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    console.log(`[AUTH] Setup completed for user: ${user.username}`);
    
    res.json({
      data: {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email,
          must_change_password: false
        }
      }
    });
    
  } catch (error) {
    console.error('[AUTH] Setup error:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        error: 'Invalid or expired token' 
      });
    }
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

export default router;
