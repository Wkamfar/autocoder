import type { Beneficiary } from "@prisma/client";
import type { PolicyRules, PolicyThresholds } from "./policyService.js";

export type RiskRationale = {
  factors: string[];
  details: Record<string, string>;
  scoreBreakdown: {
    base: number;
    amount?: number;
    beneficiary?: number;
    rails?: number;
    international?: number;
    timing?: number;
    total: number;
  };
};

export function scoreIntent(params: {
  amountMinor: string;
  railsType: "ACH" | "WIRE";
  beneficiary: Beneficiary;
  policy: { thresholds: PolicyThresholds; rules: PolicyRules };
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const thresholds = params.policy.thresholds;

  const factors: string[] = [];
  const details: Record<string, string> = {};
  const breakdown: RiskRationale["scoreBreakdown"] = { base: 0, total: 0 };

  const amount = Number(params.amountMinor);
  if (Number.isFinite(amount) && amount >= Number(thresholds.amountStepUpMinor)) {
    factors.push("amount_threshold");
    details.amount_threshold = "Amount exceeds step-up threshold";
    breakdown.amount = 30;
  } else if (Number.isFinite(amount) && amount >= 500_000) {
    factors.push("amount_threshold");
    details.amount_threshold = "Amount exceeds $5k threshold";
    breakdown.amount = 30;
  } else if (Number.isFinite(amount) && amount < 100_000) {
    factors.push("low_amount");
    details.low_amount = "Low amount";
  }

  // Beneficiary recency / changes
  const beneficiaryAgeDays = Math.floor(
    (now.getTime() - params.beneficiary.createdAt.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (beneficiaryAgeDays < thresholds.newBeneficiaryDays) {
    factors.push("new_beneficiary");
    details.new_beneficiary = `Beneficiary created ${beneficiaryAgeDays} days ago`;
    breakdown.beneficiary = (breakdown.beneficiary ?? 0) + 25;
  } else {
    factors.push("established_beneficiary");
    details.established_beneficiary = `Beneficiary created ${beneficiaryAgeDays} days ago`;
    breakdown.beneficiary = (breakdown.beneficiary ?? 0) + 15;
  }

  if (params.railsType === "WIRE") {
    factors.push("wire_rail");
    details.wire_rail = "Wire transfer (irreversible)";
    breakdown.rails = 10;
  }

  if (params.beneficiary.country !== "US") {
    factors.push("international");
    details.international = `International transfer (${params.beneficiary.country})`;
    breakdown.international = 10;
  }

  const total =
    (breakdown.base ?? 0) +
    (breakdown.amount ?? 0) +
    (breakdown.beneficiary ?? 0) +
    (breakdown.rails ?? 0) +
    (breakdown.international ?? 0) +
    (breakdown.timing ?? 0);

  breakdown.total = Math.max(0, Math.min(100, total));

  return {
    riskScore: breakdown.total,
    riskRationale: { factors, details, scoreBreakdown: breakdown } as RiskRationale,
    riskEngineVersion: "v1.0",
  };
}

export function requiredControls(params: {
  riskScore: number;
  railsType: "ACH" | "WIRE";
  beneficiaryCountry: string;
  policy: { thresholds: PolicyThresholds; rules: PolicyRules };
}) {
  const { thresholds, rules } = params.policy;

  const requiresDual =
    params.riskScore >= thresholds.dualApprovalRiskScore ||
    (rules.requireDualApprovalForInternationalWire &&
      params.railsType === "WIRE" &&
      params.beneficiaryCountry !== "US");

  const requiredApprovals = requiresDual ? 2 : 1;

  let requiredChallengeLevel: "L1" | "L2" | "L3" = "L1";
  if (params.riskScore >= thresholds.criticalRiskScore) requiredChallengeLevel = "L3";
  else if (params.riskScore >= thresholds.dualApprovalRiskScore) requiredChallengeLevel = "L2";

  return { requiredApprovals, requiredChallengeLevel };
}

