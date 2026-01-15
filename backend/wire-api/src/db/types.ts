/**
 * Database Type Definitions
 * 
 * TypeScript types matching the PostgreSQL schema
 * Ensures type safety across the application
 */

export type UserRole = 'ADMIN' | 'TREASURY_INITIATOR' | 'APPROVER' | 'AUDITOR' | 'READ_ONLY';
export type RailsType = 'ACH' | 'WIRE';
export type IntentStatus = 'DRAFT' | 'PENDING_PROOF' | 'CHALLENGING' | 'PENDING_APPROVALS' | 'APPROVED' | 'DENIED' | 'EXECUTED' | 'EXPIRED' | 'CANCELED';
export type BeneficiaryStatus = 'ACTIVE' | 'LOCKED' | 'PENDING_VERIFICATION';
export type ApprovalStatus = 'PENDING' | 'COMPLETED' | 'DENIED' | 'EXPIRED';
export type ChallengeLevel = 'L1' | 'L2' | 'L3';
export type ChallengeLanguage = 'EN' | 'ES';
export type ProofChannel = 'BROWSER' | 'PHONE';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface User {
  id: string;
  org_id: string;
  email: string;
  password_hash: string;
  name: string | null;
  role: UserRole;
  mfa_enabled: boolean;
  mfa_secret: string | null;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  voice_enrolled: boolean;
  voice_enrolled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  refresh_token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  device_fingerprint: string | null;
  expires_at: Date;
  created_at: Date;
  last_used_at: Date;
}

export interface Organization {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface Beneficiary {
  id: string;
  org_id: string;
  display_name: string;
  country: string;
  rails_allowed: RailsType[];
  bank_routing_number: string | null;
  bank_account_number_encrypted: string;
  bank_account_last4: string;
  bank_token_hash: string | null;
  account_type: string | null;
  version: number;
  status: BeneficiaryStatus;
  verification_status: string;
  kyc_status: string | null;
  kyc_expiry: Date | null;
  sanctions_check_status: string | null;
  sanctions_check_date: Date | null;
  micro_deposit_verified: boolean;
  micro_deposit_amount1_cents: number | null;
  micro_deposit_amount2_cents: number | null;
  created_at: Date;
  updated_at: Date;
  last_changed_at: Date;
  last_changed_by: string | null;
}

export interface Intent {
  id: string;
  org_id: string;
  created_by_user_id: string;
  rails_type: RailsType;
  amount_minor: number;
  currency: string;
  beneficiary_id: string;
  beneficiary_version: number;
  purpose: string;
  status: IntentStatus;
  risk_score: number;
  risk_rationale_json: Record<string, any>;
  required_approvals: number;
  required_challenge_level: ChallengeLevel;
  binding_hash: string;
  cooldown_until: Date | null;
  created_at: Date;
  updated_at: Date;
  submitted_at: Date | null;
  executed_at: Date | null;
}

export interface Approval {
  id: string;
  intent_id: string;
  approver_user_id: string;
  status: ApprovalStatus;
  decision_type: 'APPROVE' | 'DENY' | 'STEP_UP' | null;
  reason_codes: any[] | null;
  approval_token_hash: string | null;
  expires_at: Date | null;
  voice_proof_id: string | null;
  decision_hash: string;
  signature: string;
  policy_id: string | null;
  policy_version: number | null;
  risk_engine_version: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export interface Policy {
  id: string;
  org_id: string;
  name: string;
  version: number;
  rules_json: Record<string, any>;
  risk_thresholds_json: Record<string, any>;
  approval_rules_json: Record<string, any>;
  active: boolean;
  created_at: Date;
  created_by: string;
  activated_at: Date | null;
  activated_by: string | null;
}

export interface AuditLog {
  id: string;
  org_id: string;
  action: string;
  actor_user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  details_json: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  previous_hash: string | null;
  log_hash: string;
  signature: string;
  created_at: Date;
}

export interface VoiceChallenge {
  id: string;
  intent_id: string;
  user_id: string;
  language: ChallengeLanguage;
  level: ChallengeLevel;
  grammar_version: string;
  challenge_nonce: string;
  challenge_text: string;
  expected_slots_json: Record<string, any>;
  expires_at: Date;
  created_at: Date;
}

export interface VoiceProof {
  id: string;
  intent_id: string;
  challenge_id: string;
  user_id: string;
  channel: ProofChannel;
  transcript: string;
  transcript_language: string | null;
  scores_json: Record<string, any>;
  device_metadata_json: Record<string, any>;
  audio_encrypted_ref: string | null;
  audio_hash: string | null;
  model_version: string | null;
  created_at: Date;
}

export interface Voiceprint {
  id: string;
  user_id: string;
  voiceprint_encrypted: string;
  enrollment_samples_count: number;
  enrollment_quality_score: number | null;
  enrolled_at: Date;
  last_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface FraudAlert {
  id: string;
  org_id: string;
  intent_id: string | null;
  user_id: string | null;
  alert_type: string;
  severity: AlertSeverity;
  details_json: Record<string, any>;
  resolved: boolean;
  resolved_at: Date | null;
  resolved_by: string | null;
  created_at: Date;
}

export interface RiskScore {
  id: string;
  intent_id: string;
  risk_score: number;
  factors_json: Record<string, any>;
  rationale_json: Record<string, any>;
  model_version: string | null;
  created_at: Date;
}
