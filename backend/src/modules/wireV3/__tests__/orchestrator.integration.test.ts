import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../../db/prisma.js";
import { createConfirmationSession, submitVoice } from "../orchestrator.js";
import { listIntentEvents } from "../../evidence/eventChain.js";

const describeDb = process.env.WIRE2_TEST_WITH_DB === "1" ? describe : describe.skip;

describeDb("wire v3 orchestrator (integration)", () => {
  beforeEach(async () => {
    await prisma.intentEvent.deleteMany({});
    await prisma.intent.deleteMany({});
    await prisma.voiceChallenge.deleteMany({});
    await prisma.voiceProof.deleteMany({});
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
