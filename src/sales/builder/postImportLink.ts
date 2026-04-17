import type { SalesRepository } from '../storage/salesRepository.js';
import { CRMMutationType, EntityRefType, EvidenceRefKind } from '../types/enums.js';
import { proposeMutation, buildCreateDealMutation } from './crmMutationHelpers.js';
import type { EvidenceRef } from '../types/entities.js';

/** Match contact email domain to account.domain; propose update_contact mutations. */
export function proposeLinkContactsToAccountsByDomain(repo: SalesRepository): string[] {
  const accounts = repo.listAccounts();
  const contacts = repo.listContacts();
  const domainToAccount = new Map<string, string>();
  for (const a of accounts) {
    if (a.domain) domainToAccount.set(a.domain.toLowerCase(), a.id);
  }
  const ids: string[] = [];
  for (const c of contacts) {
    if (c.account_id || !c.email) continue;
    const domain = c.email.split('@')[1]?.toLowerCase();
    if (!domain) continue;
    const accId = domainToAccount.get(domain);
    if (!accId) continue;
    const ev: EvidenceRef[] = [{ kind: EvidenceRefKind.manual_attestation, ref_id: `link:${c.id}:${accId}` }];
    const m = proposeMutation(repo, {
      mutation_type: CRMMutationType.update_contact,
      target_entity_type: EntityRefType.contact,
      target_entity_id: c.id,
      proposed_payload: { account_id: accId },
      confidence_score: 0.95,
      source_evidence: ev,
      explanation: `Link contact ${c.email} to account ${accId} by domain`,
      auto_apply_allowed: true,
    });
    ids.push(m.id);
  }
  return ids;
}

/** After contacts are on accounts, one open deal per (account, contact) pair. */
export function proposeDealsForLinkedContacts(repo: SalesRepository): string[] {
  const ids: string[] = [];
  for (const c of repo.listContacts()) {
    if (!c.account_id) continue;
    const deals = repo.listDealsForAccount(c.account_id);
    if (deals.some((d) => d.contact_id === c.id)) continue;
    const ev = [{ kind: EvidenceRefKind.manual_attestation, ref_id: `deal:${c.account_id}:${c.id}` }];
    const m = buildCreateDealMutation(repo, c.account_id, c.id, ev, true);
    ids.push(m.id);
  }
  return ids;
}
