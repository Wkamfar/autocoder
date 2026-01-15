/**
 * Authentication Middleware
 * 
 * Express middleware for:
 * - JWT token validation
 * - Session verification
 * - User context injection
 * - Protected route access
 */

import { Request, Response, NextFunction } from 'express';
import { jwtService, TokenPayload } from './jwt';
import { getRedis } from '../db/redis';
import { getDatabase } from '../db/connection';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: TokenPayload;
  userId?: string;
  orgId?: string;
  role?: string;
}

/**
 * Extract token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Authentication middleware - validates JWT token
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Verify token
    let payload: TokenPayload;
    try {
      payload = jwtService.verifyAccessToken(token);
    } catch (error: any) {
      if (error.message === 'Token expired') {
        res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        return;
      }
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    // Verify session exists in Redis
    const redis = getRedis();
    const tokenHash = jwtService.hashToken(token);
    const sessionKey = `session:${payload.sessionId}`;
    const sessionData = await redis.getSession(sessionKey);

    if (!sessionData) {
      res.status(401).json({ error: 'Session expired or invalid' });
      return;
    }

    // Verify session token hash matches
    const session = JSON.parse(sessionData);
    if (session.tokenHash !== tokenHash) {
      res.status(401).json({ error: 'Session token mismatch' });
      return;
    }

    // Check if user is locked
    const db = getDatabase();
    const userResult = await db.query(
      'SELECT locked_until FROM users WHERE id = $1',
      [payload.userId]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        res.status(403).json({ error: 'Account locked' });
        return;
      }
    }

    // Attach user context to request
    req.user = payload;
    req.userId = payload.userId;
    req.orgId = payload.orgId;
    req.role = payload.role;

    // Update session last used time
    await redis.setSession(
      sessionKey,
      JSON.stringify({ ...session, lastUsedAt: new Date().toISOString() }),
      7 * 24 * 60 * 60 // 7 days
    );

    next();
  } catch (error) {
    logger.error('Authentication middleware error', { error });
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuthenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const payload = jwtService.verifyAccessToken(token);
    req.user = payload;
    req.userId = payload.userId;
    req.orgId = payload.orgId;
    req.role = payload.role;
  } catch (error) {
    // Silently fail for optional auth
  }

  next();
}

/**
 * Role-based authorization middleware
 */
export function authorize(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !req.role) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Require MFA middleware
 */
export async function requireMFA(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const db = getDatabase();
  const userResult = await db.query(
    'SELECT mfa_enabled FROM users WHERE id = $1',
    [req.userId]
  );

  if (userResult.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const user = userResult.rows[0];
  if (!user.mfa_enabled) {
    res.status(403).json({ 
      error: 'MFA required',
      code: 'MFA_REQUIRED',
      message: 'Multi-factor authentication must be enabled for this action'
    });
    return;
  }

  next();
}
