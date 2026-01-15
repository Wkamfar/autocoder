/**
 * Password Management
 * 
 * Secure password hashing and validation using bcrypt
 * Enterprise-grade password security
 */

import bcrypt from 'bcrypt';
import { logger } from '../utils/logger';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

class PasswordService {
  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    try {
      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      return hash;
    } catch (error) {
      logger.error('Password hashing failed', { error });
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Password verification failed', { error });
      return false;
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be less than 128 characters');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const passwordService = new PasswordService();
