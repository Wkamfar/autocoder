/**
 * Approval Token Service
 * 
 * Generates and validates approval tokens
 * Tokens are used to prevent replay attacks
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Generate approval token
 */
export function generateApprovalToken(intentId: string, approverUserId: string): string {
  const payload = {
    intentId,
    approverUserId,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const token = Buffer.from(JSON.stringify(payload)).toString('base64');
  return token;
}

/**
 * Verify approval token
 */
export function verifyApprovalToken(
  token: string,
  intentId: string,
  approverUserId: string
): { valid: boolean; error?: string } {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));

    if (payload.intentId !== intentId) {
      return { valid: false, error: 'Intent ID mismatch' };
    }

    if (payload.approverUserId !== approverUserId) {
      return { valid: false, error: 'Approver ID mismatch' };
    }

    // Check token age (24 hours max)
    const tokenAge = Date.now() - payload.timestamp;
    if (tokenAge > 24 * 60 * 60 * 1000) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true };
  } catch (error) {
    logger.error('Token verification failed', { error });
    return { valid: false, error: 'Invalid token format' };
  }
}

/**
 * Hash approval token for storage
 */
export function hashApprovalToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
