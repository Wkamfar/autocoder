import { config } from '../../config.js';
import type { SalesWorldFile } from '../world/types.js';
import { loadSalesWorld } from '../world/fileWorldStore.js';
import { getAccount } from '../world/fileWorldStore.js';
import { rankDealsForDebate } from './prioritize.js';
import type { DecisionScore } from './types.js';
import { decisionConfidence } from './decisionConfidence.js';
import type { DecisionMoment } from './decisionMomentTypes.js';

function dealValueUsd(dealId: string, world: SalesWorldFile): number {
  const d = world.deals.find((x) => x.id === dealId);
  if (!d?.value_cents) return 0;
  return d.value_cents / 100;
}

function accountLabel(dealId: string, world: SalesWorldFile): string | undefined {
  const d = world.deals.find((x) => x.id === dealId);
  if (!d) return undefined;
  const a = getAccount(world, d.account_id);
  return a?.name ?? d.account_id;
}

/**
 * Returns at most one moment — highest leverage that passes confidence + priority gates.
 */
export async function computeTopDecisionMoment(world?: SalesWorldFile): Promise<DecisionMoment | null> {
  const w = world ?? loadSalesWorld();
  const rows = await rankDealsForDebate(w, { limit: 8, onlyRecommended: true });
  const minC = config.decisionMoments.minConfidence;
  const minP = config.decisionMoments.minPriorityIndex / 100; // vs priority_index/100

  let best: { score: DecisionScore; conf: number } | null = null;
  for (const score of rows) {
    const conf = decisionConfidence(score, score.learned_priority_boost);
    const p = score.priority_index / 100;
    if (conf < minC || p < minP) continue;
    if (!best || conf > best.conf) best = { score, conf };
  }

  if (!best) return null;

  const s = best.score;
  const dealId = s.deal_id;
  const hours = config.decisionMoments.expiryHours;
  const exp = new Date(Date.now() + hours * 3600_000).toISOString();

  const why_now = [
    s.staleness ? `stalled ${s.staleness}d` : '',
    s.stage_risk ? String(s.stage_risk) : '',
    ...(s.trigger_reasons ?? []).slice(0, 2),
  ]
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    deal_id: dealId,
    moment_type: 'followup_needed',
    priority: s.priority_index / 100,
    confidence: best.conf,
    expires_at: exp,
    recommended_action: 'run_debate',
    why_now,
    account_label: accountLabel(dealId, w) ?? s.account_name,
    value_usd: dealValueUsd(dealId, w) || s.deal_value,
  };
}
