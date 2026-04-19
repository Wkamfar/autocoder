/**
 * Phase 5 — Compounding intelligence (interpretable; no black-box ML).
 * `SalesStrategyProfile` is derived from local outcome logs + optional CRM world join.
 */

import type { HistoricalPattern } from '../pairDebate/types.js';

export const STRATEGY_PROFILE_SCHEMA_VERSION = '1' as const;

/** Segment dimensions for differentiation (all optional; unknowns allowed). */
export interface StrategySegment {
  /** Normalized CRM stage substring, e.g. proposal */
  stage_substring?: string;
  /** Deal size bucket from nominal USD. */
  deal_value_bucket?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'unknown';
  /** From your taxonomy — optional. */
  industry?: string;
  /** e.g. economic_buyer, champion */
  buyer_persona?: string;
}

/**
 * One extracted pattern with transparent counts — may be anecdotal below sample floor.
 */
export interface LearnedStrategyPattern {
  /** Stable slug for references, e.g. lp_stalled_proposal */
  id: string;
  /** Human-readable title */
  label: string;
  /** Primary grouping key, e.g. scenario tag or composite segment */
  scenario_key: string;
  segment?: StrategySegment;
  sample_size: number;
  /** replied_positive | replied_neutral over rows with known outcome */
  positive_signal_rate?: number;
  /** Rows with known outcome (denominator for rate) */
  known_outcomes?: number;
  /** Most frequent motion label in this bucket (email_type / debate_decision) */
  dominant_followup?: string;
  strength: 'strong' | 'anecdotal';
  /** Plain-English interpretation — always shown to humans */
  interpretation: string;
}

/** Per-segment bullets for adaptive prompts (short, cite n). */
export interface SegmentStrategyHint {
  segment_key: string;
  segment?: StrategySegment;
  bias_bullets: string[];
  pattern_ids: string[];
}

/**
 * Transparent adjustment suggestions for Phase 3 `priority_index`.
 * Applied as additive boost with cap; rationale is always stored.
 */
export interface SegmentPriorityTuning {
  segment_key: string;
  segment?: StrategySegment;
  /** Suggested 0–20 points added when deal matches segment (interpretable heuristic). */
  priority_boost_suggestion: number;
  /** Why this boost exists — cites rates and n */
  basis: string;
  sample_size: number;
}

export interface StrategyExtractionMeta {
  extracted_at: string;
  outcome_rows_used: number;
  outcome_rows_with_tags: number;
  min_sample_floor: number;
  /** Honesty warnings — small n, missing tags, etc. */
  warnings: string[];
}

/**
 * Company-local strategy — how *you* win, learned from *your* logs.
 */
export interface SalesStrategyProfile {
  schema_version: typeof STRATEGY_PROFILE_SCHEMA_VERSION;
  company_id?: string;
  updated_at: string;
  /** Suggested tone bias for Closer (interpretable label). */
  tone?: string;
  /** Dominant winning motion across positive signals (when inferable). */
  best_followup_type?: string;
  /** Things to avoid — from override reasons + heuristic tags */
  avoid: string[];
  /** Structured patterns (tag- and segment- keyed) */
  strong_patterns: LearnedStrategyPattern[];
  /** Reusable historical-pattern rows for dossier (subset or copy) */
  pattern_summaries: HistoricalPattern[];
  segment_hints: SegmentStrategyHint[];
  segment_priority_tunings: SegmentPriorityTuning[];
  extraction: StrategyExtractionMeta;
}
