/**
 * JWT Authentication Middleware
 * Verifies JWT tokens from httpOnly cookies
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: string;
      };
    }
  }
}

/**
 * JWT Authentication middleware
 * Verifies JWT token from httpOnly cookie and attaches user to request
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
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
    
    // Attach user info to request
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };
    
    console.log(`[AUTH] Authenticated user: ${req.user.username} (${req.user.role})`);
    next();
    
  } catch (error) {
    console.error('[AUTH] Token verification failed:', error);
    return res.status(401).json({ 
      error: 'Invalid or expired token' 
    });
  }
};

/**
 * Admin role middleware
 * Requires user to have admin role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required' 
    });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required' 
    });
  }
  
  next();
};

/**
 * Pathologist role middleware
 * Requires user to have pathologist role
 */
export const requirePathologist = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required' 
    });
  }
  
  if (req.user.role !== 'pathologist') {
    return res.status(403).json({ 
      error: 'Pathologist access required' 
    });
  }
  
  next();
};
