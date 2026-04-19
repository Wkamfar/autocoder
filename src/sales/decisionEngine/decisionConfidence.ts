import type { DecisionScore } from './types.js';

/**
 * Transparent confidence — not ML. Combines rank, uncertainty, impact, trigger clarity.
 */
export function decisionConfidence(score: DecisionScore, learnedBoost?: number): number {
  const p = score.priority_index / 100;
  const u = 1 - score.uncertainty;
  const imp = score.expected_impact;
  const trig = Math.min(1, (score.trigger_reasons?.length ?? 0) / 4);
  const boost = learnedBoost ? Math.min(0.12, learnedBoost / 100) : 0;
  const raw = 0.32 * p + 0.28 * u + 0.25 * imp + 0.15 * trig + boost;
  return Math.min(1, Math.max(0, raw));
}
