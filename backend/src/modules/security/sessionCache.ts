/**
 * Session cache for fast-path auth and immediate revocation checks.
 *
 * - Uses Redis if REDIS_URL is set, otherwise falls back to in-memory cache.
 * - Cache is an optimization; DB remains the source of truth.
 */

import { Redis } from "ioredis";

type Cached<T> = { value: T; expiresAtMs: number };

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  // Best-effort connect; do not throw if unavailable.
  redis.connect().catch(() => null);
  return redis;
}

const mem = {
  tokenToSession: new Map<string, Cached<string>>(), // tokenHash -> sessionId
  userRevokeAllAt: new Map<string, Cached<number>>(), // userId -> epochMs
};

function nowMs(): number {
  return Date.now();
}

function cleanupMap<K, V>(m: Map<K, Cached<V>>) {
  const n = nowMs();
  for (const [k, v] of m.entries()) {
    if (v.expiresAtMs <= n) m.delete(k);
  }
}

export async function cacheSetTokenSession(tokenHash: string, sessionId: string, ttlSeconds: number): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.set(`sess:token:${tokenHash}`, sessionId, "EX", ttlSeconds).catch(() => null);
    return;
  }
  if (Math.random() < 0.01) cleanupMap(mem.tokenToSession);
  mem.tokenToSession.set(tokenHash, { value: sessionId, expiresAtMs: nowMs() + ttlSeconds * 1000 });
}

export async function cacheGetTokenSession(tokenHash: string): Promise<string | null> {
  const r = getRedis();
  if (r) {
    const v = await r.get(`sess:token:${tokenHash}`).catch(() => null);
    return v ?? null;
  }
  const e = mem.tokenToSession.get(tokenHash);
  if (!e) return null;
  if (e.expiresAtMs <= nowMs()) {
    mem.tokenToSession.delete(tokenHash);
    return null;
  }
  return e.value;
}

export async function cacheDelTokenSession(tokenHash: string): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.del(`sess:token:${tokenHash}`).catch(() => null);
    return;
  }
  mem.tokenToSession.delete(tokenHash);
}

export async function cacheSetUserRevokeAllAt(userId: string, epochMs: number, ttlSeconds: number): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.set(`sess:user_revoke_all_at:${userId}`, String(epochMs), "EX", ttlSeconds).catch(() => null);
    return;
  }
  if (Math.random() < 0.01) cleanupMap(mem.userRevokeAllAt);
  mem.userRevokeAllAt.set(userId, { value: epochMs, expiresAtMs: nowMs() + ttlSeconds * 1000 });
}

export async function cacheGetUserRevokeAllAt(userId: string): Promise<number | null> {
  const r = getRedis();
  if (r) {
    const v = await r.get(`sess:user_revoke_all_at:${userId}`).catch(() => null);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  const e = mem.userRevokeAllAt.get(userId);
  if (!e) return null;
  if (e.expiresAtMs <= nowMs()) {
    mem.userRevokeAllAt.delete(userId);
    return null;
  }
  return e.value;
}

