/**
 * Intent Service
 * 
 * Core business logic for wire transfer intents
 * Handles creation, validation, risk scoring, and lifecycle management
 */

import { getDatabase } from '../db/connection';
import { Intent, IntentStatus, RailsType, ChallengeLevel } from '../db/types';
import { logger } from '../utils/logger';
import { calculateRiskScore } from './riskScoring';
import { generateBindingHash, signIntent } from './cryptography';
import { validateAmount, checkAmountAggregation } from './validation';
import { enforceCooldown, checkCooldown } from './cooldown';
import { enforcePolicy } from './policy';

export interface CreateIntentInput {
  railsType: RailsType;
  amountMinor: number;
  currency: string;
  beneficiaryId: string;
  purpose: string;
}

export interface UpdateIntentInput {
  purpose?: string;
  beneficiaryId?: string;
}

export interface IntentWithDetails extends Intent {
  beneficiary?: any;
  creator?: any;
  approvalStatus?: any;
}

class IntentService {
  /**
   * Create a new intent
   */
  async createIntent(
    userId: string,
    orgId: string,
    input: CreateIntentInput
  ): Promise<Intent> {
    const db = getDatabase();

    // Validate amount
    const amountValidation = validateAmount(input.amountMinor, input.currency);
    if (!amountValidation.valid) {
      throw new Error(`Invalid amount: ${amountValidation.error}`);
    }

    // Check cooldown
    const cooldownCheck = await checkCooldown(userId, input.amountMinor);
    if (!cooldownCheck.allowed) {
      throw new Error(`Cooldown active. Try again after ${cooldownCheck.retryAfter}`);
    }

    // Get beneficiary and lock version
    const beneficiaryResult = await db.query(
      'SELECT id, version, status, org_id FROM beneficiaries WHERE id = $1 AND org_id = $2',
      [input.beneficiaryId, orgId]
    );

    if (beneficiaryResult.rows.length === 0) {
      throw new Error('Beneficiary not found');
    }

    const beneficiary = beneficiaryResult.rows[0];
    if (beneficiary.status !== 'ACTIVE') {
      throw new Error('Beneficiary is not active');
    }

    // Check amount aggregation (prevent splitting attacks)
    const aggregationCheck = await checkAmountAggregation(
      userId,
      beneficiary.id,
      input.amountMinor
    );
    if (!aggregationCheck.allowed) {
      throw new Error(
        `Amount aggregation limit exceeded. Total: ${aggregationCheck.totalAmount}, Limit: ${aggregationCheck.limit}`
      );
    }

    // Get user for risk scoring
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    const user = userResult.rows[0];

    // Calculate risk score
    const riskScore = await calculateRiskScore(input, beneficiary, user);

    // Determine required approvals and challenge level from policy
    const policyResult = await enforcePolicy(orgId, riskScore.score, input.amountMinor);
    const requiredApprovals = policyResult.requiredApprovals;
    const requiredChallengeLevel = policyResult.requiredChallengeLevel;

    // Generate binding hash
    const bindingHash = generateBindingHash({
      userId,
      beneficiaryId: input.beneficiaryId,
      beneficiaryVersion: beneficiary.version,
      amountMinor: input.amountMinor,
      railsType: input.railsType,
      timestamp: new Date().toISOString(),
    });

    // Create intent
    const intentResult = await db.query(
      `INSERT INTO intents (
        id, org_id, created_by_user_id, rails_type, amount_minor, currency,
        beneficiary_id, beneficiary_version, purpose, status, risk_score,
        risk_rationale_json, required_approvals, required_challenge_level,
        binding_hash
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', $9, $10, $11, $12, $13
      ) RETURNING *`,
      [
        orgId,
        userId,
        input.railsType,
        input.amountMinor,
        input.currency,
        input.beneficiaryId,
        beneficiary.version,
        input.purpose,
        riskScore.score,
        JSON.stringify(riskScore.rationale),
        requiredApprovals,
        requiredChallengeLevel,
        bindingHash,
      ]
    );

    const intent = intentResult.rows[0];

    // Note: Signature column will be added in a future migration
    // For now, intent signing is handled at the application level

    logger.info('Intent created', {
      intentId: intent.id,
      userId,
      amountMinor: input.amountMinor,
      riskScore: riskScore.score,
    });

    return intent;
  }

