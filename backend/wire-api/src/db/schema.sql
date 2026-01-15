-- ============================================================================
-- WIRE2 Database Schema
-- Complete PostgreSQL schema for wire transfer security platform
-- 
-- Design Principles:
-- - Immutability where required (audit logs, intent amounts)
-- - Cryptographic integrity (hashes, signatures)
-- - Version control (beneficiaries, policies)
-- - Performance optimization (indexes, constraints)
-- - Security first (encrypted fields, access controls)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_organizations_name ON organizations(name);

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'TREASURY_INITIATOR', 'APPROVER', 'AUDITOR', 'READ_ONLY')),
  mfa_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  mfa_secret VARCHAR(255),
  failed_login_attempts INT DEFAULT 0 NOT NULL,
  locked_until TIMESTAMP,
  last_login_at TIMESTAMP,
  voice_enrolled BOOLEAN DEFAULT FALSE NOT NULL,
  voice_enrolled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  refresh_token_hash VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  device_fingerprint VARCHAR(255),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_used_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================================
-- BENEFICIARIES
-- ============================================================================

CREATE TABLE beneficiaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  country VARCHAR(2) NOT NULL,
  rails_allowed VARCHAR(10)[] NOT NULL,
  bank_routing_number VARCHAR(20),
  bank_account_number_encrypted TEXT NOT NULL,
  bank_account_last4 VARCHAR(4) NOT NULL,
  bank_token_hash VARCHAR(255),
  account_type VARCHAR(20),
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL CHECK (status IN ('ACTIVE', 'LOCKED', 'PENDING_VERIFICATION')),
  verification_status VARCHAR(50) NOT NULL,
  kyc_status VARCHAR(50),
  kyc_expiry TIMESTAMP,
  sanctions_check_status VARCHAR(50),
  sanctions_check_date TIMESTAMP,
  micro_deposit_verified BOOLEAN DEFAULT FALSE NOT NULL,
  micro_deposit_amount1_cents INT,
  micro_deposit_amount2_cents INT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_changed_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_changed_by UUID REFERENCES users(id),
  
  CONSTRAINT version_increment CHECK (version > 0),
  CONSTRAINT rails_allowed_valid CHECK (rails_allowed <@ ARRAY['ACH', 'WIRE']::VARCHAR[])
);

CREATE TABLE beneficiary_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  beneficiary_id UUID REFERENCES beneficiaries(id) ON DELETE CASCADE NOT NULL,
  version INT NOT NULL,
  bank_account_number_encrypted TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  UNIQUE(beneficiary_id, version)
);

CREATE INDEX idx_beneficiaries_org_id ON beneficiaries(org_id);
CREATE INDEX idx_beneficiaries_status ON beneficiaries(status);
CREATE INDEX idx_beneficiaries_version ON beneficiaries(id, version);
CREATE INDEX idx_beneficiaries_last4 ON beneficiaries(bank_account_last4);
CREATE INDEX idx_beneficiary_versions_beneficiary ON beneficiary_versions(beneficiary_id, version);

-- ============================================================================
-- INTENTS (Transfer Intents)
-- ============================================================================

CREATE TABLE intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  created_by_user_id UUID REFERENCES users(id) NOT NULL,
  rails_type VARCHAR(10) NOT NULL CHECK (rails_type IN ('ACH', 'WIRE')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  beneficiary_id UUID REFERENCES beneficiaries(id) NOT NULL,
  beneficiary_version INT NOT NULL,
  purpose TEXT NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('DRAFT', 'PENDING_PROOF', 'CHALLENGING', 'PENDING_APPROVALS', 'APPROVED', 'DENIED', 'EXECUTED', 'EXPIRED', 'CANCELED')),
  risk_score INT NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_rationale_json JSONB NOT NULL,
  required_approvals INT NOT NULL CHECK (required_approvals > 0),
  required_challenge_level VARCHAR(10) NOT NULL CHECK (required_challenge_level IN ('L1', 'L2', 'L3')),
  binding_hash VARCHAR(255) UNIQUE NOT NULL,
  cooldown_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  submitted_at TIMESTAMP,
  executed_at TIMESTAMP,
  
  -- Ensure amount is immutable after submission
  CONSTRAINT amount_immutable_after_submission CHECK (
    (status = 'DRAFT' AND submitted_at IS NULL) OR
    (status != 'DRAFT' AND submitted_at IS NOT NULL)
  )
);

