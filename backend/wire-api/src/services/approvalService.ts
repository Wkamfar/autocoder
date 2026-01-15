/**
 * Approval Service
 * 
 * Core business logic for approval workflow
 * Handles maker-checker enforcement, voice verification, and approval signing
 */

import { getDatabase } from '../db/connection';
import { Approval, ApprovalStatus, DecisionType } from '../db/types';
import { logger } from '../utils/logger';
import { generateApprovalToken, verifyApprovalToken } from './approvalToken';
import { signApproval, verifyApprovalSignature } from './approvalSigning';
import { verifyVoiceProof } from './voiceIntegration';

export interface CreateApprovalInput {
  intentId: string;
  approverUserId: string;
  voiceProofId: string;
  decisionType: DecisionType;
  reasonCodes?: string[];
}

export interface ApprovalWithDetails extends Approval {
  intent?: any;
  approver?: any;
  voiceProof?: any;
}

class ApprovalService {
  /**
   * Get pending approvals for a user
   */
  async getPendingApprovals(userId: string, orgId: string): Promise<Approval[]> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT a.*, i.amount_minor, i.currency, i.purpose, i.status as intent_status,
              b.display_name as beneficiary_name, u.name as creator_name
       FROM approvals a
       INNER JOIN intents i ON a.intent_id = i.id
       LEFT JOIN beneficiaries b ON i.beneficiary_id = b.id
       LEFT JOIN users u ON i.created_by_user_id = u.id
       WHERE a.approver_user_id = $1
       AND a.status = 'PENDING'
       AND i.org_id = $2
       AND (a.expires_at IS NULL OR a.expires_at > NOW())
       ORDER BY a.created_at ASC`,
      [userId, orgId]
    );

    return result.rows;
  }

  /**
   * Get approval by ID
   */
  async getApproval(approvalId: string, orgId: string): Promise<ApprovalWithDetails | null> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT a.*, i.*, u.name as approver_name, u.email as approver_email
       FROM approvals a
       INNER JOIN intents i ON a.intent_id = i.id
       LEFT JOIN users u ON a.approver_user_id = u.id
       WHERE a.id = $1 AND i.org_id = $2`,
      [approvalId, orgId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Get approval history for an intent
   */
  async getApprovalHistory(intentId: string, orgId: string): Promise<Approval[]> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT a.*, u.name as approver_name, u.email as approver_email
       FROM approvals a
       INNER JOIN intents i ON a.intent_id = i.id
       LEFT JOIN users u ON a.approver_user_id = u.id
       WHERE a.intent_id = $1 AND i.org_id = $2
       ORDER BY a.created_at ASC`,
      [intentId, orgId]
    );

    return result.rows;
  }

  /**
   * Get approval status for an intent
   */
  async getApprovalStatus(intentId: string, orgId: string): Promise<any> {
    const db = getDatabase();

    // Get intent
    const intentResult = await db.query(
      'SELECT * FROM intents WHERE id = $1 AND org_id = $2',
      [intentId, orgId]
    );

    if (intentResult.rows.length === 0) {
      throw new Error('Intent not found');
    }

    const intent = intentResult.rows[0];

    // Get all approvals for this intent
    const approvalsResult = await db.query(
      `SELECT a.*, u.name as approver_name, u.email as approver_email
       FROM approvals a
       LEFT JOIN users u ON a.approver_user_id = u.id
       WHERE a.intent_id = $1
       ORDER BY a.created_at ASC`,
      [intentId]
    );

    const approvals = approvalsResult.rows;
    const completedApprovals = approvals.filter((a) => a.status === 'COMPLETED');
    const pendingApprovals = approvals.filter((a) => a.status === 'PENDING');
    const deniedApprovals = approvals.filter((a) => a.decision_type === 'DENY');

    return {
      required: intent.required_approvals,
      completed: completedApprovals.length,
      pending: pendingApprovals.length,
      denied: deniedApprovals.length,
      approvers: approvals.map((a) => ({
        userId: a.approver_user_id,
        name: a.approver_name,
        email: a.approver_email,
        status: a.status,
        decisionType: a.decision_type,
        completedAt: a.completed_at,
      })),
      canExecute: completedApprovals.length >= intent.required_approvals,
      hasDenial: deniedApprovals.length > 0,
    };
  }

  /**
   * Create approval request (when intent is submitted)
   */
  async createApprovalRequest(
    intentId: string,
    approverUserId: string,
    orgId: string
  ): Promise<Approval> {
    const db = getDatabase();

    // Get intent
    const intentResult = await db.query(
      'SELECT * FROM intents WHERE id = $1 AND org_id = $2',
      [intentId, orgId]
    );

    if (intentResult.rows.length === 0) {
      throw new Error('Intent not found');
    }

    const intent = intentResult.rows[0];

    // Cannot approve own intent
    if (intent.created_by_user_id === approverUserId) {
      throw new Error('Cannot approve own intent');
    }

    // Check if approval already exists
    const existingResult = await db.query(
      'SELECT * FROM approvals WHERE intent_id = $1 AND approver_user_id = $2',
      [intentId, approverUserId]
    );

    if (existingResult.rows.length > 0) {
      throw new Error('Approval request already exists');
    }

    // Generate approval token
    const approvalToken = generateApprovalToken(intentId, approverUserId);
    const approvalTokenHash = require('crypto')
      .createHash('sha256')
      .update(approvalToken)
      .digest('hex');

    // Set expiration (24 hours)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create approval
    const result = await db.query(
      `INSERT INTO approvals (
        id, intent_id, approver_user_id, status, approval_token_hash,
        expires_at, decision_hash, signature
      ) VALUES (
        gen_random_uuid(), $1, $2, 'PENDING', $3, $4, $5, $6
      ) RETURNING *`,
      [
        intentId,
        approverUserId,
        approvalTokenHash,
        expiresAt,
        '', // Will be set after signing
        '', // Will be set after signing
      ]
    );

    const approval = result.rows[0];

    // Sign approval
    const signature = await signApproval(approval, intent);
    const decisionHash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify({ approvalId: approval.id, intentId, approverUserId }))
      .digest('hex');

    await db.query(
      'UPDATE approvals SET signature = $1, decision_hash = $2 WHERE id = $3',
      [signature, decisionHash, approval.id]
    );

    logger.info('Approval request created', {
      approvalId: approval.id,
      intentId,
      approverUserId,
    });

    return { ...approval, signature, decision_hash: decisionHash };
  }

  /**
   * Approve intent
   */
  async approveIntent(
    approvalId: string,
    approverUserId: string,
    voiceProofId: string,
    orgId: string
  ): Promise<Approval> {
    const db = getDatabase();

    // Get approval
    const approval = await this.getApproval(approvalId, orgId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    // Verify approver matches
    if (approval.approver_user_id !== approverUserId) {
      throw new Error('Approver mismatch');
    }

    // Check if already completed
    if (approval.status === 'COMPLETED') {
      throw new Error('Approval already completed');
    }

    // Check expiration
    if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
      throw new Error('Approval expired');
    }

    // Get intent
    const intentResult = await db.query(
      'SELECT * FROM intents WHERE id = $1',
      [approval.intent_id]
    );

    if (intentResult.rows.length === 0) {
      throw new Error('Intent not found');
    }

    const intent = intentResult.rows[0];

    // Cannot approve own intent (double-check)
    if (intent.created_by_user_id === approverUserId) {
      throw new Error('Cannot approve own intent');
    }

    // Verify voice proof
    const voiceProofValid = await verifyVoiceProof(voiceProofId, approverUserId);
    if (!voiceProofValid.valid) {
      throw new Error(`Voice verification failed: ${voiceProofValid.reason}`);
    }

    // Check approval requirements
    const status = await this.getApprovalStatus(intent.id, orgId);
    if (status.completed >= intent.required_approvals) {
      throw new Error('Intent already has required approvals');
    }

    // Update approval
    const completedAt = new Date();
    const updateResult = await db.query(
      `UPDATE approvals 
       SET status = 'COMPLETED',
           decision_type = 'APPROVE',
           voice_proof_id = $1,
           completed_at = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [voiceProofId, completedAt, approvalId]
    );

