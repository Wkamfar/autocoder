/**
 * Canonical freshness defaults for mined / ingested entities (plan §2.2).
 */
import type { Account, Contact, Deal } from '../types/entities.js';
import type { TrustLevel } from '../types/enums.js';
import { TrustLevel as TL } from '../types/enums.js';

export interface FreshnessFields {
  last_verified_at: string;
  freshness_score: number;
  stale_reason?: string;
}

/** Map trust at ingest time to initial freshness_score (0..1). */
export function freshnessScoreForTrust(trust: TrustLevel | string): number {
  switch (trust) {
    case TL.human_verified:
      return 1;
    case TL.high:
      return 0.92;
    case TL.medium:
      return 0.75;
    case TL.low:
      return 0.5;
    default:
      return 0.55;
  }
}

/** At ingest: set verification time and initial decay score. */
export function freshnessForIngest(atIso: string, trust: TrustLevel | string): FreshnessFields {
  return {
    last_verified_at: atIso,
    freshness_score: freshnessScoreForTrust(trust),
  };
}

/** Merge freshness into account/contact/deal patch. */
export function applyFreshnessToAccount(
  base: Partial<Account>,
  f: FreshnessFields
): Partial<Account> {
  return {
    ...base,
    last_verified_at: f.last_verified_at,
    freshness_score: f.freshness_score,
    stale_reason: f.stale_reason,
  };
}

export function applyFreshnessToContact(
  base: Partial<Contact>,
  f: FreshnessFields
): Partial<Contact> {
  return {
    ...base,
    last_verified_at: f.last_verified_at,
    freshness_score: f.freshness_score,
    stale_reason: f.stale_reason,
  };
}

export function applyFreshnessToDeal(base: Partial<Deal>, f: FreshnessFields): Partial<Deal> {
  return {
    ...base,
    last_verified_at: f.last_verified_at,
    freshness_score: f.freshness_score,
    stale_reason: f.stale_reason,
  };
}
