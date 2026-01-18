import { describe, it, expect } from "vitest";
import { redis } from "../../../lib/redis.js";
import { createSession, getSession } from "../sessionStore.js";
import { storeClientConfirmationId, lookupByClientConfirmationId } from "../idempotency.js";
import type { ConfirmationSession } from "../types.js";

const describeMemory = redis ? describe.skip : describe;

describeMemory("wire v3 stores (memory fallback)", () => {
  it("stores and retrieves sessions in memory when Redis is unavailable", async () => {
    const session: ConfirmationSession = {
      id: "session_1",
      orgId: "org_1",
      userId: "user_1",
      intentId: "intent_1",
      challengeId: "challenge_1",
      challengePhrase: "Confirm seven blue",
      challengePhraseDisplay: "Confirm",
      clientConfirmationId: "client_1",
      deviceTrustLevel: "unknown",
      isNewDevice: false,
      sessionContinuityHash: null,
      state: "voice_required",
      voiceRetryAttempted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    await createSession(session);
    const stored = await getSession(session.id);
    expect(stored?.id).toEqual(session.id);
  });

  it("stores and retrieves idempotency records in memory when Redis is unavailable", async () => {
    await storeClientConfirmationId({
      orgId: "org_1",
      userId: "user_1",
      intentBindingHash: "hash_1",
      clientConfirmationId: "client_2",
      ttlMs: 60_000,
      intentId: "intent_2",
      sessionId: "session_2",
    });

    const record = await lookupByClientConfirmationId({
      orgId: "org_1",
      userId: "user_1",
      clientConfirmationId: "client_2",
    });

    expect(record?.intentId).toEqual("intent_2");
    expect(record?.sessionId).toEqual("session_2");
  });
});
