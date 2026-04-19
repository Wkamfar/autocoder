/**
 * Frozen JSON shapes under Account.score_json (v1).
 * Central for parametric / prediction-market CRM — not a generic company table.
 */
import type { EvidenceRef } from './entities.js';

export const SCORE_JSON_KEYS = {
  opportunity_hypothesis: 'opportunity_hypothesis',
  icp_snapshot: 'icp_snapshot',
  outreach: 'outreach',
  candidate_routing: 'candidate_routing',
  pipeline: 'pipeline',
} as const;

/** Stored at account.score_json.opportunity_hypothesis */
export interface OpportunityHypothesisV1 {
  hypothesis_id: string;
  version: number;
  risk_thesis: string;
  likely_use_case: string;
  likely_buying_center: string;
  why_now: string;
  fit_score: number;
  source_evidence: EvidenceRef[];
  icp_binding: {
    sales_operating_profile_id?: string;
    icp_profile_ids: string[];
    scorer_version: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ICPScoreSnapshotV1 {
  version: string;
  computed_at: string;
  fit_score: number;
  components: Record<string, number>;
  explain: string[];
}

export interface OutreachReadinessV1 {
  state: 'not_eligible' | 'eligible_pending_review' | 'eligible';
  reason?: string;
}

export interface CandidateRoutingMetaV1 {
  bucket: 'promote' | 'watchlist' | 'discard';
  reason?: string;
  strategic_interest?: boolean;
}

export function isOpportunityHypothesisV1(x: unknown): x is OpportunityHypothesisV1 {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.hypothesis_id === 'string' &&
    typeof o.risk_thesis === 'string' &&
    typeof o.fit_score === 'number'
  );
}
