import { config } from '../../config.js';
import { loadOutcomes } from '../pairDebate/outcomes.js';
import type { PairDebateOutcomeRecord } from '../pairDebate/types.js';

/**
 * True if this account has enough recent logged `human_override_reason` rows
 * to suggest revisiting strategy (pattern signal — not a judgment).
 */
export function accountHasOverridePattern(
  outcomes: PairDebateOutcomeRecord[],
  accountId: string
): boolean {
  const days = config.decisionEngine.overrideLookbackDays;
  const min = config.decisionEngine.overridePatternMinCount;
  const cutoff = Date.now() - days * 86_400_000;
  let n = 0;
  for (const o of outcomes) {
    if (o.account_id !== accountId) continue;
    if (!o.human_override_reason || !String(o.human_override_reason).trim()) continue;
    const t = Date.parse(o.ts);
    if (!Number.isFinite(t) || t < cutoff) continue;
    n++;
    if (n >= min) return true;
  }
  return false;
}

/** Load outcomes once per ranking pass. */
export async function loadOutcomesForDecisionEngine(): Promise<PairDebateOutcomeRecord[]> {
  return loadOutcomes(50_000);
}
