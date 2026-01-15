/**
 * Validation Service
 * 
 * Validates intent data and prevents fraud
 */

import { getDatabase } from '../db/connection';
import { logger } from '../utils/logger';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate amount
 */
export function validateAmount(amountMinor: number, currency: string): ValidationResult {
  if (amountMinor <= 0) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }

  if (amountMinor > 10000000000) {
    // $100 million limit
    return { valid: false, error: 'Amount exceeds maximum limit' };
  }

  if (currency !== 'USD') {
    return { valid: false, error: 'Only USD currency is supported' };
  }

  return { valid: true };
}

/**
 * Check amount aggregation (prevent splitting attacks)
 * Users cannot send more than a threshold to the same beneficiary in a short time
 */
export async function checkAmountAggregation(
  userId: string,
  beneficiaryId: string,
  amountMinor: number
): Promise<{ allowed: boolean; totalAmount: number; limit: number; error?: string }> {
  const db = getDatabase();

  // Check total amount sent to this beneficiary in last 24 hours
  const result = await db.query(
    `SELECT COALESCE(SUM(amount_minor), 0) as total_amount
     FROM intents
     WHERE created_by_user_id = $1
     AND beneficiary_id = $2
     AND status IN ('DRAFT', 'PENDING_PROOF', 'CHALLENGING', 'PENDING_APPROVALS', 'APPROVED')
     AND created_at > NOW() - INTERVAL '24 hours'`,
    [userId, beneficiaryId]
  );

  const totalAmount = parseInt(result.rows[0].total_amount || '0');
  const newTotal = totalAmount + amountMinor;
  const limit = 50000000; // $500k limit per 24 hours

  if (newTotal > limit) {
    return {
      allowed: false,
      totalAmount: newTotal,
      limit,
      error: `Amount aggregation limit exceeded. Current total: $${totalAmount / 100}, Limit: $${limit / 100}`,
    };
  }

  return {
    allowed: true,
    totalAmount: newTotal,
    limit,
  };
}

/**
 * Validate beneficiary is active and belongs to org
 */
export async function validateBeneficiary(
  beneficiaryId: string,
  orgId: string
): Promise<{ valid: boolean; error?: string; beneficiary?: any }> {
  const db = getDatabase();

  const result = await db.query(
    'SELECT * FROM beneficiaries WHERE id = $1 AND org_id = $2',
    [beneficiaryId, orgId]
  );

  if (result.rows.length === 0) {
    return { valid: false, error: 'Beneficiary not found' };
  }

  const beneficiary = result.rows[0];

  if (beneficiary.status !== 'ACTIVE') {
    return { valid: false, error: `Beneficiary is ${beneficiary.status}` };
  }

  return { valid: true, beneficiary };
}

/**
 * Validate intent can be modified
 */
export function validateIntentModifiable(intent: any): ValidationResult {
  if (intent.status !== 'DRAFT') {
    return {
      valid: false,
      error: `Intent cannot be modified. Current status: ${intent.status}`,
    };
  }

  return { valid: true };
}
