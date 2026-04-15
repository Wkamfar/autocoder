/** Frozen v1 buyer state labels (may also be free text prefixed). */
export type BuyerStateHypothesis =
  | 'unaware'
  | 'interested_but_busy'
  | 'politically_blocked'
  | 'budget_constrained'
  | 'comparing_options'
  | 'silent_rejection_likely'
  | 'other';

export interface DisagreementEntry {
  /** Stable id for merge (uuid or slug). */
  id: string;
  topic: string;
  closer_view: string;
  buyer_mind_view: string;
  status: 'open' | 'resolved';
  resolution_reason?: string;
}

/** Shared scratchpad — both roles read/update via merge rules. */
export interface PairDebateBlackboard {
  facts_locked: string[];
  hypotheses: string[];
  open_questions: string[];
  missing_evidence: string[];
  risks: string[];
  buyer_state_hypothesis: BuyerStateHypothesis | string;
  disagreement_register: DisagreementEntry[];
  recommended_next_move: string | null;
  draft_email_v_next: string | null;
}

export interface DossierTiming {
  decision_deadline: string | null;
  timing_sensitivity: 'low' | 'medium' | 'high' | string;
}

/** Aggregated from logged outcomes — injected into dossier for experience-weighted reasoning. */
export interface HistoricalPattern {
  scenario: string;
  best_action: string;
  win_rate?: number;
  sample_size?: number;
  notes?: string;
  /** strong = sample_size >= min floor; anecdotal = below floor or seed */
  pattern_strength?: 'strong' | 'anecdotal';
}

/** Truth layer built from CRM / world file + context builder. */
export interface DossierPack {
  scope_label: string;
  /** Full text block for prompts. */
  body: string;
  timing: DossierTiming;
  /** Optional; also folded into `body` when present. */
  historical_patterns?: HistoricalPattern[];
  /** Phase 5: when dossier is deal-scoped, enables adaptive prompt + segment match. */
  strategy_context?: {
    deal_stage?: string;
    deal_value_usd?: number;
  };
}

export interface PairDebateTurnRecord {
  round: number;
  role: 'closer' | 'buyer_mind';
  raw_response: string;
  blackboard_after: PairDebateBlackboard;
}

export interface PairDebateRunResult {
  /** Same id as JSONL filename stem and outcome log linkage. */
  run_id: string;
  dossier: DossierPack;
  turns: PairDebateTurnRecord[];
  final_blackboard: PairDebateBlackboard;
  synthesis: FinalDebateSynthesis;
  logPath: string;
  total_cost_usd: number;
  total_tokens: number;
}

/** Forced final JSON shape (v1). */
export interface FinalDebateSynthesis {
  agreement: string[];
  remaining_disagreements: Array<
    string | { topic: string; closer_view?: string; buyer_mind_view?: string }
  >;
  recommended_single_next_step: string;
  why_now: string;
  what_could_go_wrong: string[];
  human_decision_required: boolean;
  draft_artifact: {
    type: string;
    content: string;
  };
  confidence?: string;
  what_would_change_the_recommendation?: string[];
}

/** Logged after a human acts on a debate recommendation — feeds pattern recall. */
export interface PairDebateOutcomeRecord {
  ts: string;
  run_id: string;
  account_id?: string;
  deal_id?: string;
  contact_id?: string;
  debate_decision?: string;
  email_type?: string;
  action_taken?: 'sent_email' | 'waited' | 'skipped' | 'other';
  outcome?: 'replied_positive' | 'replied_neutral' | 'replied_negative' | 'no_reply' | 'unknown';
  time_to_reply_hours?: number;
  stage_change?: string;
  debate_helpful?: boolean;
  /** Used to aggregate win rates, e.g. stalled_proposal, pricing_pushback */
  scenario_tags?: string[];
  notes?: string;
  /** Did the org execute the recommended next step from synthesis? */
  recommended_action_used?: boolean;
  /** Was the draft email sent verbatim? */
  draft_used_as_is?: boolean;
  /** How much the human edited before sending */
  human_modified?: 'none' | 'light' | 'heavy';
  /** 1–5: perceived helpfulness of the debate artifact */
  human_helpfulness_score?: 1 | 2 | 3 | 4 | 5;
  /**
   * If recommendation was not followed, why (free text or token).
   * Examples: preferred_relationship_tone, knew_private_context, timing_changed,
   * buyer_replied_before_send, output_not_sharp_enough, disagreed_with_strategy, other
   */
  human_override_reason?: string;
}
