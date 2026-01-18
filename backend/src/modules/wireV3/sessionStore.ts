import { redis } from "../../lib/redis.js";
import { logger } from "../../lib/observability.js";
import type { ConfirmationSession } from "./types.js";

const SESSION_PREFIX = "wirev3:session:";
const CLIENT_ID_PREFIX = "wirev3:client:";

type InMemoryRecord = {
  value: ConfirmationSession;
  expiresAt: number;
};

const memoryStore = new Map<string, InMemoryRecord>();

function nowMs() {
  return Date.now();
}

function toSeconds(ms: number) {
  return Math.max(1, Math.ceil(ms / 1000));
}

function getExpiryMs(session: ConfirmationSession): number {
  const expiresAtMs = new Date(session.expiresAt).getTime();
  return Math.max(0, expiresAtMs - nowMs());
}

function getSessionKey(sessionId: string) {
  return `${SESSION_PREFIX}${sessionId}`;
}

function getClientKey(orgId: string, userId: string, clientConfirmationId: string) {
  return `${CLIENT_ID_PREFIX}${orgId}:${userId}:${clientConfirmationId}`;
}

export async function createSession(session: ConfirmationSession): Promise<void> {
  const key = getSessionKey(session.id);
  const ttlMs = getExpiryMs(session);
  const payload = JSON.stringify(session);

  if (redis) {
    const ttl = toSeconds(ttlMs);
    await redis.set(key, payload, "EX", ttl);
    return;
  }

  logger.warn("Redis unavailable, storing session in memory", { sessionId: session.id });
  memoryStore.set(key, { value: session, expiresAt: nowMs() + ttlMs });
}

export async function getSession(sessionId: string): Promise<ConfirmationSession | null> {
  const key = getSessionKey(sessionId);

  if (redis) {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as ConfirmationSession) : null;
  }

  const record = memoryStore.get(key);
  if (!record) return null;
  if (record.expiresAt <= nowMs()) {
    memoryStore.delete(key);
    return null;
  }
  return record.value;
}

export async function updateSession(
  sessionId: string,
  patch: Partial<ConfirmationSession>
): Promise<ConfirmationSession | null> {
  const current = await getSession(sessionId);
  if (!current) return null;
  const updated: ConfirmationSession = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await createSession(updated);
  return updated;
}

export async function linkClientConfirmationId(params: {
  orgId: string;
  userId: string;
  clientConfirmationId: string;
  sessionId: string;
  expiresAt: string;
}): Promise<void> {
  const key = getClientKey(params.orgId, params.userId, params.clientConfirmationId);
  const ttlMs = Math.max(0, new Date(params.expiresAt).getTime() - nowMs());

  if (redis) {
    await redis.set(key, params.sessionId, "EX", toSeconds(ttlMs));
    return;
  }

  logger.warn("Redis unavailable, storing clientConfirmationId in memory", {
    clientConfirmationId: params.clientConfirmationId,
  });
  memoryStore.set(key, { value: params.sessionId as any, expiresAt: nowMs() + ttlMs });
}

export async function getSessionByClientConfirmationId(params: {
  orgId: string;
  userId: string;
  clientConfirmationId: string;
}): Promise<ConfirmationSession | null> {
  const key = getClientKey(params.orgId, params.userId, params.clientConfirmationId);

  if (redis) {
    const sessionId = await redis.get(key);
    if (!sessionId) return null;
    return await getSession(sessionId);
  }

  const record = memoryStore.get(key);
  if (!record) return null;
  if (record.expiresAt <= nowMs()) {
    memoryStore.delete(key);
    return null;
  }
  const sessionId = record.value as unknown as string;
  return await getSession(sessionId);
}
