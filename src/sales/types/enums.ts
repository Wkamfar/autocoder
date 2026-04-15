/** Closed enums — no string drift outside these sets. */

export const CRMMutationStatus = {
  proposed: 'proposed',
  policy_blocked: 'policy_blocked',
  awaiting_approval: 'awaiting_approval',
  approved: 'approved',
  applied: 'applied',
  rejected: 'rejected',
  failed: 'failed',
  canceled: 'canceled',
} as const;
export type CRMMutationStatus =
  (typeof CRMMutationStatus)[keyof typeof CRMMutationStatus];

export const MutationApplyResult = {
  applied: 'applied',
  noop: 'noop',
  partial: 'partial',
  failed: 'failed',
  superseded: 'superseded',
} as const;
export type MutationApplyResult =
  (typeof MutationApplyResult)[keyof typeof MutationApplyResult];

export const SalesActionStatus = {
  proposed: 'proposed',
  policy_blocked: 'policy_blocked',
  suppressed: 'suppressed',
  awaiting_approval: 'awaiting_approval',
  approved: 'approved',
  executing: 'executing',
  completed: 'completed',
  failed: 'failed',
  canceled: 'canceled',
} as const;
export type SalesActionStatus =
  (typeof SalesActionStatus)[keyof typeof SalesActionStatus];

export const DealStage = {
  new_lead: 'new_lead',
  enriched: 'enriched',
  working: 'working',
  qualified: 'qualified',
  meeting_booked: 'meeting_booked',
  proposal: 'proposal',
  closed_won: 'closed_won',
  closed_lost: 'closed_lost',
} as const;
export type DealStage = (typeof DealStage)[keyof typeof DealStage];

export const SequenceState = {
  active: 'active',
  paused: 'paused',
  completed: 'completed',
  suppressed: 'suppressed',
} as const;
export type SequenceState = (typeof SequenceState)[keyof typeof SequenceState];

export const ReplyClass = {
  positive_intent: 'positive_intent',
  neutral: 'neutral',
  not_now: 'not_now',
  objection: 'objection',
  unsubscribe: 'unsubscribe',
  spam_risk: 'spam_risk',
} as const;
export type ReplyClass = (typeof ReplyClass)[keyof typeof ReplyClass];

export const AssignedMode = {
  auto: 'auto',
  human: 'human',
} as const;
export type AssignedMode = (typeof AssignedMode)[keyof typeof AssignedMode];

export const HumanGateReason = {
  high_value_deal: 'high_value_deal',
  policy_requirement: 'policy_requirement',
  external_send: 'external_send',
  legal_risk: 'legal_risk',
  uncertain_classification: 'uncertain_classification',
  manual_override: 'manual_override',
} as const;
export type HumanGateReason =
  (typeof HumanGateReason)[keyof typeof HumanGateReason];

export const CRMMutationType = {
  create_account: 'create_account',
  update_account: 'update_account',
  create_contact: 'create_contact',
  update_contact: 'update_contact',
  merge_contact: 'merge_contact',
  create_deal: 'create_deal',
  update_deal_stage: 'update_deal_stage',
  attach_relationship: 'attach_relationship',
  mark_suppressed: 'mark_suppressed',
  mark_stale: 'mark_stale',
  assign_owner: 'assign_owner',
} as const;
export type CRMMutationType =
  (typeof CRMMutationType)[keyof typeof CRMMutationType];

export const EntityRefType = {
  account: 'account',
  contact: 'contact',
  deal: 'deal',
  user: 'user',
  product_line: 'product_line',
  merge_pair: 'merge_pair',
} as const;
export type EntityRefType = (typeof EntityRefType)[keyof typeof EntityRefType];

export const EdgeType = {
  knows: 'knows',
  works_at: 'works_at',
  intro_path: 'intro_path',
  replied_to: 'replied_to',
  customer_of: 'customer_of',
  investor_can_intro: 'investor_can_intro',
  email_thread_with: 'email_thread_with',
  custom: 'custom',
} as const;
export type EdgeType = (typeof EdgeType)[keyof typeof EdgeType];

export const EntityResolutionOutcome = {
  merge: 'merge',
  create_new: 'create_new',
  await_review: 'await_review',
  link_to_account: 'link_to_account',
} as const;
export type EntityResolutionOutcome =
  (typeof EntityResolutionOutcome)[keyof typeof EntityResolutionOutcome];

export const ActivityType = {
  email_drafted: 'email_drafted',
  approval_requested: 'approval_requested',
  email_sent: 'email_sent',
  reply_received: 'reply_received',
  stage_changed: 'stage_changed',
  suppression_added: 'suppression_added',
  ownership_changed: 'ownership_changed',
  meeting_booked: 'meeting_booked',
  crm_mutation_proposed: 'crm_mutation_proposed',
  crm_mutation_applied: 'crm_mutation_applied',
  contact_merged: 'contact_merged',
  revenue_metric_recorded: 'revenue_metric_recorded',
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export const EvidenceRefKind = {
  crm_entity_source: 'crm_entity_source',
  activity: 'activity',
  sales_action: 'sales_action',
  manual_attestation: 'manual_attestation',
} as const;
export type EvidenceRefKind =
  (typeof EvidenceRefKind)[keyof typeof EvidenceRefKind];

export const CRMEntitySourceType = {
  gmail_metadata: 'gmail_metadata',
  outlook: 'outlook',
  calendar: 'calendar',
  csv_row: 'csv_row',
  form_submit: 'form_submit',
  manual_import: 'manual_import',
  product_signup: 'product_signup',
  spreadsheet: 'spreadsheet',
  meeting_transcript: 'meeting_transcript',
  founder_export: 'founder_export',
} as const;
export type CRMEntitySourceType =
  (typeof CRMEntitySourceType)[keyof typeof CRMEntitySourceType];

export const TrustLevel = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  human_verified: 'human_verified',
} as const;
export type TrustLevel = (typeof TrustLevel)[keyof typeof TrustLevel];
