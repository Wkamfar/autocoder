import { randomUUID } from 'node:crypto';
import type { CRMMutation, EvidenceRef } from '../types/entities.js';
import {
  CRMMutationStatus,
  CRMMutationType,
  EntityRefType,
  EvidenceRefKind,
} from '../types/enums.js';
import { mutationIdempotencyKey } from '../idempotency.js';
import type { SalesRepository } from '../storage/salesRepository.js';

export function nowIso(): string {
  return new Date().toISOString();
}

export type ProposeCRMMutationInput = Omit<
  CRMMutation,
  'id' | 'created_at' | 'updated_at' | 'idempotency_key' | 'status'
> & {
  idempotency_key?: string;
  status?: CRMMutation['status'];
};

export function proposeMutation(repo: SalesRepository, input: ProposeCRMMutationInput): CRMMutation {
  const t = nowIso();
  const id = randomUUID();
  const idempotency_key =
    input.idempotency_key ||
    mutationIdempotencyKey(input.mutation_type, input.target_entity_id, input.proposed_payload);
  const existing = repo.getCRMMutationByIdempotency(idempotency_key);
  if (existing) return existing;

  const m: CRMMutation = {
    id,
    idempotency_key,
    mutation_type: input.mutation_type,
    target_entity_type: input.target_entity_type,
    target_entity_id: input.target_entity_id,
    secondary_target_id: input.secondary_target_id,
    proposed_payload: input.proposed_payload,
    confidence_score: input.confidence_score,
    source_evidence: input.source_evidence,
    explanation: input.explanation,
    status: input.status ?? CRMMutationStatus.proposed,
    auto_apply_allowed: input.auto_apply_allowed,
    created_at: t,
    updated_at: t,
  };
  repo.insertCRMMutation(m);
  return m;
}

export function approveMutation(repo: SalesRepository, id: string, by: string): CRMMutation | undefined {
  const m = repo.getCRMMutationById(id);
  if (!m) return undefined;
  const t = nowIso();
  repo.approveCRMMutation(id, by, t);
  return repo.getCRMMutationById(id);
}

export function evidenceFromSource(sourceId: string): EvidenceRef[] {
  return [{ kind: EvidenceRefKind.crm_entity_source, ref_id: sourceId }];
}

export function buildCreateAccountMutation(
  repo: SalesRepository,
  name: string,
  domain: string | undefined,
  evidence: EvidenceRef[],
  autoApply: boolean,
  opts?: { segment?: string; score_json?: Record<string, unknown> }
): CRMMutation {
  return proposeMutation(repo, {
    mutation_type: CRMMutationType.create_account,
    target_entity_type: EntityRefType.account,
    proposed_payload: {
      name,
      domain,
      ...(opts?.segment != null ? { segment: opts.segment } : {}),
      ...(opts?.score_json != null ? { score_json: opts.score_json } : {}),
    },
    confidence_score: 0.9,
    source_evidence: evidence,
    explanation: `Create account ${name}`,
    auto_apply_allowed: autoApply,
  });
}

export function buildCreateContactMutation(
  repo: SalesRepository,
  accountId: string | undefined,
  email: string,
  fullName: string | undefined,
  evidence: EvidenceRef[],
  autoApply: boolean
): CRMMutation {
  return proposeMutation(repo, {
    mutation_type: CRMMutationType.create_contact,
    target_entity_type: EntityRefType.contact,
    proposed_payload: { account_id: accountId, email, full_name: fullName },
    confidence_score: 0.85,
    source_evidence: evidence,
    explanation: `Create contact ${email}`,
    auto_apply_allowed: autoApply,
  });
}

export function buildCreateDealMutation(
  repo: SalesRepository,
  accountId: string,
  contactId: string | undefined,
  evidence: EvidenceRef[],
  autoApply: boolean
): CRMMutation {
  return proposeMutation(repo, {
    mutation_type: CRMMutationType.create_deal,
    target_entity_type: EntityRefType.deal,
    proposed_payload: { account_id: accountId, contact_id: contactId },
    confidence_score: 0.8,
    source_evidence: evidence,
    explanation: `Create deal for account ${accountId}`,
    auto_apply_allowed: autoApply,
  });
}
