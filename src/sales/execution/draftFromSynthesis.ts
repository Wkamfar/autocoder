import crypto from 'node:crypto';
import type { FinalDebateSynthesis } from '../pairDebate/types.js';
import type { SalesAction } from './types.js';

/** Build a draft executable action from debate output — still requires policy + human send in assisted mode. */
export function draftSalesActionFromPairDebate(input: {
  synthesis: FinalDebateSynthesis;
  run_id: string;
  deal_id?: string;
  account_id?: string;
}): SalesAction {
  const action_id = `sa_${input.run_id}_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  return {
    action_id,
    action_type: 'send_followup',
    status: 'draft',
    execution_mode: 'assisted',
    approval_required: true,
    origin: 'pair_debate',
    run_id: input.run_id,
    deal_id: input.deal_id,
    account_id: input.account_id,
    decision_context: input.synthesis.recommended_single_next_step,
    final_message: input.synthesis.draft_artifact?.content ?? '',
    created_at: now,
  };
}
