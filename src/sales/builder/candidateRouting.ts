/**
 * Watchlist vs discard vs promote (plan §6) — routing before mutation emission.
 */
import type { CandidateRoutingMetaV1 } from '../types/scoreJsonContracts.js';

export type CandidateBucket = 'promote' | 'watchlist' | 'discard';

export interface RouteCandidateInput {
  /** Overall match confidence 0..1 */
  confidence: number;
  /** Heuristic: strategically interesting vertical / segment even if data is thin */
  strategicallyInteresting?: boolean;
  /** Normalized domain present */
  hasDomain?: boolean;
  /** Valid-looking email */
  hasEmail?: boolean;
  /** Company name non-empty */
  hasCompany?: boolean;
}

const DISCARD_CONFIDENCE = 0.15;
const WATCHLIST_CONFIDENCE = 0.45;

/** Route a raw candidate to promote | watchlist | discard. */
export function routeCandidate(input: RouteCandidateInput): CandidateRoutingMetaV1 {
  const { confidence, strategicallyInteresting, hasDomain, hasEmail, hasCompany } = input;

  if (!hasCompany || !hasEmail) {
    return { bucket: 'discard', reason: 'missing_company_or_email' };
  }

  if (confidence < DISCARD_CONFIDENCE) {
    return { bucket: 'discard', reason: 'confidence_below_threshold' };
  }

  if (confidence < WATCHLIST_CONFIDENCE || (!hasDomain && !strategicallyInteresting)) {
    return {
      bucket: 'watchlist',
      reason: strategicallyInteresting ? 'thin_evidence_strategic' : 'thin_evidence',
      strategic_interest: strategicallyInteresting === true,
    };
  }

  return { bucket: 'promote', reason: 'meets_promotion_threshold' };
}
