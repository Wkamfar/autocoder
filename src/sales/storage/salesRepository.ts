import { randomUUID } from 'node:crypto';
import type { SalesDatabase } from './salesDb.js';
import type {
  Account,
  Activity,
  Contact,
  CRMEntitySource,
  CRMMutation,
  Deal,
  EntityResolutionDecision,
  RelationshipEdge,
  SalesAction,
  SuppressionRecord,
} from '../types/entities.js';
import { normalizeLegalName, normalizeRegistrableDomain } from '../builder/entityNormalization.js';

function nowIso(): string {
  return new Date().toISOString();
}

export class SalesRepository {
  constructor(private db: SalesDatabase) {}

  insertCRMEntitySource(row: CRMEntitySource): void {
    this.db
      .prepare(
        `INSERT INTO crm_entity_sources (id, source_type, source_id, adapter_scope, imported_at, trust_level, raw_ref, metadata_json)
         VALUES (@id, @source_type, @source_id, @adapter_scope, @imported_at, @trust_level, @raw_ref, @metadata_json)`
      )
      .run({
        id: row.id,
        source_type: row.source_type,
        source_id: row.source_id,
        adapter_scope: row.adapter_scope ?? 'default',
        imported_at: row.imported_at,
        trust_level: row.trust_level,
        raw_ref: row.raw_ref ?? null,
        metadata_json: row.metadata ? JSON.stringify(row.metadata) : null,
      });
  }

  getCRMEntitySourceByAdapterKey(adapterScope: string, sourceId: string): CRMEntitySource | undefined {
    const r = this.db
      .prepare(
        `SELECT * FROM crm_entity_sources WHERE adapter_scope = ? AND source_id = ?`
      )
      .get(adapterScope, sourceId) as Record<string, unknown> | undefined;
    return r ? rowToEntitySource(r) : undefined;
  }

