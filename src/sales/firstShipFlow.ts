/**
 * First-ship vertical slice (v7):
 * CSV import → proposed CRM mutations → approve → apply → link contacts → deals →
 * stale follow-up SalesAction → approve → send (log) → reply classification → optional stage update
 */
import type { SalesContext } from './salesContext.js';
import { importCsvToSourcesAndProposals } from './adapters/csvImport.js';
import { proposeLinkContactsToAccountsByDomain, proposeDealsForLinkedContacts } from './builder/postImportLink.js';
import { planStaleFollowUpActions } from './runtime/salesStrategicPlanner.js';
import { approveSalesAction, markSalesActionExecuting } from './runtime/salesActionHelpers.js';
import { executeApprovedSalesActionSend, LogEmailAdapter } from './runtime/emailOutbound.js';
import { classifyReply } from './runtime/replyClassifier.js';
import {
  proposeMutation,
  approveMutation,
} from './builder/crmMutationHelpers.js';
import {
  CRMMutationType,
  EntityRefType,
  EvidenceRefKind,
  DealStage,
  ReplyClass,
} from './types/enums.js';

export interface FirstShipOptions {
  csvPath: string;
  staleDays: number;
  approver: string;
}

export async function runFirstShipFlow(ctx: SalesContext, opt: FirstShipOptions): Promise<void> {
  const { repo, applyService } = ctx;

  const { mutationIds } = importCsvToSourcesAndProposals(repo, opt.csvPath, 'first-ship', false);
  for (const mid of mutationIds) {
    approveMutation(repo, mid, opt.approver);
    const m = repo.getCRMMutationById(mid);
    if (m) applyService.apply(m);
  }

  const linkIds = proposeLinkContactsToAccountsByDomain(repo);
  for (const mid of linkIds) {
    approveMutation(repo, mid, opt.approver);
    const m = repo.getCRMMutationById(mid);
    if (m) applyService.apply(m);
  }

  const dealIds = proposeDealsForLinkedContacts(repo);
  for (const mid of dealIds) {
    approveMutation(repo, mid, opt.approver);
    const m = repo.getCRMMutationById(mid);
    if (m) applyService.apply(m);
  }

  for (const d of repo.listOpenDeals()) {
    repo.updateDeal({
      ...d,
      last_contacted_at: undefined,
      updated_at: repo.nowIso(),
    });
  }

  const actions = planStaleFollowUpActions(repo, { staleDays: opt.staleDays });
  const email = new LogEmailAdapter();
  for (const sa of actions) {
    const approved = approveSalesAction(repo, sa.id, opt.approver);
    if (!approved) continue;
    markSalesActionExecuting(repo, sa.id);
    const toSend = repo.getSalesAction(sa.id);
    if (toSend) await executeApprovedSalesActionSend(repo, toSend, email);
  }

  const sampleReply = "Yes, let's schedule something next week.";
  const cls = classifyReply(sampleReply);
  console.log('[sales] sample reply classification:', cls);

  const deal = repo.listOpenDeals()[0];
  if (deal) {
    const nextStage =
      cls.reply_class === ReplyClass.positive_intent ? DealStage.qualified : DealStage.working;
    const stageMutation = proposeMutation(repo, {
      mutation_type: CRMMutationType.update_deal_stage,
      target_entity_type: EntityRefType.deal,
      target_entity_id: deal.id,
      proposed_payload: { deal_stage: nextStage },
      confidence_score: 1,
      source_evidence: [{ kind: EvidenceRefKind.manual_attestation, ref_id: 'reply-classify-demo' }],
      explanation: 'Stage update from reply classification (demo)',
      auto_apply_allowed: true,
    });
    approveMutation(repo, stageMutation.id, opt.approver);
    const m = repo.getCRMMutationById(stageMutation.id);
    if (m) applyService.apply(m);
  }
}
