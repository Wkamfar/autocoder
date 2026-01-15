/**
 * Beneficiary Service
 * 
 * Core business logic for beneficiary management
 * Handles creation, validation, verification, and version control
 */

import { getDatabase } from '../db/connection';
import { Beneficiary, BeneficiaryStatus, RailsType } from '../db/types';
import { logger } from '../utils/logger';
import { encryptAccountNumber, decryptAccountNumber } from './encryption';
import { validateBankAccount, validateRoutingNumber } from './bankValidation';
import { checkDuplicateBeneficiary } from './duplicateDetection';
import { verifyBankAccount, initiateMicroDeposits, verifyMicroDeposits } from './bankVerification';
import { performKYCCheck, performSanctionsCheck } from './kycService';

export interface CreateBeneficiaryInput {
  displayName: string;
  country: string;
  railsAllowed: RailsType[];
  bankRoutingNumber: string;
  bankAccountNumber: string;
  accountType: string;
}

export interface UpdateBeneficiaryInput {
  displayName?: string;
  bankRoutingNumber?: string;
  bankAccountNumber?: string;
  accountType?: string;
}

export interface BeneficiaryWithDetails extends Beneficiary {
  transferCount?: number;
  totalAmount?: number;
  lastTransferDate?: Date;
}

class BeneficiaryService {
  /**
   * Create a new beneficiary
   */
  async createBeneficiary(
    userId: string,
    orgId: string,
    input: CreateBeneficiaryInput
  ): Promise<Beneficiary> {
    const db = getDatabase();

    // Validate bank account number
    const accountValidation = validateBankAccount(input.bankAccountNumber);
    if (!accountValidation.valid) {
      throw new Error(`Invalid account number: ${accountValidation.error}`);
    }

    // Validate routing number
    const routingValidation = validateRoutingNumber(input.bankRoutingNumber, input.country);
    if (!routingValidation.valid) {
      throw new Error(`Invalid routing number: ${routingValidation.error}`);
    }

    // Check for duplicates
    const duplicateCheck = await checkDuplicateBeneficiary(
      orgId,
      input.bankRoutingNumber,
      input.bankAccountNumber
    );
    if (duplicateCheck.isDuplicate) {
      throw new Error(
        `Duplicate beneficiary found: ${duplicateCheck.existingBeneficiaryId}`
      );
    }

    // Encrypt account number
    const encryptedAccountNumber = await encryptAccountNumber(input.bankAccountNumber);
    const last4 = input.bankAccountNumber.slice(-4);

    // Create beneficiary with PENDING_VERIFICATION status
    const result = await db.query(
      `INSERT INTO beneficiaries (
        id, org_id, display_name, country, rails_allowed,
        bank_routing_number, bank_account_number_encrypted, bank_account_last4,
        account_type, version, status, verification_status,
        last_changed_by
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 1,
        'PENDING_VERIFICATION', 'PENDING', $9
      ) RETURNING *`,
      [
        orgId,
        input.displayName,
        input.country,
        input.railsAllowed,
        input.bankRoutingNumber,
        encryptedAccountNumber,
        last4,
        input.accountType,
        userId,
      ]
    );

    const beneficiary = result.rows[0];

    // Store version history
    await db.query(
      `INSERT INTO beneficiary_versions (
        id, beneficiary_id, version, bank_account_number_encrypted, created_by
      ) VALUES (
        gen_random_uuid(), $1, 1, $2, $3
      )`,
      [beneficiary.id, encryptedAccountNumber, userId]
    );

    logger.info('Beneficiary created', {
      beneficiaryId: beneficiary.id,
      userId,
      orgId,
    });

    return beneficiary;
  }

