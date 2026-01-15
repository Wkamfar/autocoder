import { describe, it, expect } from "vitest";
import { prisma } from "../db/prisma.js";
import { dbAvailable } from "./testDb.js";

/**
 * Agent 4: Multi-tenant isolation tests
 *
 * These tests intentionally attempt cross-tenant operations that must fail
 * at the DB layer (composite foreign keys / constraints).
 */
describe("Agent 4: multi-tenant isolation (DB + service guardrails)", () => {
  it("rejects creating an Intent that references a Beneficiary from another org (DB constraint)", async () => {
    if (!(await dbAvailable())) return;

    const ts = Date.now();
    const orgA = `org_test_a_${ts}`;
    const orgB = `org_test_b_${ts}`;
    const userA = `user_test_a_${ts}`;
    const benB = `ben_test_b_${ts}`;
    const intentId = `intent_test_cross_${ts}`;

    const now = new Date();

    try {
      await prisma.organization.create({ data: { id: orgA, name: `Test Org A ${ts}` } });
      await prisma.organization.create({ data: { id: orgB, name: `Test Org B ${ts}` } });

      await prisma.user.create({
        data: {
          id: userA,
          orgId: orgA,
          email: `a_${ts}@example.com`,
          name: "User A",
          role: "ADMIN",
          permissions: ["intent:create"],
          voiceEnrolled: false,
          createdAt: now,
        },
      });

      await prisma.beneficiary.create({
        data: {
          id: benB,
          orgId: orgB,
          displayName: "Beneficiary B",
          country: "US",
          railsAllowed: ["ACH"],
          bankLast4: "1234",
          bankTokenHash: `hash_${ts}`,
          version: 1,
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
          lastChangedAt: now,
          lastChangedBy: userA,
        },
      });

      await expect(
        prisma.intent.create({
          data: {
            id: intentId,
            orgId: orgA,
            createdByUserId: userA,
            railsType: "ACH",
            amountMinor: "1000",
            currency: "USD",
            beneficiaryId: benB, // cross-tenant
            beneficiaryVersion: 1,
            purpose: "cross tenant should fail",
            status: "DRAFT",
            riskScore: 0,
            riskRationaleJson: "{}",
            requiredApprovals: 1,
            requiredChallengeLevel: "L1",
            bindingHash: "hash",
            cooldownUntil: null,
            createdAt: now,
            updatedAt: now,
          },
        })
      ).rejects.toBeTruthy();
    } finally {
      // Cleanup (best-effort)
      await prisma.intent.deleteMany({ where: { id: intentId } }).catch(() => null);
      await prisma.beneficiary.deleteMany({ where: { id: benB } }).catch(() => null);
      await prisma.user.deleteMany({ where: { id: userA } }).catch(() => null);
      await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } }).catch(() => null);
    }
  });

  it("rejects creating a Session with (userId, orgId) mismatch (DB constraint)", async () => {
    if (!(await dbAvailable())) return;

    const ts = Date.now();
    const orgA = `org_test_a_sess_${ts}`;
    const orgB = `org_test_b_sess_${ts}`;
    const userB = `user_test_b_sess_${ts}`;
    const sessionId = `sess_test_${ts}`;

    const now = new Date();

    try {
      await prisma.organization.create({ data: { id: orgA, name: `Test Org A Sess ${ts}` } });
      await prisma.organization.create({ data: { id: orgB, name: `Test Org B Sess ${ts}` } });

      await prisma.user.create({
        data: {
          id: userB,
          orgId: orgB,
          email: `b_${ts}@example.com`,
          name: "User B",
          role: "ADMIN",
          permissions: [],
          voiceEnrolled: false,
          createdAt: now,
        },
      });

      await expect(
        prisma.session.create({
          data: {
            id: sessionId,
            userId: userB,
            orgId: orgA, // mismatch
            tokenHash: `tok_${ts}`,
            refreshTokenHash: `rtok_${ts}`,
            deviceFingerprint: null,
            ipAddress: null,
            userAgent: null,
            expiresAt: new Date(now.getTime() + 60_000),
            revokedAt: null,
            lastActivityAt: now,
            createdAt: now,
          },
        })
      ).rejects.toBeTruthy();
    } finally {
      await prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => null);
      await prisma.user.deleteMany({ where: { id: userB } }).catch(() => null);
      await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } }).catch(() => null);
    }
  });
});

