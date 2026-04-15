import type { CRMMutation, Contact, Deal, Account, RelationshipEdge, Activity } from '../types/entities.js';
import {
  CRMMutationStatus,
  CRMMutationType,
  EntityRefType,
  MutationApplyResult,
  ActivityType,
  DealStage,
  AssignedMode,
} from '../types/enums.js';
import { SalesRepository } from '../storage/salesRepository.js';

export interface ApplyOutcome {
  mutation: CRMMutation;
  result: MutationApplyResult;
  detail?: string;
}

/**
 * Applies approved CRMMutations to canonical CRM. Single legal write path from Builder.
 * Invariant: ADAPTERS_NO_DIRECT_CANONICAL — only this service (and admin tools) mutate canonical tables.
 */
export class MutationApplyService {
  constructor(private repo: SalesRepository) {}

  /** Only `approved` mutations may change canonical state. */
  apply(m: CRMMutation): ApplyOutcome {
    const t = this.repo.nowIso();
    const existing = this.repo.getCRMMutationByIdempotency(m.idempotency_key);
    if (existing?.applied_at && existing.last_apply_result === MutationApplyResult.applied && existing.id === m.id) {
      return this.finishNoop(existing, 'idempotent replay');
    }
    if (m.status !== CRMMutationStatus.approved) {
      return { mutation: m, result: MutationApplyResult.failed, detail: 'mutation not approved' };
    }

    try {
      return this.repo.inTransaction(() => {
        switch (m.mutation_type) {
          case CRMMutationType.create_account:
            return this.applyCreateAccount(m, t);
          case CRMMutationType.update_account:
            return this.applyUpdateAccount(m, t);
          case CRMMutationType.create_contact:
            return this.applyCreateContact(m, t);
          case CRMMutationType.update_contact:
            return this.applyUpdateContact(m, t);
          case CRMMutationType.merge_contact:
            return this.applyMergeContact(m, t);
          case CRMMutationType.create_deal:
            return this.applyCreateDeal(m, t);
          case CRMMutationType.update_deal_stage:
            return this.applyUpdateDealStage(m, t);
          case CRMMutationType.attach_relationship:
            return this.applyAttachRelationship(m, t);
          case CRMMutationType.mark_suppressed:
            return this.applyMarkSuppressed(m, t);
          case CRMMutationType.mark_stale:
            return this.applyMarkStale(m, t);
          case CRMMutationType.assign_owner:
            return this.applyAssignOwner(m, t);
          default:
            return this.fail(m, `unsupported mutation_type: ${m.mutation_type}`);
        }
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      m.status = CRMMutationStatus.failed;
      m.last_apply_result = MutationApplyResult.failed;
      m.apply_error_detail = err;
      m.updated_at = t;
      this.repo.updateCRMMutation(m);
      return { mutation: m, result: MutationApplyResult.failed, detail: err };
    }
  }

  private finishNoop(m: CRMMutation, reason: string): ApplyOutcome {
    const t = this.repo.nowIso();
    m.last_apply_result = MutationApplyResult.noop;
    m.apply_error_detail = reason;
    m.applied_at = m.applied_at ?? t;
    m.updated_at = t;
    this.repo.updateCRMMutation(m);
    this.logMutationActivity(m, MutationApplyResult.noop, { reason });
    return { mutation: m, result: MutationApplyResult.noop, detail: reason };
  }

  private fail(m: CRMMutation, msg: string): ApplyOutcome {
    m.status = CRMMutationStatus.failed;
    m.last_apply_result = MutationApplyResult.failed;
    m.apply_error_detail = msg;
    m.updated_at = this.repo.nowIso();
    this.repo.updateCRMMutation(m);
    return { mutation: m, result: MutationApplyResult.failed, detail: msg };
  }

  private applyCreateAccount(m: CRMMutation, t: string): ApplyOutcome {
    const p = m.proposed_payload as { id?: string; name: string; domain?: string; segment?: string };
    const id = p.id ?? this.repo.newId();
    if (this.repo.getAccount(id)) {
      return this.finishNoop(m, 'account id exists');
    }
    const a: Account = {
      id,
      name: p.name,
      domain: p.domain,
      segment: p.segment,
      created_at: t,
      updated_at: t,
    };
    this.repo.insertAccount(a);
    m.status = CRMMutationStatus.applied;
    m.applied_at = t;
    m.last_apply_result = MutationApplyResult.applied;
    m.updated_at = t;
    this.repo.updateCRMMutation(m);
    this.logMutationActivity(m, MutationApplyResult.applied, { account_id: id });
    return { mutation: m, result: MutationApplyResult.applied };
  }

  private applyUpdateAccount(m: CRMMutation, t: string): ApplyOutcome {
    const id = m.target_entity_id;
    if (!id) return this.fail(m, 'missing target_entity_id');
    const cur = this.repo.getAccount(id);
    if (!cur) return this.fail(m, 'account not found');
    const p = m.proposed_payload as Partial<Account>;
    const next: Account = {
      ...cur,
      ...p,
      id: cur.id,
      updated_at: t,
    };
    this.repo.updateAccount(next);
    m.status = CRMMutationStatus.applied;
    m.applied_at = t;
    m.last_apply_result = MutationApplyResult.applied;
    m.updated_at = t;
    this.repo.updateCRMMutation(m);
    this.logMutationActivity(m, MutationApplyResult.applied, { account_id: id });
    return { mutation: m, result: MutationApplyResult.applied };
  }

  private applyCreateContact(m: CRMMutation, t: string): ApplyOutcome {
    const p = m.proposed_payload as {
      id?: string;
      account_id?: string;
      email?: string;
      full_name?: string;
      title?: string;
    };
    if (p.email) {
      const existing = this.repo.findContactByEmail(p.email);
      if (existing) return this.finishNoop(m, 'contact email exists');
    }
    const id = p.id ?? this.repo.newId();
    const c: Contact = {
      id,
      account_id: p.account_id,
      email: p.email,
      full_name: p.full_name,
      title: p.title,
      created_at: t,
      updated_at: t,
    };
    this.repo.insertContact(c);
    m.status = CRMMutationStatus.applied;
    m.applied_at = t;
    m.last_apply_result = MutationApplyResult.applied;
    m.updated_at = t;
    this.repo.updateCRMMutation(m);
    this.logMutationActivity(m, MutationApplyResult.applied, { contact_id: id });
    return { mutation: m, result: MutationApplyResult.applied };
  }

  private applyUpdateContact(m: CRMMutation, t: string): ApplyOutcome {
    const id = m.target_entity_id;
    if (!id) return this.fail(m, 'missing target_entity_id');
    const cur = this.repo.getContact(id);
    if (!cur) return this.fail(m, 'contact not found');
    const p = m.proposed_payload as Partial<Contact>;
    const next: Contact = { ...cur, ...p, id: cur.id, updated_at: t };
    this.repo.updateContact(next);
    m.status = CRMMutationStatus.applied;
    m.applied_at = t;
    m.last_apply_result = MutationApplyResult.applied;
    m.updated_at = t;
    this.repo.updateCRMMutation(m);
    this.logMutationActivity(m, MutationApplyResult.applied, { contact_id: id });
    return { mutation: m, result: MutationApplyResult.applied };
  }

  private applyMergeContact(m: CRMMutation, t: string): ApplyOutcome {
    const survivorId = m.target_entity_id;
    const victimId = m.secondary_target_id;
    if (!survivorId || !victimId) return this.fail(m, 'merge needs target + secondary contact ids');
    const survivor = this.repo.getContact(survivorId);
    const victim = this.repo.getContact(victimId);
    if (!survivor || !victim) return this.fail(m, 'contact not found');

    const merged: Contact = {
      ...survivor,
      email: survivor.email ?? victim.email,
      full_name: survivor.full_name ?? victim.full_name,
      title: survivor.title ?? victim.title,
      account_id: survivor.account_id ?? victim.account_id,
      last_verified_at: pickNewer(survivor.last_verified_at, victim.last_verified_at),
      updated_at: t,
    };
    this.repo.updateContact(merged);

    const deals = this.repo.listOpenDeals().filter((d) => d.contact_id === victimId);
    for (const d of deals) {
      this.repo.updateDeal({ ...d, contact_id: survivorId, updated_at: t });
    }

    const vEdges = this.repo.listEdgesForEntity(EntityRefType.contact, victimId);
    let partial = false;
    for (const e of vEdges) {
      try {
        const neu: RelationshipEdge = {
          id: this.repo.newId(),
          from_entity_type: e.from_entity_type,
          from_entity_id: e.from_entity_id === victimId ? survivorId : e.from_entity_id,
          to_entity_type: e.to_entity_type,
          to_entity_id: e.to_entity_id === victimId ? survivorId : e.to_entity_id,
          edge_type: e.edge_type,
          confidence: e.confidence,
          source_evidence: e.source_evidence,
          created_at: t,
        };
        this.repo.insertRelationshipEdge(neu);
        this.repo.updateEdgeSuperseded(e.id, neu.id);
      } catch {
        partial = true;
      }
    }

    this.repo.deleteContact(victimId);

    const act: Activity = {
      id: this.repo.newId(),
      activity_type: ActivityType.contact_merged,
      entity_type: EntityRefType.contact,
      entity_id: survivorId,
      payload: { survivor_id: survivorId, merged_contact_id: victimId, crm_mutation_id: m.id },
      crm_mutation_id: m.id,
      created_at: t,
    };
    this.repo.appendActivity(act);

    m.status = CRMMutationStatus.applied;
    m.applied_at = t;
    m.last_apply_result = partial ? MutationApplyResult.partial : MutationApplyResult.applied;
    m.updated_at = t;
    this.repo.updateCRMMutation(m);
    this.logMutationActivity(m, m.last_apply_result!, { survivor_id: survivorId, victim_id: victimId });
    return { mutation: m, result: m.last_apply_result! };
  }

  private applyCreateDeal(m: CRMMutation, t: string): ApplyOutcome {
    const p = m.proposed_payload as {
      id?: string;
      account_id: string;
      contact_id?: string;
      deal_stage?: string;
      assigned_mode?: string;
    };
    const id = p.id ?? this.repo.newId();
    const d: Deal = {
      id,
      account_id: p.account_id,
      contact_id: p.contact_id,
      assigned_mode: (p.assigned_mode as AssignedMode) ?? AssignedMode.auto,
      deal_stage: p.deal_stage ?? DealStage.working,
      created_at: t,
      updated_at: t,
    };
    this.repo.insertDeal(d);
    m.status = CRMMutationStatus.applied;
    m.applied_at = t;
    m.last_apply_result = MutationApplyResult.applied;
    m.updated_at = t;
    this.repo.updateCRMMutation(m);
    this.logMutationActivity(m, MutationApplyResult.applied, { deal_id: id });
    return { mutation: m, result: MutationApplyResult.applied };
  }

  private applyUpdateDealStage(m: CRMMutation, t: string): ApplyOutcome {
    const id = m.target_entity_id;
    if (!id) return this.fail(m, 'missing deal id');
    const cur = this.repo.getDeal(id);
    if (!cur) return this.fail(m, 'deal not found');
    const p = m.proposed_payload as { deal_stage: string };
    this.repo.updateDeal({ ...cur, deal_stage: p.deal_stage, updated_at: t });
    m.status = CRMMutationStatus.applied;
    m.applied_at = t;
    m.last_apply_result = MutationApplyResult.applied;
    m.updated_at = t;
    this.repo.updateCRMMutation(m);
    this.logMutationActivity(m, MutationApplyResult.applied, { deal_id: id, deal_stage: p.deal_stage });
    return { mutation: m, result: MutationApplyResult.applied };
  }

  private applyAttachRelationship(m: CRMMutation, t: string): ApplyOutcome {
    const p = m.proposed_payload as Omit<RelationshipEdge, 'created_at'>;
    if (!p.source_evidence?.length) return this.fail(m, 'edges require evidence');
    const e: RelationshipEdge = {
      ...p,
      id: p.id ?? this.repo.newId(),
      created_at: t,
    };
    this.repo.insertRelationshipEdge(e);
    m.status = CRMMutationStatus.applied;
    m.applied_at = t;
    m.last_apply_result = MutationApplyResult.applied;
    m.updated_at = t;
    this.repo.updateCRMMutation(m);
    this.logMutationActivity(m, MutationApplyResult.applied, { edge_id: e.id });
    return { mutation: m, result: MutationApplyResult.applied };
  }

  private applyMarkSuppressed(m: CRMMutation, t: string): ApplyOutcome {
    const p = m.proposed_payload as { email: string; reason: string; source_ref?: string };
    this.repo.upsertSuppression({
      email: p.email,
      reason: p.reason,
      timestamp: t,
      source_ref: p.source_ref,
    });
    m.status = CRMMutationStatus.applied;
    m.applied_at = t;
    m.last_apply_result = MutationApplyResult.applied;
    m.updated_at = t;
    this.repo.updateCRMMutation(m);
    this.logMutationActivity(m, MutationApplyResult.applied, { email: p.email });
    return { mutation: m, result: MutationApplyResult.applied };
  }

  private applyMarkStale(m: CRMMutation, t: string): ApplyOutcome {
    const p = m.proposed_payload as { entity: 'account' | 'contact' | 'deal'; id: string; stale_reason: string };
    if (p.entity === 'account') {
      const a = this.repo.getAccount(p.id);
      if (!a) return this.fail(m, 'account not found');
      this.repo.updateAccount({
        ...a,
        stale_reason: p.stale_reason,
        freshness_score: 0.2,
        updated_at: t,
      });
    } else if (p.entity === 'contact') {
      const c = this.repo.getContact(p.id);
      if (!c) return this.fail(m, 'contact not found');
      this.repo.updateContact({ ...c, stale_reason: p.stale_reason, freshness_score: 0.2, updated_at: t });
    } else {
      const d = this.repo.getDeal(p.id);
      if (!d) return this.fail(m, 'deal not found');
      this.repo.updateDeal({ ...d, stale_reason: p.stale_reason, freshness_score: 0.2, updated_at: t });
    }
    m.status = CRMMutationStatus.applied;
    m.applied_at = t;
    m.last_apply_result = MutationApplyResult.applied;
    m.updated_at = t;
    this.repo.updateCRMMutation(m);
    this.logMutationActivity(m, MutationApplyResult.applied, { target: p });
    return { mutation: m, result: MutationApplyResult.applied };
  }

  private applyAssignOwner(m: CRMMutation, t: string): ApplyOutcome {
    const p = m.proposed_payload as { deal_id?: string; owner_id: string };
    const dealId = p.deal_id ?? m.target_entity_id;
    if (!dealId) return this.fail(m, 'missing deal');
    const d = this.repo.getDeal(dealId);
    if (!d) return this.fail(m, 'deal not found');
    this.repo.updateDeal({ ...d, owner_id: p.owner_id, updated_at: t });
    m.status = CRMMutationStatus.applied;
    m.applied_at = t;
    m.last_apply_result = MutationApplyResult.applied;
    m.updated_at = t;
    this.repo.updateCRMMutation(m);
    this.logMutationActivity(m, MutationApplyResult.applied, { deal_id: dealId, owner_id: p.owner_id });
    return { mutation: m, result: MutationApplyResult.applied };
  }

  private logMutationActivity(m: CRMMutation, result: MutationApplyResult, payload: Record<string, unknown>): void {
    const a: Activity = {
      id: this.repo.newId(),
      activity_type: ActivityType.crm_mutation_applied,
      entity_type: m.target_entity_type,
      entity_id: m.target_entity_id,
      payload: { crm_mutation_id: m.id, apply_result: result, ...payload },
      crm_mutation_id: m.id,
      created_at: this.repo.nowIso(),
    };
    this.repo.appendActivity(a);
  }
}

function pickNewer(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