  /**
   * Get beneficiary by ID
   */
  async getBeneficiary(
    beneficiaryId: string,
    orgId: string
  ): Promise<BeneficiaryWithDetails | null> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT b.*,
              COUNT(i.id) as transfer_count,
              COALESCE(SUM(CASE WHEN i.status = 'EXECUTED' THEN i.amount_minor ELSE 0 END), 0) as total_amount,
              MAX(CASE WHEN i.status = 'EXECUTED' THEN i.executed_at END) as last_transfer_date
       FROM beneficiaries b
       LEFT JOIN intents i ON b.id = i.beneficiary_id
       WHERE b.id = $1 AND b.org_id = $2
       GROUP BY b.id`,
      [beneficiaryId, orgId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * List beneficiaries with filtering
   */
  async listBeneficiaries(
    orgId: string,
    filters: {
      status?: BeneficiaryStatus;
      railsAllowed?: RailsType;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ beneficiaries: Beneficiary[]; total: number }> {
    const db = getDatabase();

    const conditions: string[] = ['b.org_id = $1'];
    const params: any[] = [orgId];
    let paramIndex = 2;

    if (filters.status) {
      conditions.push(`b.status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.railsAllowed) {
      conditions.push(`$${paramIndex} = ANY(b.rails_allowed)`);
      params.push(filters.railsAllowed);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM beneficiaries b WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get beneficiaries
    const beneficiariesResult = await db.query(
      `SELECT b.* FROM beneficiaries b 
       WHERE ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      beneficiaries: beneficiariesResult.rows,
      total,
    };
  }

  /**
   * Update beneficiary (creates new version if account number changes)
   */
  async updateBeneficiary(
    beneficiaryId: string,
    orgId: string,
    userId: string,
    input: UpdateBeneficiaryInput
  ): Promise<Beneficiary> {
    const db = getDatabase();

    // Get current beneficiary
    const currentResult = await db.query(
      'SELECT * FROM beneficiaries WHERE id = $1 AND org_id = $2',
      [beneficiaryId, orgId]
    );

    if (currentResult.rows.length === 0) {
      throw new Error('Beneficiary not found');
    }

    const current = currentResult.rows[0];

    // Check if account number is being changed
    let accountNumberChanged = false;
    let newEncryptedAccountNumber = current.bank_account_number_encrypted;
    let newLast4 = current.bank_account_last4;
    let newVersion = current.version;

    if (input.bankAccountNumber) {
      // Validate new account number
      const accountValidation = validateBankAccount(input.bankAccountNumber);
      if (!accountValidation.valid) {
        throw new Error(`Invalid account number: ${accountValidation.error}`);
      }

      // Check if different from current
      const currentDecrypted = await decryptAccountNumber(current.bank_account_number_encrypted);
      if (currentDecrypted !== input.bankAccountNumber) {
        accountNumberChanged = true;
        newEncryptedAccountNumber = await encryptAccountNumber(input.bankAccountNumber);
        newLast4 = input.bankAccountNumber.slice(-4);
        newVersion = current.version + 1;

        // Store new version
        await db.query(
          `INSERT INTO beneficiary_versions (
            id, beneficiary_id, version, bank_account_number_encrypted, created_by
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4
          )`,
          [beneficiaryId, newVersion, newEncryptedAccountNumber, userId]
        );
      }
    }

    // Validate routing number if provided
    if (input.bankRoutingNumber) {
      const routingValidation = validateRoutingNumber(
        input.bankRoutingNumber,
        current.country
      );
      if (!routingValidation.valid) {
        throw new Error(`Invalid routing number: ${routingValidation.error}`);
      }
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.displayName !== undefined) {
      updates.push(`display_name = $${paramIndex}`);
      params.push(input.displayName);
      paramIndex++;
    }

    if (input.bankRoutingNumber !== undefined) {
      updates.push(`bank_routing_number = $${paramIndex}`);
      params.push(input.bankRoutingNumber);
      paramIndex++;
    }

    if (accountNumberChanged) {
      updates.push(`bank_account_number_encrypted = $${paramIndex}`);
      params.push(newEncryptedAccountNumber);
      paramIndex++;

      updates.push(`bank_account_last4 = $${paramIndex}`);
      params.push(newLast4);
      paramIndex++;

      updates.push(`version = $${paramIndex}`);
      params.push(newVersion);
      paramIndex++;

      // Reset verification status when account number changes
      updates.push(`verification_status = 'PENDING'`);
      updates.push(`micro_deposit_verified = FALSE`);
    }

    if (input.accountType !== undefined) {
      updates.push(`account_type = $${paramIndex}`);
      params.push(input.accountType);
      paramIndex++;
    }

    if (updates.length === 0) {
      return current;
    }

    updates.push(`last_changed_at = NOW()`);
    updates.push(`last_changed_by = $${paramIndex}`);
    params.push(userId);
    paramIndex++;

    updates.push(`updated_at = NOW()`);
    params.push(beneficiaryId, orgId);

    const updateResult = await db.query(
      `UPDATE beneficiaries 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
       RETURNING *`,
      params
    );

    logger.info('Beneficiary updated', {
      beneficiaryId,
      userId,
      accountNumberChanged,
      newVersion: accountNumberChanged ? newVersion : undefined,
    });

    return updateResult.rows[0];
  }

  /**
   * Delete beneficiary
   */
  async deleteBeneficiary(beneficiaryId: string, orgId: string): Promise<void> {
    const db = getDatabase();

    // Check if beneficiary has any intents
    const intentsResult = await db.query(
      `SELECT COUNT(*) as count FROM intents 
       WHERE beneficiary_id = $1 
       AND status NOT IN ('CANCELED', 'DENIED')`,
      [beneficiaryId]
    );

    const intentCount = parseInt(intentsResult.rows[0].count || '0');
    if (intentCount > 0) {
      throw new Error(
        `Cannot delete beneficiary with ${intentCount} active intent(s)`
      );
    }

    await db.query('DELETE FROM beneficiaries WHERE id = $1 AND org_id = $2', [
      beneficiaryId,
      orgId,
    ]);

    logger.info('Beneficiary deleted', { beneficiaryId, orgId });
  }

  /**
   * Lock beneficiary
   */
  async lockBeneficiary(
    beneficiaryId: string,
    orgId: string,
    userId: string
  ): Promise<Beneficiary> {
    const db = getDatabase();

    const result = await db.query(
      `UPDATE beneficiaries 
       SET status = 'LOCKED',
           last_changed_at = NOW(),
           last_changed_by = $1,
           updated_at = NOW()
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      [userId, beneficiaryId, orgId]
    );

    if (result.rows.length === 0) {
      throw new Error('Beneficiary not found');
    }

    logger.info('Beneficiary locked', { beneficiaryId, userId });

    return result.rows[0];
  }

  /**
   * Unlock beneficiary
   */
  async unlockBeneficiary(
    beneficiaryId: string,
    orgId: string,
    userId: string
  ): Promise<Beneficiary> {
    const db = getDatabase();

    const result = await db.query(
      `UPDATE beneficiaries 
       SET status = 'ACTIVE',
           last_changed_at = NOW(),
           last_changed_by = $1,
           updated_at = NOW()
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      [userId, beneficiaryId, orgId]
    );

    if (result.rows.length === 0) {
      throw new Error('Beneficiary not found');
    }

    logger.info('Beneficiary unlocked', { beneficiaryId, userId });

    return result.rows[0];
  }

  /**
   * Verify bank account (initiates verification process)
   */
  async verifyAccount(beneficiaryId: string, orgId: string): Promise<any> {
    const beneficiary = await this.getBeneficiary(beneficiaryId, orgId);
    if (!beneficiary) {
      throw new Error('Beneficiary not found');
    }

    // 1. Real-time bank account verification (Plaid/Finicity)
    const verificationResult = await verifyBankAccount(beneficiary);
    if (!verificationResult.valid) {
      return {
        verified: false,
        reason: verificationResult.reason,
        details: verificationResult.details,
      };
    }

    // 2. KYC/Sanctions check
    const kycResult = await performKYCCheck(beneficiary);
    const sanctionsResult = await performSanctionsCheck(beneficiary);

    if (sanctionsResult.flagged) {
      const db = getDatabase();
      await db.query(
        `UPDATE beneficiaries 
         SET sanctions_check_status = 'FLAGGED',
             sanctions_check_date = NOW()
         WHERE id = $1`,
        [beneficiaryId]
      );

      return {
        verified: false,
        reason: 'SANCTIONS_FLAGGED',
        details: sanctionsResult,
      };
    }

    // 3. Initiate micro-deposits
    const microDeposits = await initiateMicroDeposits(beneficiary);

    // Update beneficiary status
    const db = getDatabase();
    await db.query(
      `UPDATE beneficiaries 
       SET verification_status = 'PENDING_MICRO_DEPOSIT',
           kyc_status = $1,
           kyc_expiry = $2,
           sanctions_check_status = $3,
           sanctions_check_date = NOW(),
           micro_deposit_amount1_cents = $4,
           micro_deposit_amount2_cents = $5
       WHERE id = $6`,
      [
        kycResult.status,
        kycResult.expiry,
        sanctionsResult.status,
        microDeposits.amount1,
        microDeposits.amount2,
        beneficiaryId,
      ]
    );

    return {
      verified: false, // Pending micro-deposit verification
      microDepositsInitiated: true,
      microDepositAmounts: {
        amount1: microDeposits.amount1,
        amount2: microDeposits.amount2,
      },
      kycStatus: kycResult.status,
      sanctionsStatus: sanctionsResult.status,
    };
  }

  /**
   * Verify micro-deposits
   */
  async verifyMicroDeposits(
    beneficiaryId: string,
    orgId: string,
    amounts: { amount1: number; amount2: number }
  ): Promise<Beneficiary> {
    const beneficiary = await this.getBeneficiary(beneficiaryId, orgId);
    if (!beneficiary) {
      throw new Error('Beneficiary not found');
    }

    if (!beneficiary.micro_deposit_amount1_cents || !beneficiary.micro_deposit_amount2_cents) {
      throw new Error('Micro-deposits not initiated');
    }

    const verificationResult = await verifyMicroDeposits(beneficiary, amounts);
    if (!verificationResult.verified) {
      throw new Error(`Micro-deposit verification failed: ${verificationResult.reason}`);
    }

    const db = getDatabase();
    const result = await db.query(
      `UPDATE beneficiaries 
       SET micro_deposit_verified = TRUE,
           verification_status = 'VERIFIED',
           status = 'ACTIVE',
           updated_at = NOW()
       WHERE id = $1 AND org_id = $2
       RETURNING *`,
      [beneficiaryId, orgId]
    );

    logger.info('Micro-deposits verified', { beneficiaryId });

    return result.rows[0];
  }

  /**
   * Get beneficiary intelligence
   */
  async getBeneficiaryIntelligence(
    beneficiaryId: string,
    orgId: string
  ): Promise<any> {
    const db = getDatabase();

    const beneficiary = await this.getBeneficiary(beneficiaryId, orgId);
    if (!beneficiary) {
      throw new Error('Beneficiary not found');
    }

    // Get transfer statistics
    const statsResult = await db.query(
      `SELECT 
         COUNT(*) as total_transfers,
         COUNT(CASE WHEN status = 'EXECUTED' THEN 1 END) as executed_transfers,
         COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved_transfers,
         COUNT(CASE WHEN status = 'DENIED' THEN 1 END) as denied_transfers,
         SUM(CASE WHEN status = 'EXECUTED' THEN amount_minor ELSE 0 END) as total_amount,
         AVG(CASE WHEN status = 'EXECUTED' THEN amount_minor END) as avg_amount,
         MAX(CASE WHEN status = 'EXECUTED' THEN executed_at END) as last_transfer_date,
         MIN(CASE WHEN status = 'EXECUTED' THEN executed_at END) as first_transfer_date
       FROM intents
       WHERE beneficiary_id = $1`,
      [beneficiaryId]
    );

    const stats = statsResult.rows[0];

    // Get risk score history
    const riskResult = await db.query(
      `SELECT risk_score, created_at
       FROM intents
       WHERE beneficiary_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [beneficiaryId]
    );

    return {
      beneficiary,
      statistics: {
        totalTransfers: parseInt(stats.total_transfers || '0'),
        executedTransfers: parseInt(stats.executed_transfers || '0'),
        approvedTransfers: parseInt(stats.approved_transfers || '0'),
        deniedTransfers: parseInt(stats.denied_transfers || '0'),
        totalAmount: parseInt(stats.total_amount || '0'),
        avgAmount: parseFloat(stats.avg_amount || '0'),
        lastTransferDate: stats.last_transfer_date,
        firstTransferDate: stats.first_transfer_date,
      },
      riskHistory: riskResult.rows,
      verificationStatus: {
        kycStatus: beneficiary.kyc_status,
        kycExpiry: beneficiary.kyc_expiry,
        sanctionsStatus: beneficiary.sanctions_check_status,
        sanctionsCheckDate: beneficiary.sanctions_check_date,
        microDepositVerified: beneficiary.micro_deposit_verified,
        verificationStatus: beneficiary.verification_status,
      },
    };
  }
}

export const beneficiaryService = new BeneficiaryService();
