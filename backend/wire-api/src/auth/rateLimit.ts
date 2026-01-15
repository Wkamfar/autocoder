/**
 * Rate Limiting Middleware
 * 
 * Prevents brute force attacks and abuse
 * Uses Redis for distributed rate limiting
 */

import { Request, Response, NextFunction } from 'express';
import { getRedis } from '../db/redis';
import { logger } from '../utils/logger';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

/**
 * Create rate limit middleware
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = getRedis();
      const key = `ratelimit:${keyGenerator(req)}`;
      
      const result = await redis.checkRateLimit(
        key,
        maxRequests,
        Math.floor(windowMs / 1000) // Convert to seconds
      );

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());

      if (!result.allowed) {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          key,
        });

        res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil(windowMs / 1000)} seconds.`,
          retryAfter: Math.ceil(windowMs / 1000),
        });
        return;
      }

      // Track response status for skip options
      const originalSend = res.send;
      res.send = function (body) {
        const statusCode = res.statusCode;
        const shouldSkip = 
          (skipSuccessfulRequests && statusCode < 400) ||
          (skipFailedRequests && statusCode >= 400);

        if (shouldSkip) {
          // Decrement counter if we're skipping this request
          redis.getClient().decr(key).catch(() => {});
        }

        return originalSend.call(this, body);
      };

      next();
    } catch (error) {
      logger.error('Rate limit middleware error', { error });
      // On error, allow request through (fail open)
      next();
    }
  };
}

/**
 * Pre-configured rate limiters
 */
export const rateLimiters = {
  // Strict rate limit for login (5 attempts per 15 minutes)
  login: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyGenerator: (req) => `login:${req.ip || 'unknown'}`,
  }),

  // Standard API rate limit (100 requests per minute)
  api: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyGenerator: (req) => {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        // Rate limit per user if authenticated
        const token = authHeader.substring(7);
        const hash = require('crypto').createHash('sha256').update(token).digest('hex');
        return `api:${hash.substring(0, 16)}`;
      }
      return `api:${req.ip || 'unknown'}`;
    },
  }),

  // Password reset rate limit (3 attempts per hour)
  passwordReset: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    keyGenerator: (req) => `password-reset:${req.ip || 'unknown'}`,
  }),

  // MFA verification rate limit (10 attempts per 5 minutes)
  mfa: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10,
    keyGenerator: (req) => `mfa:${req.ip || 'unknown'}`,
  }),
};
