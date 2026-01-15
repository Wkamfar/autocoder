/**
 * Policy Service
 * 
 * Core business logic for policy management and evaluation
 */

import { getDatabase } from '../db/connection';
import { logger } from '../utils/logger';

export interface Policy {
  id: string;
  org_id: string;
  name: string;
  version: number;
  rules_json: any;
  risk_thresholds: RiskThresholds;
  approval_rules: ApprovalRules;
  active: boolean;
  created_at: Date;
  created_by: string;
  activated_at?: Date;
  activated_by?: string;
}

export interface RiskThresholds {
  very_low: number;  // 0-19
  low: number;        // 20-39
  medium: number;     // 40-59
  high: number;       // 60-79
  critical: number;   // 80-100
}

export interface ApprovalRules {
  required_approvals: {
    [key: string]: number;  // risk_level -> required_approvals
  };
  challenge_levels: {
    [key: string]: string;  // risk_level -> challenge_level (L1, L2, L3)
  };
  auto_approve?: {
    enabled: boolean;
    max_amount?: number;
    max_risk_score?: number;
  };
}

export interface PolicyEvaluationResult {
  policy_id: string;
  policy_version: number;
  risk_level: string;
  required_approvals: number;
  challenge_level: string;
  auto_approve: boolean;
  rules_applied: string[];
}

