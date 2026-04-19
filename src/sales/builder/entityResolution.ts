/**
 * Entity resolution: candidate → canonical account (plan §3).
 */
import { randomUUID } from 'node:crypto';
import type { Account, EntityResolutionDecision, EvidenceRef } from '../types/entities.js';
import { EntityRefType, EntityResolutionOutcome } from '../types/enums.js';
import type { SalesRepository } from '../storage/salesRepository.js';
import { normalizeLegalName, normalizeRegistrableDomain } from './entityNormalization.js';

export interface AccountResolutionInput {
  companyName: string;
  domain?: string;
  evidence: EvidenceRef[];
}

export interface AccountResolutionResult {
  outcome: (typeof EntityResolutionOutcome)[keyof typeof EntityResolutionOutcome];
  confidence: number;
  matched?: Account;
  matches: Account[];
  explanation: string;
  decision: EntityResolutionDecision;
}

function scoreDomainMatch(a: Account, normDomain: string): boolean {
  const ad = normalizeRegistrableDomain(a.domain);
  return !!ad && ad === normDomain;
}

function scoreNameMatch(a: Account, normName: string): boolean {
  return normalizeLegalName(a.name) === normName;
}

/**
 * Resolve whether to create a new account, link to existing, or await review.
 */
export function resolveAccountCandidate(
  repo: SalesRepository,
  input: AccountResolutionInput,
  atIso: string
): AccountResolutionResult {
  const normDomain = normalizeRegistrableDomain(input.domain);
  const normName = normalizeLegalName(input.companyName);

  /** Domain-first; legal-name only when no domain supplied (avoid wrong tie-break when domain is new). */
  const matches: Account[] = normDomain
    ? repo.findAccountsByNormalizedDomain(normDomain)
    : normName.length > 1
      ? repo.findAccountsByNormalizedLegalName(normName)
      : [];
  let outcome: (typeof EntityResolutionOutcome)[keyof typeof EntityResolutionOutcome];
  let confidence: number;
  let explanation: string;
  let matched: Account | undefined;

  if (matches.length === 1 && normDomain) {
    outcome = EntityResolutionOutcome.link_to_account;
    confidence = 0.95;
    matched = matches[0];
    explanation = `Single domain match: ${normDomain}`;
  } else if (matches.length > 1 && normDomain) {
    outcome = EntityResolutionOutcome.await_review;
    confidence = 0.4;
    explanation = `Ambiguous domain: ${matches.length} accounts share ${normDomain}`;
  } else if (matches.length === 1 && !normDomain) {
    outcome = EntityResolutionOutcome.link_to_account;
    confidence = 0.72;
    matched = matches[0];
    explanation = `Single legal-name match: ${normName}`;
  } else if (matches.length > 1 && !normDomain) {
    outcome = EntityResolutionOutcome.await_review;
    confidence = 0.35;
    explanation = `Ambiguous legal name: ${matches.length} accounts`;
  } else {
    outcome = EntityResolutionOutcome.create_new;
    confidence = 0.85;
    explanation = 'No existing account matched domain or legal name';
  }

  const decision: EntityResolutionDecision = {
    id: randomUUID(),
    candidate_refs: input.evidence,
    matched_entity_type: matched ? EntityRefType.account : undefined,
    matched_entity_id: matched?.id,
    confidence,
    outcome,
    explanation,
    created_at: atIso,
  };

  repo.insertEntityResolutionDecision(decision);

  return {
    outcome,
    confidence,
    matched,
    matches,
    explanation,
    decision,
  };
}
