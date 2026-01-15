import { prisma } from "../../db/prisma.js";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";
import { sha256Hex } from "../../lib/sha256.js";
import { hashPassword } from "../security/passwords.js";

function slugifySeed(seed: string): string {
  return seed.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "default";
}

function sandboxOrgId(seed: string): string {
  return `org_sandbox_${slugifySeed(seed)}`;
}

function sandboxEmail(seed: string, localPart: string): string {
  const s = slugifySeed(seed);
  return `${localPart}+${s}@sandbox.local`;
}

function sandboxPassword(seed: string): string {
  // Intentionally simple/deterministic for sandbox usage.
  return `sandbox-${slugifySeed(seed)}-password`;
}

export async function sandboxClear(params: { seed: string }): Promise<{ orgId: string; cleared: boolean }> {
  const orgId = sandboxOrgId(params.seed);

  // Collect intent IDs up-front for dependent deletes.
  const intentIds = (
    await prisma.intent.findMany({
      where: { orgId },
      select: { id: true },
    })
  ).map((i) => i.id);

  await prisma.$transaction(async (tx) => {
    if (intentIds.length) {
      await tx.webhookDelivery.deleteMany({
        where: { webhook: { orgId } },
      });
      await tx.auditBundle.deleteMany({ where: { intentId: { in: intentIds } } });
      await tx.executionLedger.deleteMany({ where: { intentId: { in: intentIds } } });
      await tx.approvalToken.deleteMany({ where: { intentId: { in: intentIds } } });
      await tx.approval.deleteMany({ where: { intentId: { in: intentIds } } }).catch(() => null);
      await tx.decision.deleteMany({ where: { intentId: { in: intentIds } } });
      await tx.voiceProof.deleteMany({ where: { intentId: { in: intentIds } } });
      await tx.voiceChallenge.deleteMany({ where: { intentId: { in: intentIds } } });
      await tx.intentEvent.deleteMany({ where: { intentId: { in: intentIds } } });
      await tx.publicIntent.deleteMany({ where: { linkedIntentId: { in: intentIds } } }).catch(() => null);
      await tx.intent.deleteMany({ where: { id: { in: intentIds } } });
    }

    await tx.webhookDelivery.deleteMany({ where: { webhook: { orgId } } });
    await tx.webhook.deleteMany({ where: { orgId } });
    await tx.apiKey.deleteMany({ where: { orgId } });
    await tx.userInvitation.deleteMany({ where: { orgId } });
    await tx.session.deleteMany({ where: { orgId } });
    await tx.idempotencyKey.deleteMany({ where: { orgId } });

    await tx.beneficiaryVersion.deleteMany({ where: { beneficiary: { orgId } } }).catch(() => null);
    await tx.beneficiary.deleteMany({ where: { orgId } });

    await tx.policyVersion.deleteMany({ where: { policy: { orgId } } });
    await tx.policy.deleteMany({ where: { orgId } });

    // POSE identity tables are user-linked; delete users later.
    const userIds = (
      await tx.user.findMany({
        where: { orgId },
        select: { id: true },
      })
    ).map((u) => u.id);

    if (userIds.length) {
      await tx.poseVoiceProfile.deleteMany({ where: { identity: { userId: { in: userIds } } } }).catch(() => null);
      await tx.poseVoiceEnrollment.deleteMany({ where: { identity: { userId: { in: userIds } } } }).catch(() => null);
      await tx.poseIdentity.deleteMany({ where: { userId: { in: userIds } } }).catch(() => null);
      await tx.voiceprint.deleteMany({ where: { userId: { in: userIds } } }).catch(() => null);
      await tx.authAuditLog.deleteMany({ where: { orgId } }).catch(() => null);
      await tx.emailLog.deleteMany({ where: { orgId } }).catch(() => null);
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    }

    await tx.customDomain.deleteMany({ where: { orgId } }).catch(() => null);
    await tx.emailDomain.deleteMany({ where: { orgId } }).catch(() => null);
    await tx.orgSsoConfig.deleteMany({ where: { orgId } }).catch(() => null);
    await tx.orgGroupMembership.deleteMany({ where: { orgId } }).catch(() => null);
    await tx.legalEntity.deleteMany({ where: { orgId } }).catch(() => null);
    await tx.financialAccount.deleteMany({ where: { orgId } }).catch(() => null);

    // Finally, delete the org itself.
    await tx.organization.deleteMany({ where: { id: orgId } });
  });

  return { orgId, cleared: true };
}

