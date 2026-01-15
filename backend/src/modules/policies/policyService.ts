import { prisma } from "../../db/prisma.js";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";

export type PolicyThresholds = {
  amountStepUpMinor: string;
  dualApprovalRiskScore: number;
  criticalRiskScore: number;
  newBeneficiaryDays: number;
  outOfHoursStartHourLocal: number;
  outOfHoursEndHourLocal: number;
};

export type PolicyRules = {
  requireDualApprovalForInternationalWire: boolean;
  requirePhoneForL3IfMicDenied: boolean;
  cooldownMinutesForHighRisk: number;
  lockoutAfterFailedAttempts: number;
};

export async function getActivePolicy(orgId: string) {
  const policy = await prisma.policy.findFirst({ where: { orgId } });
  if (!policy) return null;
  const version = await prisma.policyVersion.findUnique({
    where: { id: `${policy.id}_v${policy.activeVersion}` },
  });
  if (!version) return null;
  return { policy, version };
}

export async function createPolicyVersion(params: {
  orgId: string;
  policyId: string;
  thresholds: PolicyThresholds;
  rules: PolicyRules;
  effectiveAt?: Date;
}) {
  const existing = await prisma.policy.findUnique({ where: { id: params.policyId } });
  const nextVersion = existing ? existing.activeVersion + 1 : 1;

  const policy = await prisma.policy.upsert({
    where: { id: params.policyId },
    update: { activeVersion: nextVersion },
    create: {
      id: params.policyId,
      orgId: params.orgId,
      name: "Policy",
      activeVersion: nextVersion,
    },
  });

  const version = await prisma.policyVersion.create({
    data: {
      id: `${policy.id}_v${nextVersion}`,
      policyId: policy.id,
      version: nextVersion,
      effectiveAt: params.effectiveAt ?? new Date(),
      thresholdsJson: canonicalJsonStringify(params.thresholds),
      rulesJson: canonicalJsonStringify(params.rules),
    },
  });

  return { policy, version };
}

