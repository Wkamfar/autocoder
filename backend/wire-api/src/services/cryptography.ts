/**
 * Cryptographic Service
 * 
 * Handles cryptographic operations for intents
 * - Binding hash generation
 * - Intent signing
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Generate binding hash for intent
 * Ensures intent cannot be tampered with
 */
export function generateBindingHash(data: {
  userId: string;
  beneficiaryId: string;
  beneficiaryVersion: number;
  amountMinor: number;
  railsType: string;
  timestamp: string;
}): string {
  const canonicalString = [
    data.userId,
    data.beneficiaryId,
    data.beneficiaryVersion.toString(),
    data.amountMinor.toString(),
    data.railsType,
    data.timestamp,
  ].join('|');

  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

/**
 * Sign intent cryptographically
 * Creates a signature that proves intent authenticity
 */
export async function signIntent(intent: any): Promise<string> {
  const signingKey = process.env.SIGNING_KEY || 'change-me-in-production';

  const payload = {
    id: intent.id,
    orgId: intent.org_id,
    userId: intent.created_by_user_id,
    amountMinor: intent.amount_minor,
    beneficiaryId: intent.beneficiary_id,
    beneficiaryVersion: intent.beneficiary_version,
    bindingHash: intent.binding_hash,
    createdAt: intent.created_at,
  };

  const canonicalJson = JSON.stringify(payload, Object.keys(payload).sort());
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(canonicalJson)
    .digest('hex');

  return signature;
}

/**
 * Verify intent signature
 */
export async function verifyIntentSignature(intent: any): Promise<boolean> {
  try {
    const expectedSignature = await signIntent(intent);
    return intent.signature === expectedSignature;
  } catch (error) {
    logger.error('Signature verification failed', { error });
    return false;
  }
}
