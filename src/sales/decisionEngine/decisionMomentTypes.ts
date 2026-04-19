/** Phase 8 — predictive decision moments (zero-command UX). */

export interface DecisionMoment {
  deal_id: string;
  moment_type: string;
  priority: number;
  /** 0..1 — interpretable composite */
  confidence: number;
  expires_at: string;
  recommended_action: 'run_debate' | 'review' | string;
  why_now: string[];
  account_label?: string;
  value_usd?: number;
}
