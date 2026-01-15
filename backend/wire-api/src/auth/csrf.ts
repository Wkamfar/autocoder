/**
 * CSRF Protection Middleware
 * 
 * Protects against Cross-Site Request Forgery attacks
 * Uses double-submit cookie pattern
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getRedis } from '../db/redis';
import { logger } from '../utils/logger';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN';

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * CSRF protection middleware
 */
export async function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  // Skip CSRF for health checks
  if (req.path === '/health' || req.path.startsWith('/health/')) {
    next();
    return;
  }

  try {
    // Get token from header
    const headerToken = req.get(CSRF_HEADER_NAME);
    const cookieToken = (req as any).cookies?.[CSRF_COOKIE_NAME];

    if (!headerToken || !cookieToken) {
      res.status(403).json({
        error: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING',
      });
      return;
    }

    // Tokens must match
    if (headerToken !== cookieToken) {
      logger.warn('CSRF token mismatch', {
        ip: req.ip,
        path: req.path,
      });

      res.status(403).json({
        error: 'CSRF token mismatch',
        code: 'CSRF_TOKEN_MISMATCH',
      });
      return;
    }

    // Verify token exists in Redis (optional - for token revocation)
    const redis = getRedis();
    const tokenKey = `csrf:${cookieToken}`;
    const tokenExists = await redis.getCache(tokenKey);

    if (!tokenExists) {
      res.status(403).json({
        error: 'CSRF token invalid or expired',
        code: 'CSRF_TOKEN_INVALID',
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('CSRF protection error', { error });
    res.status(500).json({ error: 'CSRF validation error' });
  }
}

/**
 * Set CSRF token cookie
 */
export async function setCSRFToken(req: Request, res: Response): Promise<string> {
  const token = generateCSRFToken();

  // Store token in Redis (24 hour expiry)
  const redis = getRedis();
  await redis.setCache(`csrf:${token}`, '1', 24 * 60 * 60);

  // Set cookie
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  return token;
}
