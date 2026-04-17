import type {
  ActivityType,
  AssignedMode,
  CRMMutationStatus,
  CRMMutationType,
  DealStage,
  EdgeType,
  EntityRefType,
  EntityResolutionOutcome,
  EvidenceRefKind,
  HumanGateReason,
  MutationApplyResult,
  ReplyClass,
  SalesActionStatus,
  SequenceState,
  TrustLevel,
} from './enums.js';
import type { CRMEntitySourceType } from './enums.js';

export interface EvidenceRef {
  kind: EvidenceRefKind;
  ref_id: string;
}

export interface CRMEntitySource {
  id: string;
  source_type: CRMEntitySourceType | string;
  source_id: string;
  adapter_scope: string;
  imported_at: string;
  trust_level: TrustLevel | string;
  raw_ref?: string;
  metadata?: Record<string, unknown>;
}

export interface EntityResolutionDecision {
  id: string;
  candidate_refs: EvidenceRef[];
  matched_entity_type?: EntityRefType;
  matched_entity_id?: string;
  confidence: number;
  outcome: EntityResolutionOutcome;
  explanation: string;
  created_at: string;
}

export interface CRMMutation {
  id: string;
  idempotency_key: string;
  mutation_type: CRMMutationType;
  target_entity_type: EntityRefType | string;
  target_entity_id?: string;
  secondary_target_id?: string;
  proposed_payload: Record<string, unknown>;
  confidence_score: number;
  source_evidence: EvidenceRef[];
  explanation: string;
  status: CRMMutationStatus;
  auto_apply_allowed: boolean;
  approved_by?: string;
  approved_at?: string;
  applied_at?: string;
  last_apply_result?: MutationApplyResult;
  apply_error_detail?: string;
  reject_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  name: string;
  domain?: string;
  segment?: string;
  owner_user_id?: string;
  last_verified_at?: string;
  freshness_score?: number;
  stale_reason?: string;
  score_json?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  account_id?: string;
  email?: string;
  full_name?: string;
  title?: string;
  owner_user_id?: string;
  last_verified_at?: string;
  freshness_score?: number;
  stale_reason?: string;
  score_json?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  account_id: string;
  contact_id?: string;
  owner_id?: string;
  assigned_mode: AssignedMode;
  deal_stage: DealStage | string;
  last_contacted_at?: string;
  last_verified_at?: string;
  freshness_score?: number;
  stale_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface RelationshipEdge {
  id: string;
  from_entity_type: EntityRefType;
  from_entity_id: string;
  to_entity_type: EntityRefType;
  to_entity_id: string;
  edge_type: EdgeType | string;
  confidence: number;
  source_evidence: EvidenceRef[];
  created_at: string;
  superseded_by_edge_id?: string;
}

export interface SuppressionRecord {
  email: string;
  reason: string;
  timestamp: string;
  source_ref?: string;
}

export interface Activity {
  id: string;
  activity_type: ActivityType;
  entity_type?: EntityRefType | string;
  entity_id?: string;
  payload?: Record<string, unknown>;
  sales_action_id?: string;
  crm_mutation_id?: string;
  created_at: string;
}

export interface SalesAction {
  id: string;
  idempotency_key: string;
  action_type: string;
  account_id?: string;
  contact_id?: string;
  deal_id?: string;
  status: SalesActionStatus;
  risk_level: 'low' | 'medium' | 'high';
  payload: Record<string, unknown>;
  context_snapshot: Record<string, unknown>;
  approval_required: boolean;
  approved_by?: string;
  approved_at?: string;
  human_gate_reason?: HumanGateReason;
  execution_result?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ICPProfile {
  id: string;
  segment_name: string;
  required_traits: Record<string, unknown>;
  weighted_attributes: { key: string; weight: number }[];
  version: number;
}

export interface SalesOperatingProfile {
  id: string;
  /** Human-readable name */
  name: string;
  /** ICP profile ids to consider */
  icp_profile_ids: string[];
  /** Free-form priorities for planner weights */
  priorities: string[];
  /** e.g. enterprise deal_stage requires human review */
  review_rules: Record<string, unknown>;
  autonomy_tier: 1 | 2 | 3;
  updated_at: string;
}

export interface SequenceStep {
  step_index: number;
  condition: string;
  action: string;
}

export interface Sequence {
  id: string;
  name: string;
  steps: SequenceStep[];
  sequence_state: SequenceState;
  created_at: string;
  updated_at: string;
}

/** CustomerContextBuilder output — read-only planning snapshot. */
export interface CustomerContextSnapshot {
  built_at: string;
  account?: Account;
  contacts: Contact[];
  deals: Deal[];
  recent_activities: Activity[];
  relationship_edges: RelationshipEdge[];
}

export interface ReplyClassification {
  reply_class: ReplyClass;
  confidence: number;
  rationale: string;
}
