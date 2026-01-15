/**
 * Agent D: Performance Optimizations
 * 
 * Caching and optimization helpers for intent operations
 */

import { prisma } from "../../db/prisma.js";

/**
 * Cache for intent status checks (short TTL)
 */
const intentStatusCache = new Map<string, { status: string; expiresAt: number }>();
const CACHE_TTL_MS = 5000; // 5 seconds

/**
 * Get intent status with caching
 */
export async function getIntentStatusCached(
  intentId: string,
  orgId: string
): Promise<string | null> {
  const cacheKey = `${orgId}:${intentId}`;
  const cached = intentStatusCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.status;
  }

  const intent = await prisma.intent.findFirst({
    where: { id: intentId, orgId },
    select: { status: true },
  });

  if (!intent) {
    return null;
  }

  intentStatusCache.set(cacheKey, {
    status: intent.status,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return intent.status;
}

/**
 * Invalidate intent status cache
 */
export function invalidateIntentStatusCache(intentId: string): void {
  intentStatusCache.delete(intentId);
}

/**
 * Batch fetch intents with optimized query
 */
export async function batchGetIntents(
  intentIds: string[],
  orgId: string
): Promise<Map<string, any>> {
  if (intentIds.length === 0) {
    return new Map();
  }

  const intents = await prisma.intent.findMany({
    where: {
      id: { in: intentIds },
      orgId,
    },
    select: {
      id: true,
      status: true,
      bindingHash: true,
      version: true,
      requiredApprovals: true,
    },
  });

  return new Map(intents.map((intent) => [intent.id, intent]));
}

/**
 * Clean expired cache entries
 */
export function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of intentStatusCache.entries()) {
    if (value.expiresAt <= now) {
      intentStatusCache.delete(key);
    }
  }
}

// Clean cache every minute
if (typeof setInterval !== "undefined") {
  setInterval(cleanExpiredCache, 60000);
}
