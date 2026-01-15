/**
 * Policy Engine Service
 * 
 * Evaluates policies to determine approval requirements
 * Integrates with Policy Engine Service (Phase 8)
 */

import { policyService } from './policyService';
import { ChallengeLevel } from '../db/types';
import { logger } from '../utils/logger';

export interface PolicyResult {
  requiredApprovals: number;
  requiredChallengeLevel: ChallengeLevel;
}

/**
 * Enforce policy rules
 * Uses Policy Engine Service for evaluation
 */
export async function enforcePolicy(
  orgId: string,
  riskScore: number,
  amountMinor: number,
  intentData?: any
): Promise<PolicyResult> {
  const evaluation = await policyService.evaluatePolicy(
    orgId,
    riskScore,
    intentData || { amount_minor: amountMinor }
  );

  return {
    requiredApprovals: evaluation.required_approvals,
    requiredChallengeLevel: evaluation.challenge_level as ChallengeLevel,
  };
}

/**
 * Evaluate policy for an intent
 */
export async function evaluatePolicy(
  riskScore: number,
  orgId: string,
  intentData?: any
): Promise<{ requiredApprovals: number; challengeLevel: ChallengeLevel; autoApprove: boolean }> {
  const evaluation = await policyService.evaluatePolicy(
    orgId,
    riskScore,
    intentData || {}
  );

  return {
    requiredApprovals: evaluation.required_approvals,
    challengeLevel: evaluation.challenge_level as ChallengeLevel,
    autoApprove: evaluation.auto_approve,
  };
}

/**
 * Get required approvals for an intent
 */
export async function getRequiredApprovals(
  riskScore: number,
  orgId: string,
  intentData?: any
): Promise<number> {
  const evaluation = await policyService.evaluatePolicy(
    orgId,
    riskScore,
    intentData || {}
  );
  return evaluation.required_approvals;
}

/**
 * Get challenge level for an intent
 */
export async function getChallengeLevel(
  riskScore: number,
  orgId: string,
  intentData?: any
): Promise<ChallengeLevel> {
  const evaluation = await policyService.evaluatePolicy(
    orgId,
    riskScore,
    intentData || {}
  );
  return evaluation.challenge_level as ChallengeLevel;
}