CREATE INDEX idx_intents_org_id ON intents(org_id);
CREATE INDEX idx_intents_status ON intents(status);
CREATE INDEX idx_intents_created_by ON intents(created_by_user_id);
CREATE INDEX idx_intents_beneficiary ON intents(beneficiary_id, beneficiary_version);
CREATE INDEX idx_intents_risk_score ON intents(risk_score);
CREATE INDEX idx_intents_created_at ON intents(created_at);
CREATE INDEX idx_intents_binding_hash ON intents(binding_hash);
CREATE INDEX idx_intents_cooldown ON intents(cooldown_until) WHERE cooldown_until IS NOT NULL;

-- ============================================================================
-- VOICE VERIFICATION
-- ============================================================================

CREATE TABLE voice_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intent_id UUID REFERENCES intents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  language VARCHAR(2) NOT NULL DEFAULT 'EN' CHECK (language IN ('EN', 'ES')),
  level VARCHAR(10) NOT NULL CHECK (level IN ('L1', 'L2', 'L3')),
  grammar_version VARCHAR(50) NOT NULL,
  challenge_nonce VARCHAR(255) UNIQUE NOT NULL,
  challenge_text TEXT NOT NULL,
  expected_slots_json JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE voice_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intent_id UUID REFERENCES intents(id) ON DELETE CASCADE NOT NULL,
  challenge_id UUID REFERENCES voice_challenges(id) NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('BROWSER', 'PHONE')),
  transcript TEXT NOT NULL,
  transcript_language VARCHAR(10),
  scores_json JSONB NOT NULL,
  device_metadata_json JSONB NOT NULL,
  audio_encrypted_ref TEXT,
  audio_hash VARCHAR(255),
  model_version VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE voiceprints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  voiceprint_encrypted TEXT NOT NULL,
  enrollment_samples_count INT NOT NULL DEFAULT 0,
  enrollment_quality_score DECIMAL(5,2),
  enrolled_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_voice_challenges_intent ON voice_challenges(intent_id);
CREATE INDEX idx_voice_challenges_user ON voice_challenges(user_id);
CREATE INDEX idx_voice_challenges_expires ON voice_challenges(expires_at);
CREATE INDEX idx_voice_proofs_intent ON voice_proofs(intent_id);
CREATE INDEX idx_voice_proofs_challenge ON voice_proofs(challenge_id);
CREATE INDEX idx_voice_proofs_user ON voice_proofs(user_id);
CREATE INDEX idx_voiceprints_user ON voiceprints(user_id);

-- ============================================================================
-- APPROVALS
-- ============================================================================

CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intent_id UUID REFERENCES intents(id) ON DELETE CASCADE NOT NULL,
  approver_user_id UUID REFERENCES users(id) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'DENIED', 'EXPIRED')),
  decision_type VARCHAR(20) CHECK (decision_type IN ('APPROVE', 'DENY', 'STEP_UP')),
  reason_codes JSONB,
  approval_token_hash VARCHAR(255) UNIQUE,
  expires_at TIMESTAMP,
  voice_proof_id UUID REFERENCES voice_proofs(id),
  decision_hash VARCHAR(255) NOT NULL,
  signature TEXT NOT NULL,
  policy_id UUID,
  policy_version INT,
  risk_engine_version VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP,
  
  -- Cannot approve own intent (enforced at application level, but also here for safety)
  CONSTRAINT approval_expires CHECK (
    expires_at IS NULL OR expires_at > created_at
  )
);

