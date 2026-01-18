import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { prisma } from "../../../db/prisma.js";
import { redis } from "../../../lib/redis.js";
import { createConfirmationSession, submitVoice } from "../orchestrator.js";
import { listIntentEvents } from "../../evidence/eventChain.js";

const describeDb = process.env.WIRE2_TEST_WITH_DB === "1" ? describe : describe.skip;

describeDb("wire v3 orchestrator (integration)", () => {
  beforeAll(async () => {
    const now = new Date();
    await prisma.organization.upsert({
      where: { id: "org_1" },
      update: { name: "Test Org 1" },
      create: { id: "org_1", name: "Test Org 1", createdAt: now },
    });

    await prisma.user.upsert({
      where: { id: "user_1" },
      update: { orgId: "org_1", email: "user_1@example.com", name: "User One" },
      create: {
        id: "user_1",
        orgId: "org_1",
        email: "user_1@example.com",
        name: "User One",
        role: "ADMIN",
        permissions: ["intent:create", "intent:approve", "intent:execute"],
        voiceEnrolled: false,
        createdAt: now,
      },
    });

    await prisma.beneficiary.upsert({
      where: { id: "benef_1" },
      update: { orgId: "org_1", displayName: "Test Beneficiary" },
      create: {
        id: "benef_1",
        orgId: "org_1",
        displayName: "Test Beneficiary",
        country: "US",
        railsAllowed: ["WIRE"],
        bankLast4: "1234",
        bankTokenHash: "hash_benef_1",
        version: 1,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        lastChangedAt: now,
        lastChangedBy: "user_1",
      },
    });

    const policyId = "policy_org_1_v1";
    await prisma.policy.upsert({
      where: { id: policyId },
      update: { orgId: "org_1", name: "Default Policy", activeVersion: 1 },
      create: {
        id: policyId,
        orgId: "org_1",
        name: "Default Policy",
        activeVersion: 1,
        createdAt: now,
      },
    });

    await prisma.policyVersion.upsert({
      where: { id: `${policyId}_v1` },
      update: { policyId, version: 1 },
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

  beforeEach(async () => {
    if (redis) {
      const keys = await redis.keys("wirev3:*");
      if (keys.length > 0) {
        await redis.del(keys);
      }
    }
    await prisma.voiceProof.deleteMany({});
    await prisma.voiceChallenge.deleteMany({});
    await prisma.intentEvent.deleteMany({});
    await prisma.approval.deleteMany({});
    await prisma.approvalToken.deleteMany({});
    await prisma.decision.deleteMany({});
    await prisma.executionLedger.deleteMany({});
    await prisma.auditBundle.deleteMany({});
    await prisma.intent.deleteMany({});
  });

  it("returns same session for same clientConfirmationId", async () => {
    const ctx = { orgId: "org_1", userId: "user_1" };
    const request = {
      amountMinor: "10000",
      currency: "USD",
      beneficiaryId: "benef_1",
      clientConfirmationId: "client_1",
    };

    const first = await createConfirmationSession({ ctx, request });
    const second = await createConfirmationSession({ ctx, request });
    expect((first as any).sessionId).toEqual((second as any).sessionId);
  });

  it("requires full phrase (no fallback)", async () => {
    const ctx = { orgId: "org_1", userId: "user_1" };
    const session = await createConfirmationSession({
      ctx,
      request: {
        amountMinor: "10000",
        currency: "USD",
        beneficiaryId: "benef_1",
        clientConfirmationId: "client_2",
      },
    });

    if ("status" in session) return;
    const response = await submitVoice({
      ctx,
      sessionId: session.sessionId,
      request: { audioBuffer: "fake", transcript: "Confirm" },
    });
    expect(response.status).toEqual("voice_required");
  });

  it("returns awaiting_confirmation when approvals are still required", async () => {
    const ctx = { orgId: "org_1", userId: "user_1" };
    const session = await createConfirmationSession({
      ctx,
      request: {
        amountMinor: "500000",
        currency: "USD",
        beneficiaryId: "benef_1",
        clientConfirmationId: "client_3",
      },
    });

    if ("status" in session) {
      throw new Error(session.error);
    }

    await prisma.intent.update({
      where: { id: session.intentId },
      data: { requiredApprovals: 2 },
    });

    const response = await submitVoice({
      ctx,
      sessionId: session.sessionId,
      request: {
        audioBuffer: Buffer.from("fake").toString("base64"),
        transcript: session.challengePhrase,
      },
    });

    expect(response.status).toEqual("awaiting_confirmation");
  });

  it("emits intent events during v3 confirmation", async () => {
    const ctx = { orgId: "org_1", userId: "user_1" };
    const session = await createConfirmationSession({
      ctx,
      request: {
        amountMinor: "25000",
        currency: "USD",
        beneficiaryId: "benef_1",
        clientConfirmationId: "client_4",
      },
    });

    if ("status" in session) {
      throw new Error(session.error);
    }

    const events = await listIntentEvents(session.intentId, ctx.orgId);
    const eventTypes = events.map((event) => event.eventType);
    expect(eventTypes).toContain("intent.created");
    expect(eventTypes).toContain("challenge.created");
  });
});
