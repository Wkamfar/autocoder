/**
 * Authentication Routes
 * 
 * All authentication and authorization endpoints
 */

import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/connection';
import { getRedis } from '../db/redis';
import { jwtService } from '../auth/jwt';
import { passwordService } from '../auth/password';
import { mfaService } from '../auth/mfa';
import { authenticate, AuthRequest, requireMFA } from '../auth/middleware';
import { rateLimiters } from '../auth/rateLimit';
import { generateDeviceFingerprint, isValidIP } from '../auth/deviceFingerprint';
import { setCSRFToken } from '../auth/csrf';
import { logger } from '../utils/logger';
import * as speakeasy from 'speakeasy';

const router = Router();

// Constants
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post(
  '/login',
  rateLimiters.login,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, mfaToken } = req.body;

      // Validation
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password required' });
        return;
      }

      const db = getDatabase();
      const redis = getRedis();

      // Get user
      const userResult = await db.query(
        `SELECT id, org_id, email, password_hash, role, mfa_enabled, mfa_secret, 
                failed_login_attempts, locked_until, name
         FROM users 
         WHERE email = $1`,
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        // Don't reveal if user exists (security best practice)
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay to prevent timing attacks
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const user = userResult.rows[0];

      // Check if account is locked
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const lockoutMinutes = Math.ceil(
          (new Date(user.locked_until).getTime() - Date.now()) / (1000 * 60)
        );
        res.status(403).json({
          error: 'Account locked',
          message: `Account is locked. Try again in ${lockoutMinutes} minutes.`,
          lockedUntil: user.locked_until,
        });
        return;
      }

      // Verify password
      const passwordValid = await passwordService.verifyPassword(password, user.password_hash);
      if (!passwordValid) {
        // Increment failed attempts
        const newFailedAttempts = user.failed_login_attempts + 1;
        const shouldLock = newFailedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

        await db.query(
          `UPDATE users 
           SET failed_login_attempts = $1, 
               locked_until = $2
           WHERE id = $3`,
          [
            newFailedAttempts,
            shouldLock
              ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
              : null,
            user.id,
          ]
        );

        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Check MFA if enabled
      if (user.mfa_enabled) {
        if (!mfaToken) {
          res.status(403).json({
            error: 'MFA token required',
            code: 'MFA_REQUIRED',
            mfaEnabled: true,
          });
          return;
        }

        const mfaResult = mfaService.verifyToken(mfaToken, user.mfa_secret);
        if (!mfaResult.valid) {
          res.status(401).json({ error: 'Invalid MFA token' });
          return;
        }
      }

      // Reset failed attempts on successful login
      await db.query(
        `UPDATE users 
         SET failed_login_attempts = 0, 
             locked_until = NULL,
             last_login_at = NOW()
         WHERE id = $1`,
        [user.id]
      );

      // Generate device fingerprint
      const deviceFingerprint = generateDeviceFingerprint(req);
      const clientIP = deviceFingerprint.components.ip;

      // Validate IP
      if (!isValidIP(clientIP) && clientIP !== 'unknown') {
        logger.warn('Invalid IP address detected', { ip: clientIP, email });
      }

      // Generate tokens
      const sessionId = require('crypto').randomUUID();
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        orgId: user.org_id,
        sessionId,
      };

      const tokenPair = jwtService.generateTokenPair(tokenPayload);

      // Store session in Redis
      const sessionData = {
        userId: user.id,
        tokenHash: jwtService.hashToken(tokenPair.accessToken),
        refreshTokenHash: jwtService.hashToken(tokenPair.refreshToken),
        ipAddress: clientIP,
        userAgent: req.get('user-agent'),
        deviceFingerprint: deviceFingerprint.fingerprint,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      };

      await redis.setSession(
        `session:${sessionId}`,
        JSON.stringify(sessionData),
        SESSION_DURATION_SECONDS
      );

      // Store refresh token mapping
      await redis.setSession(
        `refresh:${jwtService.hashToken(tokenPair.refreshToken)}`,
        sessionId,
        SESSION_DURATION_SECONDS
      );

      // Generate CSRF token
      const csrfToken = await setCSRFToken(req, res);

      logger.info('User logged in', {
        userId: user.id,
        email: user.email,
        ip: clientIP,
      });

      res.json({
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mfaEnabled: user.mfa_enabled,
        },
        csrfToken,
      });
    } catch (error) {
      logger.error('Login error', { error });
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

/**
 * POST /api/auth/logout
 * Invalidate session
 */
router.post('/logout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessionId = req.user!.sessionId;
    const redis = getRedis();

    // Delete session
    await redis.deleteSession(`session:${sessionId}`);

    // Delete refresh token mapping
    const token = req.headers.authorization?.substring(7);
    if (token) {
      const refreshTokenHash = jwtService.hashToken(token);
      await redis.deleteSession(`refresh:${refreshTokenHash}`);
    }

    logger.info('User logged out', { userId: req.userId });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error', { error });
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    // Verify refresh token
    let payload;
    try {
      payload = jwtService.verifyRefreshToken(refreshToken);
    } catch (error: any) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const redis = getRedis();

    // Verify refresh token exists in Redis
    const refreshTokenHash = jwtService.hashToken(refreshToken);
    const sessionId = await redis.getSession(`refresh:${refreshTokenHash}`);

    if (!sessionId || sessionId !== payload.sessionId) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    // Verify session still exists
    const sessionData = await redis.getSession(`session:${payload.sessionId}`);
    if (!sessionData) {
      res.status(401).json({ error: 'Session expired' });
      return;
    }

    // Generate new access token
    const newAccessToken = jwtService.generateAccessToken(payload);

    // Update session with new token hash
    const session = JSON.parse(sessionData);
    session.tokenHash = jwtService.hashToken(newAccessToken);
    session.lastUsedAt = new Date().toISOString();

    await redis.setSession(
      `session:${payload.sessionId}`,
      JSON.stringify(session),
      SESSION_DURATION_SECONDS
    );

    logger.info('Token refreshed', { userId: payload.userId });

    res.json({
      accessToken: newAccessToken,
      expiresIn: 900, // 15 minutes
    });
  } catch (error) {
    logger.error('Token refresh error', { error });
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /api/auth/verify-session
 * Verify current session is valid
 */
router.post('/verify-session', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({
    valid: true,
    user: {
      id: req.user!.userId,
      email: req.user!.email,
      role: req.user!.role,
    },
  });
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const userResult = await db.query(
      `SELECT id, email, name, role, mfa_enabled, voice_enrolled, 
              created_at, last_login_at
       FROM users 
       WHERE id = $1`,
      [req.userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = userResult.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mfaEnabled: user.mfa_enabled,
      voiceEnrolled: user.voice_enrolled,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
    });
  } catch (error) {
    logger.error('Get user error', { error });
    res.status(500).json({ error: 'Failed to get user information' });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post(
  '/change-password',
  authenticate,
  requireMFA,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { currentPassword, newPassword, mfaToken } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: 'Current and new password required' });
        return;
      }

      // Validate password strength
      const strengthCheck = passwordService.validatePasswordStrength(newPassword);
      if (!strengthCheck.valid) {
        res.status(400).json({
          error: 'Password does not meet requirements',
          errors: strengthCheck.errors,
        });
        return;
      }

      const db = getDatabase();

      // Get user
      const userResult = await db.query(
        'SELECT password_hash, mfa_enabled, mfa_secret FROM users WHERE id = $1',
        [req.userId]
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const user = userResult.rows[0];

      // Verify current password
      const passwordValid = await passwordService.verifyPassword(
        currentPassword,
        user.password_hash
      );
      if (!passwordValid) {
        res.status(401).json({ error: 'Current password incorrect' });
        return;
      }

      // Verify MFA if enabled
      if (user.mfa_enabled) {
        if (!mfaToken) {
          res.status(403).json({ error: 'MFA token required' });
          return;
        }

        const mfaResult = mfaService.verifyToken(mfaToken, user.mfa_secret);
        if (!mfaResult.valid) {
          res.status(401).json({ error: 'Invalid MFA token' });
          return;
        }
      }

      // Hash new password
      const newPasswordHash = await passwordService.hashPassword(newPassword);

      // Update password
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
        newPasswordHash,
        req.userId,
      ]);

      logger.info('Password changed', { userId: req.userId });

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      logger.error('Change password error', { error });
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