  /**
   * Get intent by ID
   */
  async getIntent(intentId: string, orgId: string): Promise<IntentWithDetails | null> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT i.*, 
              b.display_name as beneficiary_name,
              b.bank_account_last4,
              u.name as creator_name,
              u.email as creator_email
       FROM intents i
       LEFT JOIN beneficiaries b ON i.beneficiary_id = b.id
       LEFT JOIN users u ON i.created_by_user_id = u.id
       WHERE i.id = $1 AND i.org_id = $2`,
      [intentId, orgId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * List intents with filtering
   */
  async listIntents(
    orgId: string,
    filters: {
      status?: IntentStatus;
      userId?: string;
      beneficiaryId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ intents: Intent[]; total: number }> {
    const db = getDatabase();

    const conditions: string[] = ['i.org_id = $1'];
    const params: any[] = [orgId];
    let paramIndex = 2;

    if (filters.status) {
      conditions.push(`i.status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.userId) {
      conditions.push(`i.created_by_user_id = $${paramIndex}`);
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters.beneficiaryId) {
      conditions.push(`i.beneficiary_id = $${paramIndex}`);
      params.push(filters.beneficiaryId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM intents i WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get intents
    const intentsResult = await db.query(
      `SELECT i.* FROM intents i 
       WHERE ${whereClause}
       ORDER BY i.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      intents: intentsResult.rows,
      total,
    };
  }

  /**
   * Update intent (only DRAFT status)
   */
  async updateIntent(
    intentId: string,
    orgId: string,
    userId: string,
    input: UpdateIntentInput
  ): Promise<Intent> {
    const db = getDatabase();

    // Get intent
    const intent = await this.getIntent(intentId, orgId);
    if (!intent) {
      throw new Error('Intent not found');
    }

    // Only creator can update
    if (intent.created_by_user_id !== userId) {
      throw new Error('Only the creator can update this intent');
    }

    // Only DRAFT can be updated
    if (intent.status !== 'DRAFT') {
      throw new Error('Only DRAFT intents can be updated');
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.purpose !== undefined) {
      updates.push(`purpose = $${paramIndex}`);
      params.push(input.purpose);
      paramIndex++;
    }

    if (input.beneficiaryId !== undefined) {
      // Validate beneficiary and lock version
      const beneficiaryResult = await db.query(
        'SELECT id, version, status FROM beneficiaries WHERE id = $1 AND org_id = $2',
        [input.beneficiaryId, orgId]
      );

      if (beneficiaryResult.rows.length === 0) {
        throw new Error('Beneficiary not found');
      }

      const beneficiary = beneficiaryResult.rows[0];
      if (beneficiary.status !== 'ACTIVE') {
        throw new Error('Beneficiary is not active');
      }

      updates.push(`beneficiary_id = $${paramIndex}`);
      params.push(input.beneficiaryId);
      paramIndex++;

      updates.push(`beneficiary_version = $${paramIndex}`);
      params.push(beneficiary.version);
      paramIndex++;

      // Recalculate risk score if beneficiary changed
      const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
      const user = userResult.rows[0];
      const riskScore = await calculateRiskScore(
        { ...intent, beneficiaryId: input.beneficiaryId },
        beneficiary,
        user
      );

      updates.push(`risk_score = $${paramIndex}`);
      params.push(riskScore.score);
      paramIndex++;

      updates.push(`risk_rationale_json = $${paramIndex}`);
      params.push(JSON.stringify(riskScore.rationale));
      paramIndex++;
    }

    if (updates.length === 0) {
      return intent;
    }

    updates.push(`updated_at = NOW()`);
    params.push(intentId, orgId);

    const updateResult = await db.query(
      `UPDATE intents 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
       RETURNING *`,
      params
    );

    return updateResult.rows[0];
  }

  /**
   * Delete intent (only DRAFT status)
   */
  async deleteIntent(intentId: string, orgId: string, userId: string): Promise<void> {
    const db = getDatabase();

    const intent = await this.getIntent(intentId, orgId);
    if (!intent) {
      throw new Error('Intent not found');
    }

    // Only creator can delete
    if (intent.created_by_user_id !== userId) {
      throw new Error('Only the creator can delete this intent');
    }

    // Only DRAFT can be deleted
    if (intent.status !== 'DRAFT') {
      throw new Error('Only DRAFT intents can be deleted');
    }

    await db.query('DELETE FROM intents WHERE id = $1 AND org_id = $2', [intentId, orgId]);

    logger.info('Intent deleted', { intentId, userId });
  }

  /**
   * Submit intent for approval
   */
  async submitIntent(intentId: string, orgId: string, userId: string): Promise<Intent> {
    const db = getDatabase();

    const intent = await this.getIntent(intentId, orgId);
    if (!intent) {
      throw new Error('Intent not found');
    }

    // Only creator can submit
    if (intent.created_by_user_id !== userId) {
      throw new Error('Only the creator can submit this intent');
    }

    // Only DRAFT can be submitted
    if (intent.status !== 'DRAFT') {
      throw new Error(`Intent is already ${intent.status}`);
    }

    // Validate beneficiary is still active
    const beneficiaryResult = await db.query(
      'SELECT status FROM beneficiaries WHERE id = $1',
      [intent.beneficiary_id]
    );

    if (beneficiaryResult.rows.length === 0 || beneficiaryResult.rows[0].status !== 'ACTIVE') {
      throw new Error('Beneficiary is not active');
    }

    // Enforce cooldown
    await enforceCooldown(userId, intent.amount_minor, intent.risk_score);

    // Update status
    const result = await db.query(
      `UPDATE intents 
       SET status = 'PENDING_APPROVALS',
           submitted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND org_id = $2
       RETURNING *`,
      [intentId, orgId]
    );

    // Create approval requests for eligible approvers
    const { approvalService } = require('./approvalService');
    await approvalService.createApprovalRequestsForIntent(intentId, orgId);

    logger.info('Intent submitted', { intentId, userId });

    return result.rows[0];
  }

  /**
   * Cancel intent
   */
  async cancelIntent(intentId: string, orgId: string, userId: string): Promise<Intent> {
    const db = getDatabase();

    const intent = await this.getIntent(intentId, orgId);
    if (!intent) {
      throw new Error('Intent not found');
    }

    // Only creator can cancel
    if (intent.created_by_user_id !== userId) {
      throw new Error('Only the creator can cancel this intent');
    }

    // Can only cancel DRAFT or PENDING_PROOF
    if (!['DRAFT', 'PENDING_PROOF'].includes(intent.status)) {
      throw new Error(`Cannot cancel intent with status ${intent.status}`);
    }

    const result = await db.query(
      `UPDATE intents 
       SET status = 'CANCELED',
           updated_at = NOW()
       WHERE id = $1 AND org_id = $2
       RETURNING *`,
      [intentId, orgId]
    );

    logger.info('Intent canceled', { intentId, userId });

    return result.rows[0];
  }

  /**
   * Get risk assessment for intent
   */
  async getRiskAssessment(intentId: string, orgId: string): Promise<any> {
    const intent = await this.getIntent(intentId, orgId);
    if (!intent) {
      throw new Error('Intent not found');
    }

    return {
      riskScore: intent.risk_score,
      rationale: intent.risk_rationale_json,
      requiredApprovals: intent.required_approvals,
      requiredChallengeLevel: intent.required_challenge_level,
      recommendations: generateRecommendations(intent.risk_score),
    };
  }
}

function generateRecommendations(riskScore: number): string[] {
  const recommendations: string[] = [];

  if (riskScore >= 85) {
    recommendations.push('CRITICAL: Manual review required before approval');
    recommendations.push('Consider additional verification steps');
  } else if (riskScore >= 60) {
    recommendations.push('HIGH RISK: Dual approval required');
    recommendations.push('Verify beneficiary details');
  } else if (riskScore >= 30) {
    recommendations.push('MODERATE RISK: Standard approval process');
  } else {
    recommendations.push('LOW RISK: Standard processing');
  }

  return recommendations;
}

export const intentService = new IntentService();
