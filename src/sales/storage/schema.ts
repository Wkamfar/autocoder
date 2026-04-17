/**
 * SQLite DDL — stable table/column names (v7 freeze).
 * Tables: crm_entity_sources, entity_resolution_decisions, crm_mutations,
 * accounts, contacts, deals, relationship_edges, suppression_list, activities, sales_actions,
 * sequences (minimal), sales_meta (operating profile json).
 */

export const SALES_SCHEMA_VERSION = 1;

export const CREATE_SALES_TABLES = `
CREATE TABLE IF NOT EXISTS crm_entity_sources (
  id TEXT PRIMARY KEY NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  adapter_scope TEXT NOT NULL DEFAULT 'default',
  imported_at TEXT NOT NULL,
  trust_level TEXT NOT NULL,
  raw_ref TEXT,
  metadata_json TEXT,
  UNIQUE(adapter_scope, source_id)
);

CREATE TABLE IF NOT EXISTS entity_resolution_decisions (
  id TEXT PRIMARY KEY NOT NULL,
  candidate_refs_json TEXT NOT NULL,
  matched_entity_type TEXT,
  matched_entity_id TEXT,
  confidence REAL NOT NULL,
  outcome TEXT NOT NULL,
  explanation TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_mutations (
  id TEXT PRIMARY KEY NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  mutation_type TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  target_entity_id TEXT,
  secondary_target_id TEXT,
  proposed_payload_json TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  source_evidence_json TEXT NOT NULL,
  explanation TEXT NOT NULL,
  status TEXT NOT NULL,
  auto_apply_allowed INTEGER NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  applied_at TEXT,
  last_apply_result TEXT,
  apply_error_detail TEXT,
  reject_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  domain TEXT,
  segment TEXT,
  owner_user_id TEXT,
  last_verified_at TEXT,
  freshness_score REAL,
  stale_reason TEXT,
  score_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT REFERENCES accounts(id),
  email TEXT,
  full_name TEXT,
  title TEXT,
  owner_user_id TEXT,
  last_verified_at TEXT,
  freshness_score REAL,
  stale_reason TEXT,
  score_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_account ON contacts(account_id);

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  contact_id TEXT REFERENCES contacts(id),
  owner_id TEXT,
  assigned_mode TEXT NOT NULL,
  deal_stage TEXT NOT NULL,
  last_contacted_at TEXT,
  last_verified_at TEXT,
  freshness_score REAL,
  stale_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deals_account ON deals(account_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(deal_stage);

CREATE TABLE IF NOT EXISTS relationship_edges (
  id TEXT PRIMARY KEY NOT NULL,
  from_entity_type TEXT NOT NULL,
  from_entity_id TEXT NOT NULL,
  to_entity_type TEXT NOT NULL,
  to_entity_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  confidence REAL NOT NULL,
  source_evidence_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  superseded_by_edge_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_edges_from ON relationship_edges(from_entity_type, from_entity_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON relationship_edges(to_entity_type, to_entity_id);

CREATE TABLE IF NOT EXISTS suppression_list (
  email TEXT PRIMARY KEY NOT NULL,
  reason TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  source_ref TEXT
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY NOT NULL,
  activity_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload_json TEXT,
  sales_action_id TEXT,
  crm_mutation_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);

CREATE TABLE IF NOT EXISTS sales_actions (
  id TEXT PRIMARY KEY NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  action_type TEXT NOT NULL,
  account_id TEXT,
  contact_id TEXT,
  deal_id TEXT,
  status TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  context_snapshot_json TEXT NOT NULL,
  approval_required INTEGER NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  human_gate_reason TEXT,
  execution_result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_actions_deal ON sales_actions(deal_id);

CREATE TABLE IF NOT EXISTS sequences (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  sequence_state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS icp_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  segment_name TEXT NOT NULL,
  required_traits_json TEXT NOT NULL,
  weighted_attributes_json TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS revenue_metric_events (
  id TEXT PRIMARY KEY NOT NULL,
  metric TEXT NOT NULL,
  value REAL,
  payload_json TEXT,
  deal_id TEXT,
  created_at TEXT NOT NULL
);
`;
