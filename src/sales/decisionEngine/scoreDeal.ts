import { config } from '../../config.js';
import type { SalesAccount } from '../world/types.js';
import type { SalesDeal } from '../world/types.js';
import { evaluateTriggers, isHighTouchStage } from './triggerRules.js';
import type { DecisionScore } from './types.js';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function dealValueUsd(deal: SalesDeal): number {
  if (deal.value_cents == null || deal.value_cents <= 0) return 0;
  const cur = (deal.currency ?? 'USD').toUpperCase();
  if (cur !== 'USD') {
    return deal.value_cents / 100;
  }
  return deal.value_cents / 100;
}

function stalenessDays(deal: SalesDeal): number {
  const d = deal.last_touch_days_ago;
  if (d == null || !Number.isFinite(d) || d < 0) return 0;
  return d;
}

function stageWeight(stage: string): number {
  return isHighTouchStage(stage) ? 1 : 0.35;
}

function conflictingObjections(deal: SalesDeal): boolean {
  const n = deal.objections_raised?.length ?? 0;
  return n >= config.decisionEngine.triggerConflictingObjections;
}

/**
 * Pre-debate uncertainty: no blackboard `missing_evidence` yet — inferred from world fields.
 */
export function modelUncertainty(deal: SalesDeal): number {
  const staleness = Math.min(1, stalenessDays(deal) / 30);
  const objN = deal.objections_raised?.length ?? 0;
  const objPart = Math.min(1, objN / 4);
  const timing =
    String(deal.timing_sensitivity ?? 'medium').toLowerCase() === 'high' ? 1 : 0.4;
  const sw = stageWeight(deal.stage);
  return clamp01(0.35 * staleness + 0.25 * objPart + 0.2 * timing + 0.2 * sw);
}

export function modelExpectedImpact(
  uncertainty: number,
  normValue: number,
  normStaleness: number,
  sw: number
): number {
  return clamp01(0.4 * normValue + 0.25 * normStaleness + 0.2 * sw + 0.15 * uncertainty);
}

function priorityIndex(
  normValue: number,
  normStaleness: number,
  sw: number,
  uncertainty: number
): number {
  const p =
    0.25 * normValue + 0.25 * normStaleness + 0.25 * sw + 0.25 * uncertainty;
  return Math.round(100 * clamp01(p));
}

/**
 * Full `DecisionScore` for one deal. Suppression is handled by the caller.
 */
export function computeDecisionScore(
  deal: SalesDeal,
  account: SalesAccount | undefined,
  input: { accountOverrideSignal: boolean }
): DecisionScore {
  const ref = config.decisionEngine.impactReferenceDealUsd;
  const dv = dealValueUsd(deal);
  const staleness = stalenessDays(deal);
  const normValue = clamp01(ref > 0 ? dv / ref : 0);
  const normStaleness = Math.min(1, staleness / 30);
  const sw = stageWeight(deal.stage);
  const uncertainty = modelUncertainty(deal);
  const expected_impact = modelExpectedImpact(uncertainty, normValue, normStaleness, sw);
  const priority_index = priorityIndex(normValue, normStaleness, sw, uncertainty);

  const { reasons } = evaluateTriggers({
    deal,
    dealValueUsd: dv,
    stalenessDays: staleness,
    uncertainty,
    conflictingObjections: conflictingObjections(deal),
    accountOverrideSignal: input.accountOverrideSignal,
  });

  const de = config.decisionEngine;
  const debate_recommended =
    priority_index >= de.minPriorityIndex && reasons.length >= de.debateMinTriggers;

  return {
    deal_id: deal.id,
    account_id: deal.account_id,
    account_name: account?.name,
    deal_name: deal.name,
    deal_value: dv,
    staleness,
    stage_risk: deal.stage,
    uncertainty,
    expected_impact,
    priority_index,
    trigger_reasons: reasons,
    debate_recommended,
  };
}
