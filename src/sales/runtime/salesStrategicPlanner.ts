import type { SalesRepository } from '../storage/salesRepository.js';
import type { SalesAction } from '../types/entities.js';
import {
  SalesActionStatus,
  HumanGateReason,
  DealStage,
  AssignedMode,
} from '../types/enums.js';
import { buildCustomerContext } from './customerContextBuilder.js';
import { findStaleDeals } from './staleDetection.js';

export interface PlanFollowUpInput {
  staleDays: number;
}

/**
 * Proposes stale-follow-up SalesAction rows for deals that need nudges.
 * Invariant: OUTBOUND_REQUIRES_SALES_ACTION — email send attaches here.
 */
export function planStaleFollowUpActions(
  repo: SalesRepository,
  input: PlanFollowUpInput
): SalesAction[] {
  const stale = findStaleDeals(repo, input.staleDays);
  const created: SalesAction[] = [];
  const t = new Date().toISOString();
  for (const { deal } of stale) {
    const idempotency_key = `stale_followup:${deal.id}`;
    if (repo.getSalesActionByIdempotencyKey(idempotency_key)) continue;
    const id = repo.newId();
    const needsHuman =
      deal.assigned_mode === AssignedMode.human || deal.deal_stage === DealStage.proposal;
    const ctx = buildCustomerContext(repo, deal.account_id);
    if (!ctx.account) continue;
    const sa: SalesAction = {
      id,
      idempotency_key,
      action_type: 'send_followup',
      account_id: deal.account_id,
      contact_id: deal.contact_id,
      deal_id: deal.id,
      status: needsHuman ? SalesActionStatus.awaiting_approval : SalesActionStatus.proposed,
      risk_level: needsHuman ? 'high' : 'low',
      payload: {
        subject: 'Following up',
        body: 'Quick check-in — still interested in continuing our conversation?',
        channel: 'email',
      },
      context_snapshot: { ...ctx, planner: 'stale_follow_up' },
      approval_required: needsHuman,
      human_gate_reason: needsHuman ? HumanGateReason.high_value_deal : undefined,
      created_at: t,
      updated_at: t,
    };
    try {
      repo.insertSalesAction(sa);
      created.push(sa);
    } catch {
      /* idempotency_key unique — skip duplicate */
    }
  }
  return created;
}
