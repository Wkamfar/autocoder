/**
 * Phase 4 — executable sales actions (controlled autonomy).
 * Schema is audit-friendly: every field is intentional for replay and compliance review.
 */

/** How the action may be carried out. Phase 4 rollout starts with `assisted` only. */
export type ExecutionMode = 'human' | 'assisted' | 'auto';

/** Lifecycle of an executable unit. */
export type SalesActionStatus =
  | 'draft'
  | 'pending_policy'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed'
  | 'cancelled';

export type SalesActionOrigin = 'pair_debate' | 'single_decision' | 'manual' | string;

/** Known action kinds — extend with string for CRM-specific types. */
export type SalesActionType =
  | 'send_followup'
  | 'send_scheduling_nudge'
  | 'internal_note'
  | string;

export interface SalesActionRecipient {
  email?: string;
  contact_id?: string;
}

/**
 * Executable sales action — suggestion becomes a unit that can pass policy,
 * collect approval, and be logged end-to-end.
 */
export interface SalesAction {
  action_id: string;
  action_type: SalesActionType;
  status: SalesActionStatus;
  execution_mode: ExecutionMode;
  /** If true, execution must not proceed without explicit human approval record. */
  approval_required: boolean;
  origin?: SalesActionOrigin;
  /** Pair Debate / single-decision run id when applicable. */
  run_id?: string;
  deal_id?: string;
  account_id?: string;
  /** Short summary of why this action exists (debate synthesis, rep note, …). */
  decision_context?: string;
  /** Payload to send or that was sent (email body, etc.). */
  final_message?: string;
  recipient?: SalesActionRecipient;
  created_at: string;
  /** Human or system principal that approved (email, id, or `system`). */
  approved_by?: string;
  approved_at?: string;
  /** When the adapter reported send success (ISO 8601). */
  executed_at?: string;
  /** Free-text outcome hook for CRM or outcomes pipeline. */
  outcome_notes?: string;
  /** Last policy evaluation attached for audit/replay. */
  policy_evaluation?: PolicyEvaluation;
}

/** Runtime context not always stored on the action (passed into policy engine). */
export interface SalesActionPolicyContext {
  deal_value_usd?: number;
  /** Forces approval gate when true (enterprise / strategic accounts). */
  enterprise_deal?: boolean;
  /** Recipient resolved at send time. */
  recipient_email?: string;
  message_body?: string;
  /** Suppression: account-level opt-out of automation. */
  account_opted_out?: boolean;
}

/** One layer result inside a policy check. */
export interface PolicyLayerResult {
  ok: boolean;
  violations: string[];
}

export interface PolicyEvaluation {
  evaluated_at: string;
  allowed: boolean;
  layers: {
    policy: PolicyLayerResult;
    suppression: PolicyLayerResult;
    approval: PolicyLayerResult & {
      /** True if human approval is mandatory before send. */
      requires_human_approval: boolean;
    };
  };
  /**
   * Mode the pipeline may use after policy (e.g. downgrade `auto` → `assisted`
   * when auto-send is disabled globally).
   */
  effective_execution_mode: ExecutionMode;
  notes: string[];
}

export const SALES_ACTION_SCHEMA_VERSION = '1' as const;
