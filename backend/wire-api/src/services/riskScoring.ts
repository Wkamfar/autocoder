/**
 * Risk Scoring Service
 * 
 * Calculates risk scores for intents
 * Integrates with Fraud Detection Service
 */

import { getDatabase } from '../db/connection';
import { logger } from '../utils/logger';

const FRAUD_SERVICE_URL = process.env.FRAUD_SERVICE_URL || 'http://localhost:8002';

export interface RiskScore {
  score: number;
  rationale: {
    factors: Array<{ name: string; score: number; details: any }>;
    scoreBreakdown: {
      base: number;
      amount?: number;
      beneficiary?: number;
      rails?: number;
      international?: number;
      timing?: number;
      relationship?: number;
      anomalies?: number;
      patterns?: number;
      total: number;
    };
  };
}

export interface RiskScoringInput {
  amountMinor: number;
  currency: string;
  railsType: string;
  beneficiaryId: string;
  createdAt: Date;
  userId: string;
}

/**
 * Calculate risk score for an intent
 */
export async function calculateRiskScore(
  input: RiskScoringInput,
  beneficiary: any,
  user: any
): Promise<RiskScore> {
  const factors: Array<{ name: string; score: number; details: any }> = [];
  let totalScore = 0;

  // Amount risk
  const amountRisk = calculateAmountRisk(input.amountMinor);
  totalScore += amountRisk.score;
  factors.push({ name: 'amount', score: amountRisk.score, details: amountRisk });

  // Beneficiary risk
  const beneficiaryRisk = await calculateBeneficiaryRisk(beneficiary);
  totalScore += beneficiaryRisk.score;
  factors.push({ name: 'beneficiary', score: beneficiaryRisk.score, details: beneficiaryRisk });

  // User risk
  const userRisk = await calculateUserRisk(user);
  totalScore += userRisk.score;
  factors.push({ name: 'user', score: userRisk.score, details: userRisk });

  // Rails risk
  const railsRisk = calculateRailsRisk(input.railsType);
  totalScore += railsRisk.score;
  factors.push({ name: 'rails', score: railsRisk.score, details: railsRisk });

  // International risk
  const internationalRisk = calculateInternationalRisk(beneficiary);
  totalScore += internationalRisk.score;
  factors.push({ name: 'international', score: internationalRisk.score, details: internationalRisk });

  // Timing risk
  const timingRisk = calculateTimingRisk(input.createdAt);
  totalScore += timingRisk.score;
  factors.push({ name: 'timing', score: timingRisk.score, details: timingRisk });

  // Relationship risk
  const relationshipRisk = await calculateRelationshipRisk(input.userId, input.beneficiaryId);
  totalScore += relationshipRisk.score;
  factors.push({ name: 'relationship', score: relationshipRisk.score, details: relationshipRisk });

  // Anomaly detection
  const anomalies = await detectAnomalies(input, beneficiary, user);
  const anomalyScore = anomalies.reduce((sum, a) => sum + a.severity, 0);
  totalScore += anomalyScore;
  factors.push({ name: 'anomalies', score: anomalyScore, details: anomalies });

  // Pattern analysis
  const patterns = await analyzePatterns(input.userId);
  totalScore += patterns.riskScore;
  factors.push({ name: 'patterns', score: patterns.riskScore, details: patterns });

  // Cap at 100
  const finalScore = Math.min(100, Math.max(0, totalScore));

  return {
    score: finalScore,
    rationale: {
      factors,
      scoreBreakdown: {
        base: 0,
        amount: amountRisk.score,
        beneficiary: beneficiaryRisk.score,
        rails: railsRisk.score,
        international: internationalRisk.score,
        timing: timingRisk.score,
        relationship: relationshipRisk.score,
        anomalies: anomalyScore,
        patterns: patterns.riskScore,
        total: finalScore,
      },
    },
  };
}

function calculateAmountRisk(amountMinor: number): { score: number; details: any } {
  const amountDollars = amountMinor / 100;
  let score = 0;

  if (amountDollars >= 1000000) {
    score = 30; // Very high amount
  } else if (amountDollars >= 500000) {
    score = 20; // High amount
  } else if (amountDollars >= 100000) {
    score = 10; // Moderate amount
  } else if (amountDollars >= 50000) {
    score = 5; // Low-moderate amount
  }

  return {
    score,
    details: {
      amountDollars,
      threshold: amountDollars >= 100000 ? 'high' : amountDollars >= 50000 ? 'moderate' : 'low',
    },
  };
}

async function calculateBeneficiaryRisk(beneficiary: any): Promise<{ score: number; details: any }> {
  let score = 0;

  // New beneficiary risk
  const db = getDatabase();
  const beneficiaryAgeResult = await db.query(
    'SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 as age_days FROM beneficiaries WHERE id = $1',
    [beneficiary.id]
  );

  const ageDays = beneficiaryAgeResult.rows[0]?.age_days || 0;
  if (ageDays < 30) {
    score += 15; // New beneficiary
  } else if (ageDays < 90) {
    score += 5; // Recent beneficiary
  }

  // Verification status
  if (beneficiary.verification_status !== 'VERIFIED') {
    score += 10;
  }

  // KYC status
  if (beneficiary.kyc_status !== 'PASSED') {
    score += 10;
  }

  // Sanctions check
  if (beneficiary.sanctions_check_status === 'FLAGGED') {
    score += 50; // Critical
  }

  return {
    score,
    details: {
      ageDays,
      verificationStatus: beneficiary.verification_status,
      kycStatus: beneficiary.kyc_status,
      sanctionsStatus: beneficiary.sanctions_check_status,
    },
  };
}

