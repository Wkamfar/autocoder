import { prisma } from "../../db/prisma.js";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";
import { sha256Hex } from "../../lib/sha256.js";

export async function appendIntentEvent(params: {
  intentId: string;
  orgId: string;
  eventType: string;
  payload: unknown;
  createdByUserId: string | null;
  createdAt?: Date;
  correlationId?: string;
  requestId?: string;
}) {
  const last = await prisma.intentEvent.findFirst({
    where: { intentId: params.intentId, orgId: params.orgId },
    orderBy: { seq: "desc" },
  });

  const seq = (last?.seq ?? 0) + 1;
  const prevHash = last?.eventHash ?? null;
  const createdAt = params.createdAt ?? new Date();
  const payloadCanonicalJson = canonicalJsonStringify(params.payload);

  const eventHash = sha256Hex(
    canonicalJsonStringify({
      prevHash,
      seq,
      eventType: params.eventType,
      payloadCanonicalJson,
      createdByUserId: params.createdByUserId,
      createdAt: createdAt.toISOString(),
    })
  );

  return await prisma.intentEvent.create({
    data: {
      id: `event_${params.intentId}_${seq}`,
      intentId: params.intentId,
      orgId: params.orgId,
      seq,
      eventType: params.eventType,
      payloadCanonicalJson,
      prevHash,
      eventHash,
      correlationId: params.correlationId,
      requestId: params.requestId,
      createdByUserId: params.createdByUserId,
      createdAt,
    },
  });
}

export async function listIntentEvents(intentId: string, orgId: string) {
  return await prisma.intentEvent.findMany({
    where: { intentId, orgId },
    orderBy: { seq: "asc" },
  });
}

/**
 * Verify event chain integrity for an intent.
 * Checks sequential integrity, hash linkage, and recomputes hashes to detect tampering.
 */
export async function verifyEventChain(intentId: string, orgId: string): Promise<{
  valid: boolean;
  errors: Array<{ seq: number; error: string }>;
  chainHash: string | null;
  eventCount: number;
}> {
  const events = await listIntentEvents(intentId, orgId);
  
  if (events.length === 0) {
    return {
      valid: true,
      errors: [],
      chainHash: null,
      eventCount: 0,
    };
  }

  const errors: Array<{ seq: number; error: string }> = [];
  let expectedPrevHash: string | null = null;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const expectedSeq = i + 1;

    // Check sequential integrity
    if (event.seq !== expectedSeq) {
      errors.push({
        seq: event.seq,
        error: `Sequence gap: expected ${expectedSeq}, got ${event.seq}`,
      });
      continue;
    }

    // Check hash linkage (for events after the first)
    if (i > 0) {
      if (event.prevHash !== expectedPrevHash) {
        errors.push({
          seq: event.seq,
          error: `Hash linkage broken: expected prevHash ${expectedPrevHash}, got ${event.prevHash}`,
        });
      }
    } else {
      // First event must have null prevHash
      if (event.prevHash !== null) {
        errors.push({
          seq: event.seq,
          error: `First event must have null prevHash, got ${event.prevHash}`,
        });
      }
    }

    // Recompute hash to detect tampering
    const recomputedHash = sha256Hex(
      canonicalJsonStringify({
        prevHash: event.prevHash,
        seq: event.seq,
        eventType: event.eventType,
        payloadCanonicalJson: event.payloadCanonicalJson,
        createdByUserId: event.createdByUserId,
        createdAt: event.createdAt.toISOString(),
      })
    );

    if (recomputedHash !== event.eventHash) {
      errors.push({
        seq: event.seq,
        error: `Hash mismatch: stored ${event.eventHash}, recomputed ${recomputedHash}`,
      });
    }

    // Check timestamp ordering (non-decreasing)
    if (i > 0) {
      const prevEvent = events[i - 1];
      if (event.createdAt.getTime() < prevEvent.createdAt.getTime()) {
        errors.push({
          seq: event.seq,
          error: `Timestamp out of order: ${event.createdAt.toISOString()} < ${prevEvent.createdAt.toISOString()}`,
        });
      }
    }

    expectedPrevHash = event.eventHash;
  }

  return {
    valid: errors.length === 0,
    errors,
    chainHash: events.length > 0 ? events[events.length - 1].eventHash : null,
    eventCount: events.length,
  };
}