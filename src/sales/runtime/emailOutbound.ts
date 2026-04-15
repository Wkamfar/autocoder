import type { SalesAction } from '../types/entities.js';
import { SalesActionStatus, ActivityType, EntityRefType } from '../types/enums.js';
import type { SalesRepository } from '../storage/salesRepository.js';
import { recordRevenueMetric } from './revenueMetrics.js';

export interface EmailSendResult {
  provider_message_id: string;
  sent_at: string;
}

/**
 * Outbound email port — LogEmailAdapter for v1 (no Gmail API).
 * Invariant: OUTBOUND_REQUIRES_SALES_ACTION
 */
export interface EmailOutboundPort {
  sendDraft(action: SalesAction): Promise<EmailSendResult>;
}

export class LogEmailAdapter implements EmailOutboundPort {
  async sendDraft(action: SalesAction): Promise<EmailSendResult> {
    const body = (action.payload as { body?: string }).body ?? '';
    const subject = (action.payload as { subject?: string }).subject ?? '';
    console.log(`[sales.email] to=contact subject=${JSON.stringify(subject)} body=${JSON.stringify(body.slice(0, 200))}`);
    return {
      provider_message_id: `log:${action.id}`,
      sent_at: new Date().toISOString(),
    };
  }
}

export async function executeApprovedSalesActionSend(
  repo: SalesRepository,
  action: SalesAction,
  email: EmailOutboundPort
): Promise<SalesAction> {
  if (
    action.status !== SalesActionStatus.approved &&
    action.status !== SalesActionStatus.executing
  ) {
    throw new Error('SalesAction must be approved or executing before send');
  }
  const t = repo.nowIso();
  const result = await email.sendDraft(action);
  const next: SalesAction = {
    ...action,
    status: SalesActionStatus.completed,
    execution_result: { email: result },
    updated_at: t,
  };
  repo.updateSalesAction(next);
  repo.appendActivity({
    id: repo.newId(),
    activity_type: ActivityType.email_sent,
    entity_type: EntityRefType.deal,
    entity_id: action.deal_id,
    payload: { sales_action_id: action.id, provider_message_id: result.provider_message_id },
    sales_action_id: action.id,
    created_at: t,
  });
  recordRevenueMetric(repo, 'email_sent', 1, { sales_action_id: action.id }, action.deal_id);
  return next;
}
