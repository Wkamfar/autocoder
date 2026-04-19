/**
 * Phase 3 — Decision engine (advisory; no CRM writes, no auto-debate).
 * JSON shape is stable for CLI `--json` and integrations.
 */

/** Canonical scoring payload — matches the Phase 3 product spec. */
export interface DecisionScore {
  deal_id: string;
  account_id: string;
  /** Display only — not used in ranking math. */
  account_name?: string;
  deal_name?: string;
  /** Nominal USD (from deal.value_cents / 100 when currency is USD). */
  deal_value: number;
  /** Days since last touch (0 if unknown). */
  staleness: number;
  /**
   * Stage bucket for prioritization — usually the CRM stage string;
   * high-touch stages (proposal, pricing, …) drive higher `stage_weight` internally.
   */
  stage_risk: string;
  /** 0..1 — pre-debate uncertainty model (staleness, objections, timing, stage). */
  uncertainty: number;
  /** 0..1 — expected upside from a quality debate on this deal right now. */
  expected_impact: number;
  /** 0..100 — rank key (higher = more important to debate soon). */
  priority_index: number;
  /** Human-readable reasons this deal matched trigger heuristics. */
  trigger_reasons: string[];
  /** Whether the engine recommends scheduling a Pair Debate soon (advisory only). */
  debate_recommended: boolean;
  /** Phase 5: additive boost from `SalesStrategyProfile` segment tuning (transparent). */
  learned_priority_boost?: number;
  /** Cites rates and n for the boost. */
  learned_priority_basis?: string;
}

export const DECISION_SCORE_SCHEMA_VERSION = '1' as const;
