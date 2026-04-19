import type { SalesWorldFile } from '../world/types.js';
import { getAccount } from '../world/fileWorldStore.js';
import { computeDecisionScore } from './scoreDeal.js';
import { isDealSuppressed } from './suppression.js';
import { accountHasOverridePattern, loadOutcomesForDecisionEngine } from './overrideSignals.js';
import type { DecisionScore } from './types.js';
import { loadStrategyProfileSync } from '../intelligence/profileStorage.js';
import { applyLearnedPriorityBoost } from '../intelligence/refineDecisionScore.js';

export interface RankOptions {
  /** Max rows returned after sort (default 20). */
  limit?: number;
  /** If false, only return rows with debate_recommended (default true). */
  onlyRecommended?: boolean;
}

/**
 * Score every non-suppressed deal, sort by `priority_index` desc.
 */
export async function rankDealsForDebate(
  world: SalesWorldFile,
  options: RankOptions = {}
): Promise<DecisionScore[]> {
  const limit = options.limit ?? 20;
  const onlyRecommended = options.onlyRecommended !== false;
  const outcomes = await loadOutcomesForDecisionEngine();
  const strategyProfile = loadStrategyProfileSync();

  const byAccountOverride = new Map<string, boolean>();
  for (const d of world.deals) {
    if (!byAccountOverride.has(d.account_id)) {
      byAccountOverride.set(d.account_id, accountHasOverridePattern(outcomes, d.account_id));
    }
  }

  const rows: DecisionScore[] = [];
  for (const deal of world.deals) {
    if (isDealSuppressed(world, deal.id, deal.account_id)) continue;
    const account = getAccount(world, deal.account_id);
    const accountOverrideSignal = byAccountOverride.get(deal.account_id) ?? false;
    let row = computeDecisionScore(deal, account, { accountOverrideSignal });
    if (strategyProfile) {
      row = applyLearnedPriorityBoost(row, deal, strategyProfile);
    }
    rows.push(row);
  }

  rows.sort((a, b) => b.priority_index - a.priority_index);
  const filtered = onlyRecommended ? rows.filter((r) => r.debate_recommended) : rows;
  return filtered.slice(0, limit);
}
