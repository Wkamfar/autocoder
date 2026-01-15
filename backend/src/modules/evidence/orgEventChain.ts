import { prisma } from "../../db/prisma.js";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";
import { sha256Hex } from "../../lib/sha256.js";

export async function appendOrgAuditEvent(params: {
  orgId: string;
  eventType: string;
  payload: unknown;
  actorUserId?: string | null;
  createdAt?: Date;
  correlationId?: string;
  requestId?: string;
}) {
  const last = await prisma.orgAuditEvent.findFirst({
    where: { orgId: params.orgId },
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
      actorUserId: params.actorUserId ?? null,
      createdAt: createdAt.toISOString(),
    })
  );

  return await prisma.orgAuditEvent.create({
    data: {
      id: `orgaudit_${params.orgId}_${seq}`,
      orgId: params.orgId,
      seq,
      eventType: params.eventType,
      payloadCanonicalJson,
      prevHash,
      eventHash,
      correlationId: params.correlationId,
      requestId: params.requestId,
      actorUserId: params.actorUserId ?? null,
      createdAt,
    },
  });
}

export async function listOrgAuditEvents(params: {
  orgId: string;
  since?: Date;
  limit?: number;
}) {
  return await prisma.orgAuditEvent.findMany({
    where: {
      orgId: params.orgId,
      ...(params.since ? { createdAt: { gte: params.since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 500,
  });
}

export async function verifyOrgAuditChain(orgId: string): Promise<{
  valid: boolean;
  errors: Array<{ seq: number; error: string }>;
  chainHash: string | null;
  eventCount: number;
}> {
  const events = await prisma.orgAuditEvent.findMany({
    where: { orgId },
    orderBy: { seq: "asc" },
  });

  if (events.length === 0) {
    return { valid: true, errors: [], chainHash: null, eventCount: 0 };
  }

  const errors: Array<{ seq: number; error: string }> = [];
  let expectedPrevHash: string | null = null;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const expectedSeq = i + 1;

    if (event.seq !== expectedSeq) {
      errors.push({ seq: event.seq, error: `Sequence gap: expected ${expectedSeq}, got ${event.seq}` });
      continue;
    }

    if (i === 0) {
      if (event.prevHash !== null) {
        errors.push({ seq: event.seq, error: `First event must have null prevHash, got ${event.prevHash}` });
      }
    } else {
      if (event.prevHash !== expectedPrevHash) {
        errors.push({
          seq: event.seq,
          error: `Hash linkage broken: expected prevHash ${expectedPrevHash}, got ${event.prevHash}`,
        });
      }
    }

    const recomputedHash = sha256Hex(
      canonicalJsonStringify({
        prevHash: event.prevHash,
        seq: event.seq,
        eventType: event.eventType,
        payloadCanonicalJson: event.payloadCanonicalJson,
        actorUserId: event.actorUserId ?? null,
        createdAt: event.createdAt.toISOString(),
      })
    );

    if (recomputedHash !== event.eventHash) {
      errors.push({
        seq: event.seq,
        error: `Hash mismatch: stored ${event.eventHash}, recomputed ${recomputedHash}`,
      });
    }

    if (i > 0) {
      const prevEvent = events[i - 1];
      if (event.createdAt.getTime() < prevEvent.createdAt.getTime()) {
        errors.push({ seq: event.seq, error: `Timestamp out of order` });
      }
    }

    expectedPrevHash = event.eventHash;
  }

  return {
    valid: errors.length === 0,
    errors,
    chainHash: events[events.length - 1]?.eventHash ?? null,
    eventCount: events.length,
  };
}