export async function sandboxSeed(params: {
  seed: string;
}): Promise<{
  orgId: string;
  admin: { email: string; password: string };
  users: Array<{ email: string; role: string }>;
  beneficiaryId: string;
  policyId: string;
}> {
  const seed = params.seed;
  const orgId = sandboxOrgId(seed);
  const password = sandboxPassword(seed);

  const adminEmail = sandboxEmail(seed, "admin");
  const approverEmail = sandboxEmail(seed, "approver");
  const viewerEmail = sandboxEmail(seed, "viewer");

  const now = new Date();
  const passwordHash = await hashPassword(password);

  const beneficiaryId = `benef_sandbox_${slugifySeed(seed)}`;
  const policyId = `policy_${orgId}_v1`;

  await prisma.$transaction(async (tx) => {
    // Org
    await tx.organization.upsert({
      where: { id: orgId },
      update: { name: `Sandbox Org (${seed})` },
      create: { id: orgId, name: `Sandbox Org (${seed})`, createdAt: now },
    });

    // Users
    const adminId = `user_sandbox_admin_${slugifySeed(seed)}`;
    const approverId = `user_sandbox_approver_${slugifySeed(seed)}`;
    const viewerId = `user_sandbox_viewer_${slugifySeed(seed)}`;

    await tx.user.upsert({
      where: { id: adminId },
      update: {
        orgId,
        email: adminEmail,
        name: "Sandbox Admin",
        role: "ADMIN",
        passwordHash,
        voiceEnrolled: true,
        permissions: [
          "intent:create",
          "intent:approve",
          "intent:execute",
          "intent:view_events",
          "intent:view_bundle",
          "beneficiary:create",
          "beneficiary:lock",
          "policy:edit",
          "user:create",
          "user:view",
          "user:edit",
          "user:delete",
          "org:edit",
          "admin:view",
          "api:create",
          "api:view",
          "api:edit",
          "api:delete",
          "webhook:create",
          "webhook:view",
          "webhook:edit",
          "webhook:delete",
          "audit:read",
          "evidence:view",
          "evidence:export_full",
        ],
        createdAt: now,
      },
      create: {
        id: adminId,
        orgId,
        email: adminEmail,
        name: "Sandbox Admin",
        role: "ADMIN",
        passwordHash,
        voiceEnrolled: true,
        enrolledAt: now,
        permissions: [
          "intent:create",
          "intent:approve",
          "intent:execute",
          "intent:view_events",
          "intent:view_bundle",
          "beneficiary:create",
          "beneficiary:lock",
          "policy:edit",
          "user:create",
          "user:view",
          "user:edit",
          "user:delete",
          "org:edit",
          "admin:view",
          "api:create",
          "api:view",
          "api:edit",
          "api:delete",
          "webhook:create",
          "webhook:view",
          "webhook:edit",
          "webhook:delete",
          "audit:read",
          "evidence:view",
          "evidence:export_full",
        ],
        createdAt: now,
      },
    });

    await tx.user.upsert({
      where: { id: approverId },
      update: {
        orgId,
        email: approverEmail,
        name: "Sandbox Approver",
        role: "APPROVER",
        passwordHash,
        voiceEnrolled: true,
        permissions: ["intent:approve", "intent:view_events", "intent:view_bundle", "audit:read"],
        createdAt: now,
      },
      create: {
        id: approverId,
        orgId,
        email: approverEmail,
        name: "Sandbox Approver",
        role: "APPROVER",
        passwordHash,
        voiceEnrolled: true,
        enrolledAt: now,
        permissions: ["intent:approve", "intent:view_events", "intent:view_bundle", "audit:read"],
        createdAt: now,
      },
    });

    await tx.user.upsert({
      where: { id: viewerId },
      update: {
        orgId,
        email: viewerEmail,
        name: "Sandbox Viewer",
        role: "VIEWER",
        passwordHash,
        voiceEnrolled: false,
        permissions: ["intent:read", "beneficiary:read"],
        createdAt: now,
      },
      create: {
        id: viewerId,
        orgId,
        email: viewerEmail,
        name: "Sandbox Viewer",
        role: "VIEWER",
        passwordHash,
        voiceEnrolled: false,
        permissions: ["intent:read", "beneficiary:read"],
        createdAt: now,
      },
    });

    // Beneficiary (stable id)
    await tx.beneficiary.upsert({
      where: { id_orgId: { id: beneficiaryId, orgId } } as any,
      update: {
        displayName: "Sandbox Vendor",
        country: "US",
        railsAllowed: ["ACH", "WIRE"],
        bankLast4: "4242",
        bankTokenHash: sha256Hex(canonicalJsonStringify({ seed, orgId, beneficiaryId })),
        status: "ACTIVE",
        updatedAt: now,
        lastChangedAt: now,
        lastChangedBy: `user_sandbox_admin_${slugifySeed(seed)}`,
      },
      create: {
        id: beneficiaryId,
        orgId,
        displayName: "Sandbox Vendor",
        country: "US",
        railsAllowed: ["ACH", "WIRE"],
        bankLast4: "4242",
        bankTokenHash: sha256Hex(canonicalJsonStringify({ seed, orgId, beneficiaryId })),
        version: 1,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        lastChangedAt: now,
        lastChangedBy: `user_sandbox_admin_${slugifySeed(seed)}`,
      },
    });

    // Policy
    await tx.policy.upsert({
      where: { id: policyId },
      update: { orgId, name: "Sandbox Default Policy", activeVersion: 1 },
      create: { id: policyId, orgId, name: "Sandbox Default Policy", activeVersion: 1, createdAt: now },
    });

    await tx.policyVersion.upsert({
      where: { id: `${policyId}_v1` },
      update: {
        policyId,
        version: 1,
        effectiveAt: now,
        thresholdsJson: JSON.stringify({
          amountStepUpMinor: "100000",
          dualApprovalRiskScore: 60,
          criticalRiskScore: 85,
          newBeneficiaryDays: 7,
          outOfHoursStartHourLocal: 18,
          outOfHoursEndHourLocal: 8,
        }),
        rulesJson: JSON.stringify({
          requireDualApprovalForInternationalWire: true,
          requirePhoneForL3IfMicDenied: true,
          cooldownMinutesForHighRisk: 10,
          lockoutAfterFailedAttempts: 3,
        }),
      },
      create: {
        id: `${policyId}_v1`,
        policyId,
        version: 1,
        effectiveAt: now,
        thresholdsJson: JSON.stringify({
          amountStepUpMinor: "100000",
          dualApprovalRiskScore: 60,
          criticalRiskScore: 85,
          newBeneficiaryDays: 7,
          outOfHoursStartHourLocal: 18,
          outOfHoursEndHourLocal: 8,
        }),
        rulesJson: JSON.stringify({
          requireDualApprovalForInternationalWire: true,
          requirePhoneForL3IfMicDenied: true,
          cooldownMinutesForHighRisk: 10,
          lockoutAfterFailedAttempts: 3,
        }),
        createdAt: now,
      },
    });
  });

  return {
    orgId,
    admin: { email: adminEmail, password },
    users: [
      { email: adminEmail, role: "ADMIN" },
      { email: approverEmail, role: "APPROVER" },
      { email: viewerEmail, role: "VIEWER" },
    ],
    beneficiaryId,
    policyId,
  };
}

export async function sandboxReset(params: { seed: string }) {
  await sandboxClear({ seed: params.seed });
  return await sandboxSeed({ seed: params.seed });
}