class PolicyService {
  /**
   * Get all policies for organization
   */
  async getPolicies(orgId: string, activeOnly: boolean = false): Promise<Policy[]> {
    const db = getDatabase();

    let query = 'SELECT * FROM policies WHERE org_id = $1';
    const params: any[] = [orgId];

    if (activeOnly) {
      query += ' AND active = TRUE';
    }

    query += ' ORDER BY name, version DESC';

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get policy by ID
   */
  async getPolicy(policyId: string, orgId: string): Promise<Policy | null> {
    const db = getDatabase();

    const result = await db.query(
      'SELECT * FROM policies WHERE id = $1 AND org_id = $2',
      [policyId, orgId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Get active policy for organization
   */
  async getActivePolicy(orgId: string): Promise<Policy | null> {
    const db = getDatabase();

    const result = await db.query(
      'SELECT * FROM policies WHERE org_id = $1 AND active = TRUE ORDER BY activated_at DESC LIMIT 1',
      [orgId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Create new policy
   */
  async createPolicy(
    orgId: string,
    userId: string,
    name: string,
    rules: any,
    riskThresholds: RiskThresholds,
    approvalRules: ApprovalRules
  ): Promise<Policy> {
    const db = getDatabase();

    // Get next version number
    const versionResult = await db.query(
      'SELECT MAX(version) as max_version FROM policies WHERE org_id = $1 AND name = $2',
      [orgId, name]
    );

    const nextVersion = (versionResult.rows[0]?.max_version || 0) + 1;

    // Create policy
    const result = await db.query(
      `INSERT INTO policies (
        id, org_id, name, version, rules_json, risk_thresholds, approval_rules,
        active, created_by, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, FALSE, $7, NOW()
      ) RETURNING *`,
      [
        orgId,
        name,
        nextVersion,
        JSON.stringify(rules),
        JSON.stringify(riskThresholds),
        JSON.stringify(approvalRules),
        userId,
      ]
    );

    logger.info('Policy created', {
      policyId: result.rows[0].id,
      name,
      version: nextVersion,
      userId,
    });

    return result.rows[0];
  }

  /**
   * Update policy (creates new version)
   */
  async updatePolicy(
    policyId: string,
    orgId: string,
    userId: string,
    updates: {
      rules?: any;
      riskThresholds?: RiskThresholds;
      approvalRules?: ApprovalRules;
    }
  ): Promise<Policy> {
    const db = getDatabase();

    // Get current policy
    const current = await this.getPolicy(policyId, orgId);
    if (!current) {
      throw new Error('Policy not found');
    }

    // Create new version
    const newVersion = current.version + 1;
    const newRules = updates.rules !== undefined ? updates.rules : current.rules_json;
    const newRiskThresholds = updates.riskThresholds !== undefined
      ? updates.riskThresholds
      : current.risk_thresholds;
    const newApprovalRules = updates.approvalRules !== undefined
      ? updates.approvalRules
      : current.approval_rules;

    const result = await db.query(
      `INSERT INTO policies (
        id, org_id, name, version, rules_json, risk_thresholds, approval_rules,
        active, created_by, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, FALSE, $7, NOW()
      ) RETURNING *`,
      [
        orgId,
        current.name,
        newVersion,
        JSON.stringify(newRules),
        JSON.stringify(newRiskThresholds),
        JSON.stringify(newApprovalRules),
        userId,
      ]
    );

    logger.info('Policy updated (new version)', {
      policyId: result.rows[0].id,
      name: current.name,
      version: newVersion,
      previousVersion: current.version,
      userId,
    });

    return result.rows[0];
  }

  /**
   * Get all versions of a policy
   */
  async getPolicyVersions(policyId: string, orgId: string): Promise<Policy[]> {
    const db = getDatabase();

    // Get policy name
    const policyResult = await db.query(
      'SELECT name FROM policies WHERE id = $1 AND org_id = $2',
      [policyId, orgId]
    );

    if (policyResult.rows.length === 0) {
      throw new Error('Policy not found');
    }

    const policyName = policyResult.rows[0].name;

    // Get all versions
    const result = await db.query(
      'SELECT * FROM policies WHERE org_id = $1 AND name = $2 ORDER BY version DESC',
      [orgId, policyName]
    );

    return result.rows;
  }

  /**
   * Activate policy version
   */
  async activatePolicyVersion(
    policyId: string,
    orgId: string,
    userId: string
  ): Promise<Policy> {
    const db = getDatabase();

    // Get policy
    const policy = await this.getPolicy(policyId, orgId);
    if (!policy) {
      throw new Error('Policy not found');
    }

    // Deactivate all other versions of this policy
    await db.query(
      `UPDATE policies 
       SET active = FALSE, activated_at = NULL, activated_by = NULL
       WHERE org_id = $1 AND name = $2 AND id != $3`,
      [orgId, policy.name, policyId]
    );

    // Activate this version
    const result = await db.query(
      `UPDATE policies 
       SET active = TRUE, activated_at = NOW(), activated_by = $1
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      [userId, policyId, orgId]
    );

    logger.info('Policy version activated', {
      policyId,
      name: policy.name,
      version: policy.version,
      userId,
    });

    return result.rows[0];
  }

  /**
   * Evaluate policy for an intent
   */
  async evaluatePolicy(
    orgId: string,
    riskScore: number,
    intentData: any
  ): Promise<PolicyEvaluationResult> {
    // Get active policy
    const policy = await this.getActivePolicy(orgId);
    if (!policy) {
      // Use default policy
      return this.getDefaultEvaluation(riskScore);
    }

    // Determine risk level
    const riskLevel = this.determineRiskLevel(riskScore, policy.risk_thresholds);

    // Get required approvals
    const requiredApprovals = policy.approval_rules.required_approvals[riskLevel] || 1;

    // Get challenge level
    const challengeLevel = policy.approval_rules.challenge_levels[riskLevel] || 'L1';

    // Check auto-approve rules
    let autoApprove = false;
    if (policy.approval_rules.auto_approve?.enabled) {
      const maxAmount = policy.approval_rules.auto_approve.max_amount || Infinity;
      const maxRisk = policy.approval_rules.auto_approve.max_risk_score || Infinity;

      if (intentData.amount_minor <= maxAmount && riskScore <= maxRisk) {
        autoApprove = true;
      }
    }

    // Apply custom rules
    const rulesApplied: string[] = [];
    if (policy.rules_json) {
      // Evaluate custom rules
      const customRules = this.evaluateCustomRules(policy.rules_json, intentData, riskScore);
      rulesApplied.push(...customRules);
    }

    return {
      policy_id: policy.id,
      policy_version: policy.version,
      risk_level: riskLevel,
      required_approvals: requiredApprovals,
      challenge_level: challengeLevel,
      auto_approve: autoApprove,
      rules_applied: rulesApplied,
    };
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(
    score: number,
    thresholds: RiskThresholds
  ): string {
    if (score >= thresholds.critical) {
      return 'CRITICAL';
    } else if (score >= thresholds.high) {
      return 'HIGH';
    } else if (score >= thresholds.medium) {
      return 'MEDIUM';
    } else if (score >= thresholds.low) {
      return 'LOW';
    } else {
      return 'VERY_LOW';
    }
  }

  /**
   * Evaluate custom rules
   */
  private evaluateCustomRules(
    rules: any,
    intentData: any,
    riskScore: number
  ): string[] {
    const applied: string[] = [];

    if (!rules || typeof rules !== 'object') {
      return applied;
    }

    // Example rule evaluation
    if (rules.require_mfa_for_high_risk && riskScore >= 60) {
      applied.push('REQUIRE_MFA_FOR_HIGH_RISK');
    }

    if (rules.block_international_after_hours) {
      const hour = new Date(intentData.created_at).getHours();
      if (hour < 9 || hour >= 17) {
        // Check if international
        // This would need beneficiary country check
        applied.push('BLOCK_INTERNATIONAL_AFTER_HOURS');
      }
    }

    if (rules.max_daily_amount) {
      // This would need to check daily total
      applied.push('MAX_DAILY_AMOUNT_CHECK');
    }

    return applied;
  }

  /**
   * Get default evaluation when no policy is active
   */
  private getDefaultEvaluation(riskScore: number): PolicyEvaluationResult {
    const defaultThresholds: RiskThresholds = {
      very_low: 19,
      low: 39,
      medium: 59,
      high: 79,
      critical: 100,
    };

    const riskLevel = this.determineRiskLevel(riskScore, defaultThresholds);

    const defaultApprovals: { [key: string]: number } = {
      VERY_LOW: 1,
      LOW: 1,
      MEDIUM: 2,
      HIGH: 2,
      CRITICAL: 3,
    };

    const defaultChallenges: { [key: string]: string } = {
      VERY_LOW: 'L1',
      LOW: 'L1',
      MEDIUM: 'L2',
      HIGH: 'L2',
      CRITICAL: 'L3',
    };

    return {
      policy_id: 'default',
      policy_version: 1,
      risk_level: riskLevel,
      required_approvals: defaultApprovals[riskLevel] || 1,
      challenge_level: defaultChallenges[riskLevel] || 'L1',
      auto_approve: false,
      rules_applied: [],
    };
  }
}

export const policyService = new PolicyService();
