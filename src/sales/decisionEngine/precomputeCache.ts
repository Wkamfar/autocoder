import type { PairDebateRunResult } from '../pairDebate/types.js';

/** In-memory debate cache for Phase 8 ready-mode (TTL). */
const cache = new Map<string, { result: PairDebateRunResult; expires: number }>();
const TTL_MS = 45 * 60 * 1000;

export function cachePrecomputedDebate(dealId: string, result: PairDebateRunResult): void {
  cache.set(dealId, { result, expires: Date.now() + TTL_MS });
}

export function peekPrecomputedDebate(dealId: string): PairDebateRunResult | null {
  const row = cache.get(dealId);
  if (!row || Date.now() > row.expires) return null;
  return row.result;
}

export function takePrecomputedDebate(dealId: string): PairDebateRunResult | null {
  const row = cache.get(dealId);
  if (!row || Date.now() > row.expires) {
    cache.delete(dealId);
    return null;
  }
  cache.delete(dealId);
  return row.result;
}

export function clearPrecomputedDebate(dealId: string): void {
  cache.delete(dealId);
}
