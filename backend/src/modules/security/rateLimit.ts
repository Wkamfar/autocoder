/**
 * Agent B: Rate Limiting & Abuse Protection
 * 
 * Redis-backed rate limiting (bank-grade default when REDIS_URL is configured)
 * with safe in-memory fallback for lightweight/dev environments.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { RATE_LIMIT_CONFIG } from "./config.js";
import { redis as redisClient } from "../../lib/redis.js";
import { logger, recordRateLimitEvent } from "../../lib/observability.js";

type RateLimitStore = Map<string, { count: number; resetAt: number }>;

const stores: Map<string, RateLimitStore> = new Map();

function getStore(key: string): RateLimitStore {
  if (!stores.has(key)) {
    stores.set(key, new Map());
  }
  return stores.get(key)!;
}

function getIp(req: FastifyRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded || req.ip || "unknown";
  return String(ip);
}

function cleanupExpired(store: RateLimitStore): void {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.resetAt < now) {
      store.delete(key);
    }
  }
}

export type RateLimitScope = "ip" | "user" | "org";

export type RedisLike = {
  incr(key: string): Promise<number>;
  pttl(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<number>;
};

async function consumeInMemoryFixedWindow(params: {
  storeKey: string;
  windowMs: number;
  max: number;
}): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  const store = getStore(params.storeKey);

  // Periodic cleanup
  if (Math.random() < 0.01) {
    cleanupExpired(store);
  }

  const now = Date.now();
  const entry = store.get(params.storeKey);

  if (!entry || entry.resetAt < now) {
    store.set(params.storeKey, { count: 1, resetAt: now + params.windowMs });
    return { allowed: true };
  }

  entry.count++;
  if (entry.count > params.max) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true };
}

export async function consumeRedisFixedWindow(params: {
  redis: RedisLike;
  storeKey: string;
  windowMs: number;
  max: number;
}): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  // Fixed window: INCR + (ensure) PEXPIRE + TTL for retry-after.
  const count = await params.redis.incr(params.storeKey);
  let ttl = await params.redis.pttl(params.storeKey);

  // If TTL missing, set it (best-effort).
  if (ttl < 0) {
    await params.redis.pexpire(params.storeKey, params.windowMs);
    ttl = params.windowMs;
  }

  if (count > params.max) {
    const retryAfterSec = Math.max(1, Math.ceil(ttl / 1000));
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true };
}

function getScopeId(req: FastifyRequest, scope: RateLimitScope): string | null {
  if (scope === "ip") return `ip:${getIp(req)}`;
  if (scope === "user") return req.user?.id ? `user:${req.user.id}` : null;
  if (scope === "org") return req.user?.orgId ? `org:${req.user.orgId}` : null;
  return null;
}

let _orgMultiplierCache: { raw: string; map: Map<string, number> } = { raw: "", map: new Map() };

function getOrgRateLimitMultiplier(orgId: string): number {
  const raw = process.env.RATE_LIMIT_ORG_MULTIPLIERS || "{}";
  if (_orgMultiplierCache.raw !== raw) {
    _orgMultiplierCache.raw = raw;
    _orgMultiplierCache.map = new Map();
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed || {})) {
        const n = typeof v === "number" ? v : Number(v);
        if (Number.isFinite(n) && n > 0) _orgMultiplierCache.map.set(k, n);
      }
    } catch {
      // ignore parse failures (fallback to default)
    }
  }

  const defaultMult = Number(process.env.RATE_LIMIT_DEFAULT_ORG_MULTIPLIER || "1");
  const base = Number.isFinite(defaultMult) && defaultMult > 0 ? defaultMult : 1;
  return _orgMultiplierCache.map.get(orgId) ?? base;
}

export function createRateLimitMiddleware(config: {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  scopes?: RateLimitScope[];
  redisKeyPrefix?: string;
}) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const scopes: RateLimitScope[] = (config.scopes && config.scopes.length)
        ? config.scopes
        : ["ip"];

      const redis = redisClient as unknown as RedisLike | null;

      for (const scope of scopes) {
        const id = getScopeId(req, scope);
        if (!id) continue; // scope not applicable (e.g., user/org before auth)

        const storeKey = `${config.redisKeyPrefix || "rl"}:${config.keyPrefix || "default"}:${id}`;
        const limiterName = config.keyPrefix || "default";

        // Tiered org quota policy: apply an org-specific multiplier to org-scoped limits.
        const effectiveMax =
          scope === "org" && req.user?.orgId
            ? Math.max(1, Math.floor(config.max * getOrgRateLimitMultiplier(req.user.orgId)))
            : config.max;

        const res = redis
          ? await consumeRedisFixedWindow({ redis, storeKey, windowMs: config.windowMs, max: effectiveMax })
          : await consumeInMemoryFixedWindow({ storeKey, windowMs: config.windowMs, max: effectiveMax });

        if (!res.allowed) {
          const retryAfter = res.retryAfterSec ?? 1;
          recordRateLimitEvent({ limiter: limiterName, scope, result: "blocked" });
          reply.code(429).header("Retry-After", String(retryAfter)).send({
            error: "Rate limit exceeded",
            code: "RATE_LIMIT_EXCEEDED",
            retryAfter,
          });
          return;
        }

        recordRateLimitEvent({ limiter: limiterName, scope, result: "allowed" });
      }
    } catch (error) {
      // Don't fail the request if rate limiting fails (but log).
      logger.error("rate_limiting_error", error as any);
    }
  };
}

export const rateLimiters = {
  // Global (pre-auth): limit by IP (or user if req.user already populated via API key auth)
  global: createRateLimitMiddleware({ ...RATE_LIMIT_CONFIG.global, keyPrefix: "global", scopes: ["ip", "user"] }),

  // Post-auth: enforce both per-user and per-org limits (bank-grade tenant protection)
  authenticated: async (req: FastifyRequest, reply: FastifyReply) => {
    await createRateLimitMiddleware({
      ...RATE_LIMIT_CONFIG.authenticatedUser,
      keyPrefix: "authed_user",
      scopes: ["user"],
    })(req, reply);
    if (reply.sent) return;
    await createRateLimitMiddleware({
      ...RATE_LIMIT_CONFIG.authenticatedOrg,
      keyPrefix: "authed_org",
      scopes: ["org"],
    })(req, reply);
  },

  login: createRateLimitMiddleware({ ...RATE_LIMIT_CONFIG.login, keyPrefix: "login", scopes: ["ip"] }),
  challenge: createRateLimitMiddleware({ ...RATE_LIMIT_CONFIG.challenge, keyPrefix: "challenge", scopes: ["ip", "user", "org"] }),
};
