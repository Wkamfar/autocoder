import { config } from '../../config.js';
import type { SalesDeal } from '../world/types.js';

export interface TriggerEvaluation {
  reasons: string[];
}

function stageLower(stage: string): string {
  return stage.trim().toLowerCase();
}

/** True if CRM stage string matches configured high-touch substrings. */
export function isHighTouchStage(stage: string): boolean {
  const s = stageLower(stage);
  const needles = config.decisionEngine.triggerStages;
  return needles.some((n) => s.includes(n.toLowerCase()));
}

/**
 * Collect trigger labels for UX. Thresholds come from `config.decisionEngine`.
 * Does not compute scores — see `computeDecisionScore`.
 */
export function evaluateTriggers(input: {
  deal: SalesDeal;
  dealValueUsd: number;
  stalenessDays: number;
  uncertainty: number;
  conflictingObjections: boolean;
  accountOverrideSignal: boolean;
}): TriggerEvaluation {
  const reasons: string[] = [];
  const de = config.decisionEngine;

  if (de.triggerMinDealValueUsd > 0 && input.dealValueUsd >= de.triggerMinDealValueUsd) {
    reasons.push(
      `deal_value≥$${de.triggerMinDealValueUsd.toLocaleString('en-US')} (nominal)`
    );
  }

  if (input.stalenessDays >= de.triggerStallDays) {
    reasons.push(`stalled≥${de.triggerStallDays}d`);
  }

  if (isHighTouchStage(input.deal.stage)) {
    reasons.push(`stage=${input.deal.stage} (high-touch)`);
  }

  if (input.uncertainty >= de.triggerMinUncertainty) {
    reasons.push(`uncertainty≥${de.triggerMinUncertainty}`);
  }

  if (input.conflictingObjections) {
    reasons.push(`conflicting_signals(objections≥${de.triggerConflictingObjections})`);
  }

  if (input.accountOverrideSignal) {
    reasons.push('human_override_pattern(recent outcomes)');
  }

  return { reasons };
}