CREATE INDEX idx_approvals_intent ON approvals(intent_id);
CREATE INDEX idx_approvals_approver ON approvals(approver_user_id);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_pending ON approvals(intent_id, status) WHERE status = 'PENDING';
CREATE INDEX idx_approvals_expires ON approvals(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- POLICIES
-- ============================================================================

CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  version INT NOT NULL,
  rules_json JSONB NOT NULL,
  risk_thresholds_json JSONB NOT NULL,
  approval_rules_json JSONB NOT NULL,
  active BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  activated_at TIMESTAMP,
  activated_by UUID REFERENCES users(id),
  UNIQUE(org_id, name, version)
);

CREATE INDEX idx_policies_org_active ON policies(org_id, active) WHERE active = TRUE;
CREATE INDEX idx_policies_org_name ON policies(org_id, name);

-- ============================================================================
-- AUDIT LOGS (Immutable)
-- ============================================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  action VARCHAR(100) NOT NULL,
  actor_user_id UUID REFERENCES users(id),
  entity_type VARCHAR(50),
  entity_id UUID,
  details_json JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT,
  previous_hash VARCHAR(255),
  log_hash VARCHAR(255) UNIQUE NOT NULL,
  signature TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_audit_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_log_hash ON audit_logs(log_hash);

-- ============================================================================
-- FRAUD DETECTION
-- ============================================================================

CREATE TABLE fraud_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  intent_id UUID REFERENCES intents(id),
  user_id UUID REFERENCES users(id),
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  details_json JSONB NOT NULL,
  resolved BOOLEAN DEFAULT FALSE NOT NULL,
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intent_id UUID REFERENCES intents(id) ON DELETE CASCADE NOT NULL,
  risk_score INT NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  factors_json JSONB NOT NULL,
  rationale_json JSONB NOT NULL,
  model_version VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_fraud_alerts_org ON fraud_alerts(org_id);
CREATE INDEX idx_fraud_alerts_intent ON fraud_alerts(intent_id);
CREATE INDEX idx_fraud_alerts_user ON fraud_alerts(user_id);
CREATE INDEX idx_fraud_alerts_severity ON fraud_alerts(severity);
CREATE INDEX idx_fraud_alerts_resolved ON fraud_alerts(resolved) WHERE resolved = FALSE;
CREATE INDEX idx_risk_scores_intent ON risk_scores(intent_id);
CREATE INDEX idx_risk_scores_created_at ON risk_scores(created_at);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_beneficiaries_updated_at BEFORE UPDATE ON beneficiaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_intents_updated_at BEFORE UPDATE ON intents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_voiceprints_updated_at BEFORE UPDATE ON voiceprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (Optional - can be enabled per organization)
-- ============================================================================

-- Enable RLS on sensitive tables (commented out by default, enable as needed)
-- ALTER TABLE intents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE users IS 'User accounts with authentication and authorization';
COMMENT ON TABLE sessions IS 'Active user sessions with token management';
COMMENT ON TABLE organizations IS 'Organizations using the WIRE platform';
COMMENT ON TABLE beneficiaries IS 'Payment beneficiaries with version control';
COMMENT ON TABLE beneficiary_versions IS 'Historical versions of beneficiary account details';
COMMENT ON TABLE intents IS 'Wire transfer intents with immutable amounts after submission';
COMMENT ON TABLE voice_challenges IS 'Voice verification challenges for intent approval';
COMMENT ON TABLE voice_proofs IS 'Voice verification proofs with biometric scores';
COMMENT ON TABLE voiceprints IS 'Encrypted voiceprints for user biometric verification';
COMMENT ON TABLE approvals IS 'Approval workflow records with cryptographic signatures';
COMMENT ON TABLE policies IS 'Risk and approval policies with versioning';
COMMENT ON TABLE audit_logs IS 'Immutable audit trail with cryptographic integrity';
COMMENT ON TABLE fraud_alerts IS 'Fraud detection alerts and resolutions';
COMMENT ON TABLE risk_scores IS 'Historical risk scores for intents';
