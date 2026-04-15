import { config } from '../../config.js';
import type { DecisionScore } from '../decisionEngine/types.js';
import type { SalesDeal } from '../world/types.js';
import type { SalesStrategyProfile } from './types.js';
import { dealValueBucketUsd, normalizeStage } from './valueBuckets.js';

function dealValueUsd(deal: SalesDeal): number {
  if (deal.value_cents == null || deal.value_cents <= 0) return 0;
  return deal.value_cents / 100;
}

/**
 * Phase 5 — transparent `priority_index` lift when segment matches learned tuning.
 */
export function applyLearnedPriorityBoost(
  score: DecisionScore,
  deal: SalesDeal,
  profile: SalesStrategyProfile | null | undefined
): DecisionScore {
  if (!profile?.segment_priority_tunings?.length) return score;
  const key = `stage:${normalizeStage(deal.stage)}|bucket:${dealValueBucketUsd(dealValueUsd(deal))}`;
  const tuning = profile.segment_priority_tunings.find((t) => t.segment_key === key);
  if (!tuning || tuning.priority_boost_suggestion <= 0) return score;

  const newIndex = Math.min(100, score.priority_index + tuning.priority_boost_suggestion);
  const de = config.decisionEngine;
  const debate_recommended =
    newIndex >= de.minPriorityIndex && score.trigger_reasons.length >= de.debateMinTriggers;

  return {
    ...score,
    priority_index: newIndex,
    learned_priority_boost: tuning.priority_boost_suggestion,
    learned_priority_basis: tuning.basis,
    debate_recommended,
  };
}