    const updatedApproval = updateResult.rows[0];

    // Re-sign approval with updated data
    const signature = await signApproval(updatedApproval, intent);
    await db.query('UPDATE approvals SET signature = $1 WHERE id = $2', [
      signature,
      approvalId,
    ]);

    // Check if intent can be executed
    const newStatus = await this.getApprovalStatus(intent.id, orgId);
    if (newStatus.completed >= intent.required_approvals && !newStatus.hasDenial) {
      // Update intent status to APPROVED
      await db.query(
        `UPDATE intents 
         SET status = 'APPROVED',
             updated_at = NOW()
         WHERE id = $1`,
        [intent.id]
      );

      logger.info('Intent approved and ready for execution', {
        intentId: intent.id,
        approvalsCompleted: newStatus.completed,
        requiredApprovals: intent.required_approvals,
      });
    }

    logger.info('Intent approved', {
      approvalId,
      intentId: intent.id,
      approverUserId,
    });

    return { ...updatedApproval, signature };
  }

  /**
   * Deny intent
   */
  async denyIntent(
    approvalId: string,
    approverUserId: string,
    reasonCodes: string[],
    orgId: string
  ): Promise<Approval> {
    const db = getDatabase();

    // Get approval
    const approval = await this.getApproval(approvalId, orgId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    // Verify approver matches
    if (approval.approver_user_id !== approverUserId) {
      throw new Error('Approver mismatch');
    }

    // Check if already completed
    if (approval.status === 'COMPLETED') {
      throw new Error('Approval already completed');
    }

    // Check expiration
    if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
      throw new Error('Approval expired');
    }

    // Get intent
    const intentResult = await db.query(
      'SELECT * FROM intents WHERE id = $1',
      [approval.intent_id]
    );

    if (intentResult.rows.length === 0) {
      throw new Error('Intent not found');
    }

    const intent = intentResult.rows[0];

    // Update approval
    const completedAt = new Date();
    const updateResult = await db.query(
      `UPDATE approvals 
       SET status = 'COMPLETED',
           decision_type = 'DENY',
           reason_codes = $1,
           completed_at = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(reasonCodes), completedAt, approvalId]
    );

    const updatedApproval = updateResult.rows[0];

    // Re-sign approval with updated data
    const signature = await signApproval(updatedApproval, intent);
    await db.query('UPDATE approvals SET signature = $1 WHERE id = $2', [
      signature,
      approvalId,
    ]);

    // Deny intent (any denial blocks execution)
    await db.query(
      `UPDATE intents 
       SET status = 'DENIED',
           updated_at = NOW()
       WHERE id = $1`,
      [intent.id]
    );

    logger.info('Intent denied', {
      approvalId,
      intentId: intent.id,
      approverUserId,
      reasonCodes,
    });

    return { ...updatedApproval, signature };
  }

  /**
   * Request voice challenge for approval
   * This creates/retrieves a voice challenge for the approver
   */
  async requestVoiceChallenge(
    approvalId: string,
    approverUserId: string,
    orgId: string
  ): Promise<any> {
    const approval = await this.getApproval(approvalId, orgId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    // Verify approver matches
    if (approval.approver_user_id !== approverUserId) {
      throw new Error('Approver mismatch');
    }

    // Get intent
    const db = getDatabase();
    const intentResult = await db.query('SELECT * FROM intents WHERE id = $1', [
      approval.intent_id,
    ]);

    if (intentResult.rows.length === 0) {
      throw new Error('Intent not found');
    }

    const intent = intentResult.rows[0];

    // Call Voice Service to generate challenge
    // TODO: Replace with actual Voice Service call
    // const voiceService = getVoiceService();
    // const challenge = await voiceService.generateChallenge({
    //   userId: approverUserId,
    //   intentId: intent.id,
    //   level: intent.required_challenge_level,
    // });

    // For now, simulate challenge generation
    const challenge = {
      id: require('crypto').randomUUID(),
      intentId: intent.id,
      userId: approverUserId,
      level: intent.required_challenge_level,
      challengeText: `Please confirm approval for transfer of $${(intent.amount_minor / 100).toFixed(2)} to beneficiary`,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    };

    logger.info('Voice challenge requested', {
      approvalId,
      challengeId: challenge.id,
      approverUserId,
    });

    return challenge;
  }

  /**
   * Auto-create approval requests when intent is submitted
   */
  async createApprovalRequestsForIntent(intentId: string, orgId: string): Promise<void> {
    const db = getDatabase();

    // Get intent
    const intentResult = await db.query(
      'SELECT * FROM intents WHERE id = $1 AND org_id = $2',
      [intentId, orgId]
    );

    if (intentResult.rows.length === 0) {
      throw new Error('Intent not found');
    }

    const intent = intentResult.rows[0];

    // Get eligible approvers (users with APPROVER or ADMIN role, excluding creator)
    const approversResult = await db.query(
      `SELECT id FROM users 
       WHERE org_id = $1 
       AND role IN ('APPROVER', 'ADMIN')
       AND id != $2
       ORDER BY created_at ASC
       LIMIT $3`,
      [orgId, intent.created_by_user_id, intent.required_approvals]
    );

    const approvers = approversResult.rows;

    if (approvers.length < intent.required_approvals) {
      logger.warn('Not enough approvers available', {
        intentId,
        required: intent.required_approvals,
        available: approvers.length,
      });
    }

    // Create approval requests
    for (const approver of approvers) {
      try {
        await this.createApprovalRequest(intentId, approver.id, orgId);
      } catch (error) {
        logger.error('Failed to create approval request', {
          intentId,
          approverId: approver.id,
          error,
        });
      }
    }
  }
}

export const approvalService = new ApprovalService();
