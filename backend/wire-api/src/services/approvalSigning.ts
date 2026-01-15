/**
 * Approval Signing Service
 * 
 * Cryptographically signs approvals for tamper-proof integrity
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Sign approval cryptographically
 */
export async function signApproval(approval: any, intent: any): Promise<string> {
  const signingKey = process.env.SIGNING_KEY || 'change-me-in-production';

  if (signingKey === 'change-me-in-production') {
    logger.warn('Using default signing key. Change in production!');
  }

  const payload = {
    approvalId: approval.id,
    intentId: approval.intent_id,
    approverUserId: approval.approver_user_id,
    decisionType: approval.decision_type,
    decisionHash: approval.decision_hash,
    voiceProofId: approval.voice_proof_id,
    completedAt: approval.completed_at,
    intentAmount: intent.amount_minor,
    intentBeneficiary: intent.beneficiary_id,
    intentBindingHash: intent.binding_hash,
  };

  const canonicalJson = JSON.stringify(payload, Object.keys(payload).sort());
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(canonicalJson)
    .digest('hex');

  return signature;
}

/**
 * Verify approval signature
 */
export async function verifyApprovalSignature(
  approval: any,
  intent: any
): Promise<boolean> {
  try {
    const expectedSignature = await signApproval(approval, intent);
    return approval.signature === expectedSignature;
  } catch (error) {
    logger.error('Signature verification failed', { error });
    return false;
  }
}
