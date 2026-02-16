/**
 * Rate Limiting Middleware
 * Prevents brute force attacks and API abuse
 */

import rateLimit from 'express-rate-limit';

/**
 * Auth endpoints rate limiter
 * Limit: 5 login attempts per minute per IP address
 * Prevents brute force password attacks
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, // Max 5 requests per window
  message: { 
    error: 'Too many login attempts. Please try again later.' 
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip successful requests from counting against the limit
  skipSuccessfulRequests: false,
  // Skip failed requests (optional - we want to count all attempts)
  skipFailedRequests: false,
});

/**
 * General API rate limiter
 * Limit: 100 requests per minute per IP address
 * Prevents API abuse and excessive load
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // Max 100 requests per window
  message: { 
    error: 'Too many requests. Please slow down.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests from counting
  skipSuccessfulRequests: false,
});
