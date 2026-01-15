/**
 * Duplicate Detection Service
 * 
 * Detects duplicate beneficiaries to prevent fraud
 */

import { getDatabase } from '../db/connection';
import { logger } from '../utils/logger';
import { decryptAccountNumber } from './encryption';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingBeneficiaryId?: string;
  similarity?: number;
}

/**
 * Check for duplicate beneficiary
 * Compares routing number and account number (last 4 digits + hash)
 */
export async function checkDuplicateBeneficiary(
  orgId: string,
  routingNumber: string,
  accountNumber: string
): Promise<DuplicateCheckResult> {
  const db = getDatabase();

  // Check by routing number and last 4 digits
  const last4 = accountNumber.slice(-4);
  const result = await db.query(
    `SELECT id, bank_account_last4, bank_routing_number
     FROM beneficiaries
     WHERE org_id = $1
     AND bank_routing_number = $2
     AND bank_account_last4 = $3
     AND status != 'PENDING_VERIFICATION'`,
    [orgId, routingNumber, last4]
  );

  if (result.rows.length === 0) {
    return { isDuplicate: false };
  }

  // If we found matches, decrypt and compare full account numbers
  // This is more secure than storing full account numbers
  for (const beneficiary of result.rows) {
    try {
      const decryptedAccount = await decryptAccountNumber(
        beneficiary.bank_account_number_encrypted
      );
      
      if (decryptedAccount === accountNumber) {
        return {
          isDuplicate: true,
          existingBeneficiaryId: beneficiary.id,
          similarity: 100,
        };
      }
    } catch (error) {
      logger.error('Error decrypting account for duplicate check', { error });
      // Continue checking other beneficiaries
    }
  }

  // Partial match (same routing + last 4, but different full account)
  // This could be a typo or similar account
  if (result.rows.length > 0) {
    return {
      isDuplicate: false, // Not exact duplicate, but similar
      existingBeneficiaryId: result.rows[0].id,
      similarity: 50, // Partial match
    };
  }

  return { isDuplicate: false };
}