  insertEntityResolutionDecision(d: EntityResolutionDecision): void {
    this.db
      .prepare(
        `INSERT INTO entity_resolution_decisions (id, candidate_refs_json, matched_entity_type, matched_entity_id, confidence, outcome, explanation, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        d.id,
        JSON.stringify(d.candidate_refs),
        d.matched_entity_type ?? null,
        d.matched_entity_id ?? null,
        d.confidence,
        d.outcome,
        d.explanation,
        d.created_at
      );
  }

  insertCRMMutation(m: CRMMutation): void {
    this.db
      .prepare(
        `INSERT INTO crm_mutations (id, idempotency_key, mutation_type, target_entity_type, target_entity_id, secondary_target_id,
          proposed_payload_json, confidence_score, source_evidence_json, explanation, status, auto_apply_allowed,
          approved_by, approved_at, applied_at, last_apply_result, apply_error_detail, reject_reason, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        m.id,
        m.idempotency_key,
        m.mutation_type,
        m.target_entity_type,
        m.target_entity_id ?? null,
        m.secondary_target_id ?? null,
        JSON.stringify(m.proposed_payload),
        m.confidence_score,
        JSON.stringify(m.source_evidence),
        m.explanation,
        m.status,
        m.auto_apply_allowed ? 1 : 0,
        m.approved_by ?? null,
        m.approved_at ?? null,
        m.applied_at ?? null,
        m.last_apply_result ?? null,
        m.apply_error_detail ?? null,
        m.reject_reason ?? null,
        m.created_at,
        m.updated_at
      );
  }

  getCRMMutationByIdempotency(key: string): CRMMutation | undefined {
    const r = this.db.prepare(`SELECT * FROM crm_mutations WHERE idempotency_key = ?`).get(key) as
      | Record<string, unknown>
      | undefined;
    return r ? rowToMutation(r) : undefined;
  }

  getCRMMutationById(id: string): CRMMutation | undefined {
    const r = this.db.prepare(`SELECT * FROM crm_mutations WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return r ? rowToMutation(r) : undefined;
  }

  listCRMMutationsByStatus(status: string): CRMMutation[] {
    return (this.db.prepare(`SELECT * FROM crm_mutations WHERE status = ?`).all(status) as Record<
      string,
      unknown
    >[]).map(rowToMutation);
  }

  approveCRMMutation(id: string, approvedBy: string, at: string): void {
    this.db
      .prepare(
        `UPDATE crm_mutations SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?`
      )
      .run(approvedBy, at, at, id);
  }

  updateCRMMutation(m: CRMMutation): void {
    this.db
      .prepare(
        `UPDATE crm_mutations SET status = ?, applied_at = ?, last_apply_result = ?, apply_error_detail = ?, reject_reason = ?, updated_at = ?,
          approved_by = ?, approved_at = ?
         WHERE id = ?`
      )
      .run(
        m.status,
        m.applied_at ?? null,
        m.last_apply_result ?? null,
        m.apply_error_detail ?? null,
        m.reject_reason ?? null,
        m.updated_at,
        m.approved_by ?? null,
        m.approved_at ?? null,
        m.id
      );
  }

  insertAccount(a: Account): void {
    this.db
      .prepare(
        `INSERT INTO accounts (id, name, domain, segment, owner_user_id, last_verified_at, freshness_score, stale_reason, score_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        a.id,
        a.name,
        a.domain ?? null,
        a.segment ?? null,
        a.owner_user_id ?? null,
        a.last_verified_at ?? null,
        a.freshness_score ?? null,
        a.stale_reason ?? null,
        a.score_json ? JSON.stringify(a.score_json) : null,
        a.created_at,
        a.updated_at
      );
  }

  updateAccount(a: Account): void {
    this.db
      .prepare(
        `UPDATE accounts SET name = ?, domain = ?, segment = ?, owner_user_id = ?, last_verified_at = ?, freshness_score = ?, stale_reason = ?, score_json = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        a.name,
        a.domain ?? null,
        a.segment ?? null,
        a.owner_user_id ?? null,
        a.last_verified_at ?? null,
        a.freshness_score ?? null,
        a.stale_reason ?? null,
        a.score_json ? JSON.stringify(a.score_json) : null,
        a.updated_at,
        a.id
      );
  }

  getAccount(id: string): Account | undefined {
    const r = this.db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return r ? rowToAccount(r) : undefined;
  }

  listAccounts(): Account[] {
    return (this.db.prepare(`SELECT * FROM accounts`).all() as Record<string, unknown>[]).map(rowToAccount);
  }

  /** Accounts whose normalized domain equals `norm` (registrable form). */
  findAccountsByNormalizedDomain(norm: string): Account[] {
    return this.listAccounts().filter((a) => normalizeRegistrableDomain(a.domain) === norm);
  }

  /** Accounts whose normalized legal name equals `norm`. */
  findAccountsByNormalizedLegalName(norm: string): Account[] {
    return this.listAccounts().filter((a) => normalizeLegalName(a.name) === norm);
  }

  /** Merge policy: repoint activities that referenced merged-away entity (plan §4). */
  rewriteActivitiesEntityId(entityType: string, fromEntityId: string, toEntityId: string): number {
    const r = this.db
      .prepare(`UPDATE activities SET entity_id = ? WHERE entity_type = ? AND entity_id = ?`)
      .run(toEntityId, entityType, fromEntityId);
    return Number(r.changes ?? 0);
  }

  insertContact(c: Contact): void {
    this.db
      .prepare(
        `INSERT INTO contacts (id, account_id, email, full_name, title, owner_user_id, last_verified_at, freshness_score, stale_reason, score_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        c.id,
        c.account_id ?? null,
        c.email ?? null,
        c.full_name ?? null,
        c.title ?? null,
        c.owner_user_id ?? null,
        c.last_verified_at ?? null,
        c.freshness_score ?? null,
        c.stale_reason ?? null,
        c.score_json ? JSON.stringify(c.score_json) : null,
        c.created_at,
        c.updated_at
      );
  }

  updateContact(c: Contact): void {
    this.db
      .prepare(
        `UPDATE contacts SET account_id = ?, email = ?, full_name = ?, title = ?, owner_user_id = ?, last_verified_at = ?, freshness_score = ?, stale_reason = ?, score_json = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        c.account_id ?? null,
        c.email ?? null,
        c.full_name ?? null,
        c.title ?? null,
        c.owner_user_id ?? null,
        c.last_verified_at ?? null,
        c.freshness_score ?? null,
        c.stale_reason ?? null,
        c.score_json ? JSON.stringify(c.score_json) : null,
        c.updated_at,
        c.id
      );
  }

  getContact(id: string): Contact | undefined {
    const r = this.db.prepare(`SELECT * FROM contacts WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return r ? rowToContact(r) : undefined;
  }

  findContactByEmail(email: string): Contact | undefined {
    const r = this.db.prepare(`SELECT * FROM contacts WHERE lower(email) = lower(?)`).get(email) as
      | Record<string, unknown>
      | undefined;
    return r ? rowToContact(r) : undefined;
  }

  listContactsForAccount(accountId: string): Contact[] {
    return (
      this.db.prepare(`SELECT * FROM contacts WHERE account_id = ?`).all(accountId) as Record<string, unknown>[]
    ).map(rowToContact);
  }

  listContacts(): Contact[] {
    return (this.db.prepare(`SELECT * FROM contacts`).all() as Record<string, unknown>[]).map(rowToContact);
  }

  deleteContact(id: string): void {
    this.db.prepare(`DELETE FROM contacts WHERE id = ?`).run(id);
  }

  insertDeal(d: Deal): void {
    this.db
      .prepare(
        `INSERT INTO deals (id, account_id, contact_id, owner_id, assigned_mode, deal_stage, last_contacted_at, last_verified_at, freshness_score, stale_reason, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        d.id,
        d.account_id,
        d.contact_id ?? null,
        d.owner_id ?? null,
        d.assigned_mode,
        d.deal_stage,
        d.last_contacted_at ?? null,
        d.last_verified_at ?? null,
        d.freshness_score ?? null,
        d.stale_reason ?? null,
        d.created_at,
        d.updated_at
      );
  }

  updateDeal(d: Deal): void {
    this.db
      .prepare(
        `UPDATE deals SET account_id = ?, contact_id = ?, owner_id = ?, assigned_mode = ?, deal_stage = ?, last_contacted_at = ?, last_verified_at = ?, freshness_score = ?, stale_reason = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        d.account_id,
        d.contact_id ?? null,
        d.owner_id ?? null,
        d.assigned_mode,
        d.deal_stage,
        d.last_contacted_at ?? null,
        d.last_verified_at ?? null,
        d.freshness_score ?? null,
        d.stale_reason ?? null,
        d.updated_at,
        d.id
      );
  }

  getDeal(id: string): Deal | undefined {
    const r = this.db.prepare(`SELECT * FROM deals WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return r ? rowToDeal(r) : undefined;
  }

  listDealsForAccount(accountId: string): Deal[] {
    return (this.db.prepare(`SELECT * FROM deals WHERE account_id = ?`).all(accountId) as Record<string, unknown>[]).map(
      rowToDeal
    );
  }

  listOpenDeals(): Deal[] {
    return (
      this.db
        .prepare(`SELECT * FROM deals WHERE deal_stage NOT IN ('closed_won', 'closed_lost')`)
        .all() as Record<string, unknown>[]
    ).map(rowToDeal);
  }

  insertRelationshipEdge(e: RelationshipEdge): void {
    this.db
      .prepare(
        `INSERT INTO relationship_edges (id, from_entity_type, from_entity_id, to_entity_type, to_entity_id, edge_type, confidence, source_evidence_json, created_at, superseded_by_edge_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        e.id,
        e.from_entity_type,
        e.from_entity_id,
        e.to_entity_type,
        e.to_entity_id,
        e.edge_type,
        e.confidence,
        JSON.stringify(e.source_evidence),
        e.created_at,
        e.superseded_by_edge_id ?? null
      );
  }

  updateEdgeSuperseded(edgeId: string, supersededBy: string): void {
    this.db.prepare(`UPDATE relationship_edges SET superseded_by_edge_id = ? WHERE id = ?`).run(supersededBy, edgeId);
  }

  listEdgesForEntity(entityType: string, entityId: string): RelationshipEdge[] {
    const a = this.db
      .prepare(
        `SELECT * FROM relationship_edges WHERE from_entity_type = ? AND from_entity_id = ? AND superseded_by_edge_id IS NULL`
      )
      .all(entityType, entityId) as Record<string, unknown>[];
    const b = this.db
      .prepare(
        `SELECT * FROM relationship_edges WHERE to_entity_type = ? AND to_entity_id = ? AND superseded_by_edge_id IS NULL`
      )
      .all(entityType, entityId) as Record<string, unknown>[];
    const seen = new Set<string>();
    const out: RelationshipEdge[] = [];
    for (const r of [...a, ...b]) {
      const id = r.id as string;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(rowToEdge(r));
    }
    return out;
  }

  upsertSuppression(s: SuppressionRecord): void {
    this.db
      .prepare(
        `INSERT INTO suppression_list (email, reason, timestamp, source_ref) VALUES (lower(?), ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET reason = excluded.reason, timestamp = excluded.timestamp, source_ref = excluded.source_ref`
      )
      .run(s.email, s.reason, s.timestamp, s.source_ref ?? null);
  }

  isSuppressedEmail(email: string): boolean {
    const r = this.db.prepare(`SELECT 1 FROM suppression_list WHERE email = lower(?)`).get(email);
    return !!r;
  }

  appendActivity(a: Activity): void {
    this.db
      .prepare(
        `INSERT INTO activities (id, activity_type, entity_type, entity_id, payload_json, sales_action_id, crm_mutation_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        a.id,
        a.activity_type,
        a.entity_type ?? null,
        a.entity_id ?? null,
        a.payload ? JSON.stringify(a.payload) : null,
        a.sales_action_id ?? null,
        a.crm_mutation_id ?? null,
        a.created_at
      );
  }

  listRecentActivities(limit: number): Activity[] {
    return (
      this.db.prepare(`SELECT * FROM activities ORDER BY created_at DESC LIMIT ?`).all(limit) as Record<
        string,
        unknown
      >[]
    ).map(rowToActivity);
  }

  listActivitiesForEntity(entityType: string, entityId: string, limit: number): Activity[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM activities WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT ?`
        )
        .all(entityType, entityId, limit) as Record<string, unknown>[]
    ).map(rowToActivity);
  }

  insertSalesAction(s: SalesAction): void {
    this.db
      .prepare(
        `INSERT INTO sales_actions (id, idempotency_key, action_type, account_id, contact_id, deal_id, status, risk_level, payload_json, context_snapshot_json,
          approval_required, approved_by, approved_at, human_gate_reason, execution_result_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        s.id,
        s.idempotency_key,
        s.action_type,
        s.account_id ?? null,
        s.contact_id ?? null,
        s.deal_id ?? null,
        s.status,
        s.risk_level,
        JSON.stringify(s.payload),
        JSON.stringify(s.context_snapshot),
        s.approval_required ? 1 : 0,
        s.approved_by ?? null,
        s.approved_at ?? null,
        s.human_gate_reason ?? null,
        s.execution_result ? JSON.stringify(s.execution_result) : null,
        s.created_at,
        s.updated_at
      );
  }

  updateSalesAction(s: SalesAction): void {
    this.db
      .prepare(
        `UPDATE sales_actions SET status = ?, payload_json = ?, approved_by = ?, approved_at = ?, human_gate_reason = ?, execution_result_json = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        s.status,
        JSON.stringify(s.payload),
        s.approved_by ?? null,
        s.approved_at ?? null,
        s.human_gate_reason ?? null,
        s.execution_result ? JSON.stringify(s.execution_result) : null,
        s.updated_at,
        s.id
      );
  }

  getSalesAction(id: string): SalesAction | undefined {
    const r = this.db.prepare(`SELECT * FROM sales_actions WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return r ? rowToSalesAction(r) : undefined;
  }

  getSalesActionByIdempotencyKey(key: string): SalesAction | undefined {
    const r = this.db.prepare(`SELECT * FROM sales_actions WHERE idempotency_key = ?`).get(key) as
      | Record<string, unknown>
      | undefined;
    return r ? rowToSalesAction(r) : undefined;
  }

  inTransaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  insertRevenueMetricEvent(
    metric: string,
    value: number,
    payload?: Record<string, unknown>,
    dealId?: string
  ): void {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO revenue_metric_events (id, metric, value, payload_json, deal_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, metric, value, payload ? JSON.stringify(payload) : null, dealId ?? null, nowIso());
  }

  newId(): string {
    return randomUUID();
  }

  nowIso(): string {
    return nowIso();
  }

  /** Summary counts for Discord / CLI status. */
  getCanonicalStats(): {
    accounts: number;
    contacts: number;
    deals: number;
    open_deals: number;
    crm_mutations_proposed: number;
    crm_mutations_applied: number;
    sales_actions: number;
    sales_actions_completed: number;
    activities: number;
    crm_entity_sources: number;
  } {
    const n = (sql: string) => Number((this.db.prepare(sql).get() as { c: number }).c);
    return {
      accounts: n(`SELECT COUNT(*) AS c FROM accounts`),
      contacts: n(`SELECT COUNT(*) AS c FROM contacts`),
      deals: n(`SELECT COUNT(*) AS c FROM deals`),
      open_deals: n(
        `SELECT COUNT(*) AS c FROM deals WHERE deal_stage NOT IN ('closed_won','closed_lost')`
      ),
      crm_mutations_proposed: n(`SELECT COUNT(*) AS c FROM crm_mutations WHERE status = 'proposed'`),
      crm_mutations_applied: n(`SELECT COUNT(*) AS c FROM crm_mutations WHERE status = 'applied'`),
      sales_actions: n(`SELECT COUNT(*) AS c FROM sales_actions`),
      sales_actions_completed: n(`SELECT COUNT(*) AS c FROM sales_actions WHERE status = 'completed'`),
      activities: n(`SELECT COUNT(*) AS c FROM activities`),
      crm_entity_sources: n(`SELECT COUNT(*) AS c FROM crm_entity_sources`),
    };
  }
}

function rowToEntitySource(r: Record<string, unknown>): CRMEntitySource {
  return {
    id: r.id as string,
    source_type: r.source_type as string,
    source_id: r.source_id as string,
    adapter_scope: (r.adapter_scope as string) || 'default',
    imported_at: r.imported_at as string,
    trust_level: r.trust_level as string,
    raw_ref: r.raw_ref as string | undefined,
    metadata: r.metadata_json ? JSON.parse(r.metadata_json as string) : undefined,
  };
}

function rowToMutation(r: Record<string, unknown>): CRMMutation {
  return {
    id: r.id as string,
    idempotency_key: r.idempotency_key as string,
    mutation_type: r.mutation_type as CRMMutation['mutation_type'],
    target_entity_type: r.target_entity_type as string,
    target_entity_id: r.target_entity_id as string | undefined,
    secondary_target_id: r.secondary_target_id as string | undefined,
    proposed_payload: JSON.parse(r.proposed_payload_json as string),
    confidence_score: r.confidence_score as number,
    source_evidence: JSON.parse(r.source_evidence_json as string),
    explanation: r.explanation as string,
    status: r.status as CRMMutation['status'],
    auto_apply_allowed: !!(r.auto_apply_allowed as number),
    approved_by: r.approved_by as string | undefined,
    approved_at: r.approved_at as string | undefined,
    applied_at: r.applied_at as string | undefined,
    last_apply_result: r.last_apply_result as CRMMutation['last_apply_result'],
    apply_error_detail: r.apply_error_detail as string | undefined,
    reject_reason: r.reject_reason as string | undefined,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function rowToAccount(r: Record<string, unknown>): Account {
  return {
    id: r.id as string,
    name: r.name as string,
    domain: r.domain as string | undefined,
    segment: r.segment as string | undefined,
    owner_user_id: r.owner_user_id as string | undefined,
    last_verified_at: r.last_verified_at as string | undefined,
    freshness_score: r.freshness_score as number | undefined,
    stale_reason: r.stale_reason as string | undefined,
    score_json: r.score_json ? JSON.parse(r.score_json as string) : undefined,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function rowToContact(r: Record<string, unknown>): Contact {
  return {
    id: r.id as string,
    account_id: r.account_id as string | undefined,
    email: r.email as string | undefined,
    full_name: r.full_name as string | undefined,
    title: r.title as string | undefined,
    owner_user_id: r.owner_user_id as string | undefined,
    last_verified_at: r.last_verified_at as string | undefined,
    freshness_score: r.freshness_score as number | undefined,
    stale_reason: r.stale_reason as string | undefined,
    score_json: r.score_json ? JSON.parse(r.score_json as string) : undefined,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function rowToDeal(r: Record<string, unknown>): Deal {
  return {
    id: r.id as string,
    account_id: r.account_id as string,
    contact_id: r.contact_id as string | undefined,
    owner_id: r.owner_id as string | undefined,
    assigned_mode: r.assigned_mode as Deal['assigned_mode'],
    deal_stage: r.deal_stage as string,
    last_contacted_at: r.last_contacted_at as string | undefined,
    last_verified_at: r.last_verified_at as string | undefined,
    freshness_score: r.freshness_score as number | undefined,
    stale_reason: r.stale_reason as string | undefined,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function rowToEdge(r: Record<string, unknown>): RelationshipEdge {
  return {
    id: r.id as string,
    from_entity_type: r.from_entity_type as RelationshipEdge['from_entity_type'],
    from_entity_id: r.from_entity_id as string,
    to_entity_type: r.to_entity_type as RelationshipEdge['to_entity_type'],
    to_entity_id: r.to_entity_id as string,
    edge_type: r.edge_type as string,
    confidence: r.confidence as number,
    source_evidence: JSON.parse(r.source_evidence_json as string),
    created_at: r.created_at as string,
    superseded_by_edge_id: r.superseded_by_edge_id as string | undefined,
  };
}

function rowToActivity(r: Record<string, unknown>): Activity {
  return {
    id: r.id as string,
    activity_type: r.activity_type as Activity['activity_type'],
    entity_type: r.entity_type as string | undefined,
    entity_id: r.entity_id as string | undefined,
    payload: r.payload_json ? JSON.parse(r.payload_json as string) : undefined,
    sales_action_id: r.sales_action_id as string | undefined,
    crm_mutation_id: r.crm_mutation_id as string | undefined,
    created_at: r.created_at as string,
  };
}

function rowToSalesAction(r: Record<string, unknown>): SalesAction {
  return {
    id: r.id as string,
    idempotency_key: r.idempotency_key as string,
    action_type: r.action_type as string,
    account_id: r.account_id as string | undefined,
    contact_id: r.contact_id as string | undefined,
    deal_id: r.deal_id as string | undefined,
    status: r.status as SalesAction['status'],
    risk_level: r.risk_level as SalesAction['risk_level'],
    payload: JSON.parse(r.payload_json as string),
    context_snapshot: JSON.parse(r.context_snapshot_json as string),
    approval_required: !!(r.approval_required as number),
    approved_by: r.approved_by as string | undefined,
    approved_at: r.approved_at as string | undefined,
    human_gate_reason: r.human_gate_reason as SalesAction['human_gate_reason'],
    execution_result: r.execution_result_json ? JSON.parse(r.execution_result_json as string) : undefined,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}