/**
 * POST /api/auth/reset-password
 * Request password reset (sends email - placeholder)
 */
router.post(
  '/reset-password',
  rateLimiters.passwordReset,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({ error: 'Email required' });
        return;
      }

      const db = getDatabase();
      const userResult = await db.query('SELECT id FROM users WHERE email = $1', [
        email.toLowerCase(),
      ]);

      // Don't reveal if user exists (security best practice)
      if (userResult.rows.length > 0) {
        // TODO: Send password reset email
        // For now, just log it
        logger.info('Password reset requested', { email });
      }

      // Always return success (don't reveal if user exists)
      res.json({
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    } catch (error) {
      logger.error('Password reset error', { error });
      res.status(500).json({ error: 'Password reset failed' });
    }
  }
);

/**
 * POST /api/auth/enable-mfa
 * Enable MFA for user
 */
router.post('/enable-mfa', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    // Check if MFA already enabled
    const userResult = await db.query(
      'SELECT mfa_enabled, mfa_secret FROM users WHERE id = $1',
      [req.userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = userResult.rows[0];

    if (user.mfa_enabled) {
      res.status(400).json({ error: 'MFA already enabled' });
      return;
    }

    // Generate MFA secret
    const mfaSecret = mfaService.generateSecret(req.user!.email);
    const qrCodeUrl = await mfaService.generateQRCode(mfaSecret.qrCodeUrl);

    // Store secret temporarily (user must verify before enabling)
    const redis = getRedis();
    await redis.setCache(
      `mfa-pending:${req.userId}`,
      mfaSecret.secret,
      10 * 60 // 10 minutes
    );

    res.json({
      secret: mfaSecret.secret,
      qrCodeUrl,
      manualEntryKey: mfaSecret.manualEntryKey,
      message: 'Verify MFA token to enable',
    });
  } catch (error) {
    logger.error('Enable MFA error', { error });
    res.status(500).json({ error: 'Failed to enable MFA' });
  }
});

