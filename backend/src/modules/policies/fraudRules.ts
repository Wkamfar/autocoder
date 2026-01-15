/**
 * Simple Rule-Based Fraud Detection
 * Production-ready fraud detection using rule-based patterns
 * Can be enhanced with ML models later
 */

import { prisma } from "../../db/prisma.js";
import type { Intent, User, Beneficiary } from "@prisma/client";
import { logger } from "../../lib/observability.js";

export interface FraudCheckResult {
  blocked: boolean;
  violations: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: Record<string, string>;
}

/**
 * Check fraud rules for an intent
 */
export async function checkFraudRules(
  intent: Intent,
  user: User,
  beneficiary: Beneficiary
): Promise<FraudCheckResult> {
  const violations: string[] = [];
  const details: Record<string, string> = {};

  // Rule 1: Amount threshold check
  const amount = BigInt(intent.amountMinor);
  const amountThreshold = BigInt(1_000_000_000); // $10M
  if (amount > amountThreshold) {
    violations.push("AMOUNT_EXCEEDS_THRESHOLD");
    details.amount = `Amount ${intent.amountMinor} exceeds threshold ${amountThreshold}`;
  }

  // Rule 2: New beneficiary check
  const daysSinceBeneficiaryCreated =
    (Date.now() - beneficiary.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceBeneficiaryCreated < 7) {
    violations.push("NEW_BENEFICIARY");
    details.new_beneficiary = `Beneficiary created ${daysSinceBeneficiaryCreated.toFixed(1)} days ago`;
  }

  // Rule 3: Unusual time check (outside business hours 8 AM - 6 PM)
  const hour = new Date().getHours();
  if (hour < 8 || hour > 18) {
    violations.push("UNUSUAL_TIME");
    details.unusual_time = `Transfer initiated at ${hour}:00 (outside business hours)`;
  }

  // Rule 4: Rapid-fire transfers (more than 5 in last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentIntents = await prisma.intent.findMany({
    where: {
      createdByUserId: user.id,
      createdAt: { gte: oneHourAgo },
      status: { notIn: ["CANCELED", "DENIED"] },
    },
  });

  if (recentIntents.length > 5) {
    violations.push("RAPID_FIRE_TRANSFERS");
    details.rapid_fire = `${recentIntents.length} transfers in last hour`;
  }

  // Rule 5: Large amount to new beneficiary (high risk combination)
  const largeAmount = amount > BigInt(500_000_000); // $5M
  if (largeAmount && daysSinceBeneficiaryCreated < 30) {
    violations.push("LARGE_AMOUNT_NEW_BENEFICIARY");
    details.large_new = `Large amount to beneficiary created ${daysSinceBeneficiaryCreated.toFixed(1)} days ago`;
  }

  // Rule 6: International wire to high-risk country
  if (intent.railsType === "WIRE" && beneficiary.country !== "US") {
    const highRiskCountries = ["CN", "RU", "KP", "IR"]; // Add more as needed
    if (highRiskCountries.includes(beneficiary.country)) {
      violations.push("HIGH_RISK_COUNTRY");
      details.high_risk_country = `International wire to ${beneficiary.country}`;
    }
  }

  // Rule 7: Weekend transfers (higher risk)
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    violations.push("WEEKEND_TRANSFER");
    details.weekend = `Transfer initiated on ${dayOfWeek === 0 ? "Sunday" : "Saturday"}`;
  }

  // Rule 8: First-time user making large transfer
  const userIntents = await prisma.intent.count({
    where: { createdByUserId: user.id },
  });
  if (userIntents === 0 && amount > BigInt(100_000_000)) {
    violations.push("FIRST_TIME_LARGE_TRANSFER");
    details.first_time = "First transfer and amount exceeds $1M";
  }

  // Determine risk level
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  if (violations.length === 0) {
    riskLevel = "LOW";
  } else if (violations.length <= 2) {
    riskLevel = "MEDIUM";
  } else if (violations.length <= 4) {
    riskLevel = "HIGH";
  } else {
    riskLevel = "CRITICAL";
  }

  // Critical violations always block
  const criticalViolations = [
    "AMOUNT_EXCEEDS_THRESHOLD",
    "LARGE_AMOUNT_NEW_BENEFICIARY",
    "HIGH_RISK_COUNTRY",
  ];
  const hasCriticalViolation = violations.some((v) => criticalViolations.includes(v));

  const blocked = hasCriticalViolation || violations.length > 4;

  logger.info("Fraud check completed", {
    intentId: intent.id,
    userId: user.id,
    violations: violations.length,
    riskLevel,
    blocked,
  });

  return {
    blocked,
    violations,
    riskLevel,
    details,
  };
}

/**
 * Check for suspicious patterns in user behavior
 */
export async function checkUserBehaviorPatterns(
  userId: string
): Promise<{ suspicious: boolean; patterns: string[] }> {
  const patterns: string[] = [];

  // Check for unusual activity patterns
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentActivity = await prisma.intent.count({
    where: {
      createdByUserId: userId,
      createdAt: { gte: last24Hours },
    },
  });

  if (recentActivity > 10) {
    patterns.push("HIGH_ACTIVITY_24H");
  }

  // Check for failed attempts
  const failedAttempts = await prisma.voiceProof.count({
    where: {
      userId,
      createdAt: { gte: last24Hours },
      scoresJson: {
        contains: '"identity_confidence":0',
      },
    },
  });

  if (failedAttempts > 3) {
    patterns.push("MULTIPLE_FAILED_ATTEMPTS");
  }

  return {
    suspicious: patterns.length > 0,
    patterns,
  };
}