async function calculateUserRisk(user: any): Promise<{ score: number; details: any }> {
  let score = 0;

  // Account age
  const db = getDatabase();
  const userAgeResult = await db.query(
    'SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 as age_days FROM users WHERE id = $1',
    [user.id]
  );

  const ageDays = userAgeResult.rows[0]?.age_days || 0;
  if (ageDays < 30) {
    score += 10; // New user
  }

  // Failed login attempts
  if (user.failed_login_attempts > 0) {
    score += user.failed_login_attempts * 2;
  }

  // MFA status
  if (!user.mfa_enabled) {
    score += 5;
  }

  return {
    score,
    details: {
      ageDays,
      failedLoginAttempts: user.failed_login_attempts,
      mfaEnabled: user.mfa_enabled,
    },
  };
}

function calculateRailsRisk(railsType: string): { score: number; details: any } {
  // WIRE transfers are higher risk than ACH
  return {
    score: railsType === 'WIRE' ? 10 : 5,
    details: { railsType },
  };
}

function calculateInternationalRisk(beneficiary: any): { score: number; details: any } {
  // International transfers are higher risk
  const isInternational = beneficiary.country !== 'US';
  return {
    score: isInternational ? 15 : 0,
    details: {
      country: beneficiary.country,
      isInternational,
    },
  };
}

function calculateTimingRisk(createdAt: Date): { score: number; details: any } {
  const hour = createdAt.getHours();
  const dayOfWeek = createdAt.getDay();

  let score = 0;

  // Off-hours risk (outside 9 AM - 5 PM)
  if (hour < 9 || hour >= 17) {
    score += 5;
  }

  // Weekend risk
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    score += 5;
  }

  return {
    score,
    details: {
      hour,
      dayOfWeek,
      isOffHours: hour < 9 || hour >= 17,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    },
  };
}

async function calculateRelationshipRisk(
  userId: string,
  beneficiaryId: string
): Promise<{ score: number; details: any }> {
  const db = getDatabase();

  // Check history of transfers to this beneficiary
  const historyResult = await db.query(
    `SELECT COUNT(*) as count, SUM(amount_minor) as total_amount
     FROM intents
     WHERE created_by_user_id = $1 AND beneficiary_id = $2
     AND status IN ('EXECUTED', 'APPROVED')
     AND created_at > NOW() - INTERVAL '90 days'`,
    [userId, beneficiaryId]
  );

  const count = parseInt(historyResult.rows[0]?.count || '0');
  const totalAmount = parseInt(historyResult.rows[0]?.total_amount || '0');

  let score = 0;

  // New relationship
  if (count === 0) {
    score += 10;
  }

  return {
    score,
    details: {
      transferCount: count,
      totalAmount,
      isNewRelationship: count === 0,
    },
  };
}

async function detectAnomalies(
  input: RiskScoringInput,
  beneficiary: any,
  user: any
): Promise<Array<{ type: string; severity: number; details: any }>> {
  const anomalies: Array<{ type: string; severity: number; details: any }> = [];
  const db = getDatabase();

  // Check for rapid-fire transfers
  const recentTransfersResult = await db.query(
    `SELECT COUNT(*) as count
     FROM intents
     WHERE created_by_user_id = $1
     AND created_at > NOW() - INTERVAL '1 hour'
     AND status != 'CANCELED'`,
    [input.userId]
  );

  const recentCount = parseInt(recentTransfersResult.rows[0]?.count || '0');
  if (recentCount > 5) {
    anomalies.push({
      type: 'RAPID_FIRE_TRANSFERS',
      severity: 15,
      details: { count: recentCount },
    });
  }

  // Check for unusual amount
  const userHistoryResult = await db.query(
    `SELECT AVG(amount_minor) as avg_amount, MAX(amount_minor) as max_amount
     FROM intents
     WHERE created_by_user_id = $1
     AND status IN ('EXECUTED', 'APPROVED')
     AND created_at > NOW() - INTERVAL '90 days'`,
    [input.userId]
  );

  const avgAmount = parseFloat(userHistoryResult.rows[0]?.avg_amount || '0');
  const maxAmount = parseFloat(userHistoryResult.rows[0]?.max_amount || '0');

  if (avgAmount > 0 && input.amountMinor > avgAmount * 3) {
    anomalies.push({
      type: 'UNUSUAL_AMOUNT',
      severity: 10,
      details: {
        amount: input.amountMinor,
        averageAmount: avgAmount,
        multiplier: input.amountMinor / avgAmount,
      },
    });
  }

  return anomalies;
}

async function analyzePatterns(userId: string): Promise<{ riskScore: number; details: any }> {
  const db = getDatabase();

  // Analyze user's transfer patterns
  const patternResult = await db.query(
    `SELECT 
       COUNT(*) as total_transfers,
       COUNT(DISTINCT beneficiary_id) as unique_beneficiaries,
       SUM(amount_minor) as total_amount,
       AVG(amount_minor) as avg_amount
     FROM intents
     WHERE created_by_user_id = $1
     AND created_at > NOW() - INTERVAL '30 days'
     AND status IN ('EXECUTED', 'APPROVED')`,
    [userId]
  );

  const patterns = patternResult.rows[0] || {};
  let riskScore = 0;

  // High number of unique beneficiaries
  if (parseInt(patterns.unique_beneficiaries || '0') > 20) {
    riskScore += 5;
  }

  // Very high total amount
  const totalAmount = parseFloat(patterns.total_amount || '0');
  if (totalAmount > 10000000) {
    // $100k
    riskScore += 10;
  }

  return {
    riskScore,
    details: patterns,
  };
}