/**
 * POST /api/auth/verify-mfa
 * Verify MFA token and complete MFA setup
 */
router.post(
  '/verify-mfa',
  authenticate,
  rateLimiters.mfa,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ error: 'MFA token required' });
        return;
      }

      const redis = getRedis();
      const pendingSecret = await redis.getCache(`mfa-pending:${req.userId}`);

      if (!pendingSecret) {
        res.status(400).json({
          error: 'No pending MFA setup. Please start MFA enrollment again.',
        });
        return;
      }

      // Verify token
      const mfaResult = mfaService.verifyToken(token, pendingSecret);
      if (!mfaResult.valid) {
        res.status(401).json({ error: 'Invalid MFA token' });
        return;
      }

      // Enable MFA
      const db = getDatabase();
      await db.query('UPDATE users SET mfa_enabled = TRUE, mfa_secret = $1 WHERE id = $2', [
        pendingSecret,
        req.userId,
      ]);

      // Clear pending secret
      await redis.deleteCache(`mfa-pending:${req.userId}`);

      logger.info('MFA enabled', { userId: req.userId });

      res.json({ message: 'MFA enabled successfully' });
    } catch (error) {
      logger.error('Verify MFA error', { error });
      res.status(500).json({ error: 'Failed to verify MFA' });
    }
  }
);

export default router;
