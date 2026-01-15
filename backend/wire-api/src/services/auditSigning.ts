/**
 * Audit Signing Service
 * 
 * Cryptographic signing and verification of audit logs
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Get signing key from environment
 */
function getSigningKey(): string {
  const key = process.env.AUDIT_SIGNING_KEY || 'change-me-in-production-use-strong-random-key';
  
  if (key === 'change-me-in-production-use-strong-random-key') {
    logger.warn('Using default audit signing key. Change in production!');
  }

  return key;
}

/**
 * Calculate log hash
 */
export async function calculateLogHash(data: {
  action: string;
  actorId?: string;
  details: any;
  previousHash?: string | null;
  timestamp: Date;
}): Promise<string> {
  const payload = {
    action: data.action,
    actorId: data.actorId,
    details: data.details,
    previousHash: data.previousHash,
    timestamp: data.timestamp.toISOString(),
  };

  const canonicalJson = JSON.stringify(payload, Object.keys(payload).sort());
  const hash = crypto.createHash('sha256').update(canonicalJson).digest('hex');

  return hash;
}

/**
 * Sign audit log hash
 */
export async function signAuditLog(logHash: string): Promise<string> {
  const signingKey = getSigningKey();
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(logHash)
    .digest('hex');

  return signature;
}

/**
 * Verify audit log signature
 */
export async function verifyAuditLogSignature(
  logHash: string,
  signature: string
): Promise<boolean> {
  try {
    const expectedSignature = await signAuditLog(logHash);
    return signature === expectedSignature;
  } catch (error) {
    logger.error('Signature verification failed', { error });
    return false;
  }
}
