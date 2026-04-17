import { CRMMutationStatus, MutationApplyResult } from './types/enums.js';
import { approveMutation } from './builder/crmMutationHelpers.js';
import { proposeLinkContactsToAccountsByDomain, proposeDealsForLinkedContacts } from './builder/postImportLink.js';
import type { SalesContext } from './salesContext.js';

/** Approve + apply proposed mutations, then link + deals pipeline (shared CLI + Discord). */
export function applyPendingPipeline(ctx: SalesContext, approver: string): {
  mutationsApplied: number;
  linkMutations: number;
  dealMutations: number;
} {
  const { repo, applyService } = ctx;
  let mutationsApplied = 0;
  const pending = repo.listCRMMutationsByStatus(CRMMutationStatus.proposed);
  for (const p of pending) {
    approveMutation(repo, p.id, approver);
    const m = repo.getCRMMutationById(p.id);
    if (m) {
      const out = applyService.apply(m);
      if (
        out.result === MutationApplyResult.applied ||
        out.result === MutationApplyResult.noop ||
        out.result === MutationApplyResult.partial
      ) {
        mutationsApplied += 1;
      }
    }
  }
  let linkMutations = 0;
  for (const id of proposeLinkContactsToAccountsByDomain(repo)) {
    approveMutation(repo, id, approver);
    const m = repo.getCRMMutationById(id);
    if (m) {
      applyService.apply(m);
      linkMutations += 1;
    }
  }
  let dealMutations = 0;
  for (const id of proposeDealsForLinkedContacts(repo)) {
    approveMutation(repo, id, approver);
    const m = repo.getCRMMutationById(id);
    if (m) {
      applyService.apply(m);
      dealMutations += 1;
    }
  }
  return { mutationsApplied, linkMutations, dealMutations };
}
