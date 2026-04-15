/**
 * Thin wrappers for Discord Sales OS — no duplicated business rules.
 */
import path from 'node:path';
import { SessionManager } from '../../engines/session-manager.js';
import { config } from '../../config.js';
import { defaultWorldPath, getDeal, getAccount } from '../world/fileWorldStore.js';
import type { SalesWorldFile } from '../world/types.js';
import {
  defaultDossierSourceFromEnv,
  resolveRankingWorld,
  resolveScopedWorld,
} from '../world/worldDossierResolution.js';
import { buildDossierPack } from '../pairDebate/dossierBuilder.js';
import { runPairDebate } from '../pairDebate/pairDebateOrchestrator.js';
import { runSingleDecisionModel } from '../pairDebate/singleDecision.js';
import { renderComparisonMarkdown } from '../pairDebate/comparisonMarkdown.js';
import { exportPairDebateRun } from '../pairDebate/exportRun.js';
import { rankDealsForDebate } from '../decisionEngine/index.js';
import type { DecisionScore } from '../decisionEngine/types.js';
import type { DossierScope } from '../world/types.js';
import type { FinalDebateSynthesis, PairDebateRunResult } from '../pairDebate/types.js';
import { appendOutcome } from '../pairDebate/outcomes.js';
import type { PairDebateOutcomeRecord } from '../pairDebate/types.js';

export function loadWorld(): SalesWorldFile {
  const src = defaultDossierSourceFromEnv();
  return resolveRankingWorld({ source: src }).world;
}

export function defaultWorldLabel(): string {
  return defaultWorldPath();
}

export async function getRankedDecisions(limit: number): Promise<DecisionScore[]> {
  const world = loadWorld();
  return rankDealsForDebate(world, { limit, onlyRecommended: true });
}

export async function getRankedDecisionsAll(limit: number): Promise<DecisionScore[]> {
  const world = loadWorld();
  return rankDealsForDebate(world, { limit, onlyRecommended: false });
}

export function resolveDealScope(dealId: string): DossierScope {
  return { kind: 'deal', id: dealId };
}

export async function runPairDebateForDeal(dealId: string): Promise<PairDebateRunResult> {
  const src = defaultDossierSourceFromEnv();
  const scope = resolveDealScope(dealId);
  const { world } = resolveScopedWorld({ source: src, scope });
  const dossier = buildDossierPack(world, scope);
  const sessions = new SessionManager();
  try {
    return await runPairDebate({ dossier, sessions });
  } finally {
    await sessions.destroyAll();
  }
}

export async function runCompareOnline(dealId: string): Promise<{
  markdown: string;
  pairRunId: string;
  totalCostUsd: number;
  scopeLabel: string;
  singleSynthesis: FinalDebateSynthesis;
  pairSynthesis: FinalDebateSynthesis;
}> {
  const src = defaultDossierSourceFromEnv();
  const scope = resolveDealScope(dealId);
  const { world } = resolveScopedWorld({ source: src, scope });
  const dossier = buildDossierPack(world, scope);
  const sessions = new SessionManager();
  try {
    const singleR = await runSingleDecisionModel({ dossier, sessions });
    const pairR = await runPairDebate({ dossier, sessions });
    const md = renderComparisonMarkdown({
      scopeLabel: dossier.scope_label,
      single: singleR.synthesis,
      pair: pairR.synthesis,
      singleCostUsd: singleR.cost_usd,
      singleTokens: singleR.tokens,
      pairCostUsd: pairR.total_cost_usd,
      pairTokens: pairR.total_tokens,
      pairRunId: pairR.run_id,
    });
    return {
      markdown: md,
      pairRunId: pairR.run_id,
      totalCostUsd: singleR.cost_usd + pairR.total_cost_usd,
      scopeLabel: dossier.scope_label,
      singleSynthesis: singleR.synthesis,
      pairSynthesis: pairR.synthesis,
    };
  } finally {
    await sessions.destroyAll();
  }
}

export async function exportRunToState(result: PairDebateRunResult): Promise<string> {
  const outDir = path.join(config.runtime.stateDir, 'discord-exports', result.run_id);
  await exportPairDebateRun(outDir, result);
  return outDir;
}

export function formatDealSummary(dealId: string): { title: string; description: string } | null {
  const src = defaultDossierSourceFromEnv();
  const { world } = resolveScopedWorld({ source: src, scope: { kind: 'deal', id: dealId } });
  const deal = getDeal(world, dealId);
  if (!deal) return null;
  const acct = getAccount(world, deal.account_id);
  const v =
    deal.value_cents != null
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency || 'USD' }).format(
          deal.value_cents / 100
        )
      : 'unknown';
  const lines = [
    `**Stage:** ${deal.stage}`,
    `**Value:** ${v}`,
    `**Account:** ${acct?.name ?? deal.account_id}`,
    deal.last_touch_days_ago != null ? `**Staleness:** ${deal.last_touch_days_ago}d` : '',
    deal.objections_raised?.length ? `**Objections:** ${deal.objections_raised.join('; ')}` : '',
  ].filter(Boolean);
  return {
    title: deal.name ?? dealId,
    description: lines.join('\n'),
  };
}

export async function logPairDebateOutcome(row: PairDebateOutcomeRecord): Promise<string> {
  return appendOutcome(row);
}
