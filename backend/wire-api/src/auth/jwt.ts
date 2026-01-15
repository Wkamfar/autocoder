/**
 * JWT Token Management
 * 
 * Enterprise-grade JWT token generation and validation with:
 * - Access token (short-lived)
 * - Refresh token (long-lived)
 * - Token rotation
 * - Secure token storage
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  orgId: string;
  sessionId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

class JWTService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET || 'change-me-in-production';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'change-me-in-production-refresh';
    this.accessTokenExpiry = process.env.JWT_EXPIRES_IN || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    if (this.accessTokenSecret === 'change-me-in-production' || 
        this.refreshTokenSecret === 'change-me-in-production-refresh') {
      logger.warn('Using default JWT secrets. Change in production!');
    }
  }

  /**
   * Generate access token (short-lived)
   */
  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'wire2-api',
      audience: 'wire2-client',
    });
  }

  /**
   * Generate refresh token (long-lived)
   */
  generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry,
      issuer: 'wire2-api',
      audience: 'wire2-client',
    });
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(payload: TokenPayload): TokenPair {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Parse expiry time
    const expiresIn = this.parseExpiry(this.accessTokenExpiry);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'wire2-api',
        audience: 'wire2-client',
      }) as TokenPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'wire2-api',
        audience: 'wire2-client',
      }) as TokenPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Hash token for storage (don't store tokens in plaintext)
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 900; // Default 15 minutes
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 900;
    }
  }
}

export const jwtService = new JWTService();
