import { redis } from "../../lib/redis.js";
import { logger } from "../../lib/observability.js";

const IDEMPOTENCY_PREFIX = "wirev3:idempotency:";

type IdempotencyRecord = {
  orgId: string;
  userId: string;
  intentBindingHash: string;
  clientConfirmationId: string;
  sessionId?: string | null;
  intentId?: string | null;
  createdAt: string;
};

type InMemoryRecord = {
  value: IdempotencyRecord;
  expiresAt: number;
};

const memoryStore = new Map<string, InMemoryRecord>();

function nowMs() {
  return Date.now();
}

function toSeconds(ms: number) {
  return Math.max(1, Math.ceil(ms / 1000));
}

function getKey(orgId: string, userId: string, clientConfirmationId: string) {
  return `${IDEMPOTENCY_PREFIX}${orgId}:${userId}:${clientConfirmationId}`;
}

export async function storeClientConfirmationId(params: {
  orgId: string;
  userId: string;
  intentBindingHash: string;
  clientConfirmationId: string;
  ttlMs?: number;
  sessionId?: string | null;
  intentId?: string | null;
}): Promise<void> {
  const ttlMs = params.ttlMs ?? 24 * 60 * 60 * 1000;
  const key = getKey(params.orgId, params.userId, params.clientConfirmationId);
  const record: IdempotencyRecord = {
    orgId: params.orgId,
    userId: params.userId,
    intentBindingHash: params.intentBindingHash,
    clientConfirmationId: params.clientConfirmationId,
    sessionId: params.sessionId ?? null,
    intentId: params.intentId ?? null,
    createdAt: new Date().toISOString(),
  };

  if (redis) {
    await redis.set(key, JSON.stringify(record), "EX", toSeconds(ttlMs));
    return;
  }

  logger.warn("Redis unavailable, storing idempotency record in memory", {
    clientConfirmationId: params.clientConfirmationId,
  });
  memoryStore.set(key, { value: record, expiresAt: nowMs() + ttlMs });
}

export async function lookupByClientConfirmationId(params: {
  orgId: string;
  userId: string;
  clientConfirmationId: string;
}): Promise<IdempotencyRecord | null> {
  const key = getKey(params.orgId, params.userId, params.clientConfirmationId);

  if (redis) {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as IdempotencyRecord) : null;
  }

  const record = memoryStore.get(key);
  if (!record) return null;
  if (record.expiresAt <= nowMs()) {
    memoryStore.delete(key);
    return null;
  }
  return record.value;
}
