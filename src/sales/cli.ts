import { config } from '../config.js';
import { initSalesMode, getSalesContext } from './salesContext.js';
import { importCsvToSourcesAndProposals } from './adapters/csvImport.js';
import { ingestGmailMetadata } from './adapters/gmailMetadata.js';
import { runFirstShipFlow } from './firstShipFlow.js';
import { applyPendingPipeline } from './operations.js';
import { runPairDebateCli, pairDebateUsage } from '../cli/commands/salesPairDebate.js';
import { runSingleDecisionCli, singleDecisionUsage } from '../cli/commands/salesSingleDecision.js';
import { runPairDebateOutcomeCli } from '../cli/commands/salesOutcome.js';
import { runPairDebateEvalCli } from '../cli/commands/salesPairDebateEval.js';
import { runCompareDecisionsCli, compareDecisionsUsage } from '../cli/commands/salesCompareDecisions.js';
import { runTopDecisionsCli, topDecisionsUsage } from '../cli/commands/salesTopDecisions.js';
import { runSalesActionCli, salesActionUsage } from '../cli/commands/salesAction.js';
import { runStrategyExtractCli, strategyExtractUsage } from '../cli/commands/salesStrategyExtract.js';

/** Pair Debate / decision-engine commands — no CRM DB required. */
const ANALYTIC = new Set([
  'pair-debate',
  'single-decision',
  'pair-debate-outcome',
  'pair-debate-eval',
  'compare-decisions',
  'top-decisions',
  'sales-action',
  'strategy-extract',
]);

export async function runSalesCli(args: string[]): Promise<void> {
  const [cmd, ...rest] = args;

  if (cmd && ANALYTIC.has(cmd)) {
    if (cmd === 'pair-debate') {
      await runPairDebateCli(rest);
      return;
    }
    if (cmd === 'single-decision') {
      await runSingleDecisionCli(rest);
      return;
    }
    if (cmd === 'pair-debate-outcome') {
      await runPairDebateOutcomeCli(rest);
      return;
    }
    if (cmd === 'pair-debate-eval') {
      await runPairDebateEvalCli(rest);
      return;
    }
    if (cmd === 'compare-decisions') {
      await runCompareDecisionsCli(rest);
      return;
    }
    if (cmd === 'top-decisions') {
      await runTopDecisionsCli(rest);
      return;
    }
    if (cmd === 'sales-action') {
      await runSalesActionCli(rest);
      return;
    }
    if (cmd === 'strategy-extract') {
      await runStrategyExtractCli(rest);
      return;
    }
  }

  initSalesMode();

  if (cmd === 'import-csv') {
    const csvPath = rest[0];
    if (!csvPath) {
      console.error('usage: nightshift sales import-csv <file.csv>');
      process.exit(2);
    }
    const { repo } = getSalesContext();
    const r = importCsvToSourcesAndProposals(repo, csvPath, 'cli', false);
    console.log('CRMEntitySource count:', r.sources.length, 'mutations:', r.mutationIds.length);
    return;
  }

  if (cmd === 'import-gmail-meta') {
    const jsonPath = rest[0];
    if (!jsonPath) {
      console.error('usage: nightshift sales import-gmail-meta <messages.json>');
      process.exit(2);
    }
    const { repo } = getSalesContext();
    const rows = ingestGmailMetadata(repo, jsonPath, 'cli');
    console.log('ingested CRMEntitySource rows:', rows.length);
    return;
  }

  if (cmd === 'apply-pending') {
    const approver = rest[0] || 'cli';
    const ctx = getSalesContext();
    const r = applyPendingPipeline(ctx, approver);
    console.log('apply-pending done', r);
    return;
  }

  if (cmd === 'first-ship') {
    const csvPath = rest[0];
    if (!csvPath) {
      console.error('usage: nightshift sales first-ship <file.csv>');
      process.exit(2);
    }
    await runFirstShipFlow(getSalesContext(), {
      csvPath,
      staleDays: config.sales.staleFollowupDays,
      approver: 'cli',
    });
    console.log('first-ship flow complete');
    return;
  }

  if (cmd === 'help' || !cmd) {
    console.log(`NightShift sales — CRM (v7) + Pair Debate stack

CRM / pipeline:
  nightshift sales import-csv <file.csv>
  nightshift sales import-gmail-meta <messages.json>
  nightshift sales apply-pending [approver]
  nightshift sales first-ship <file.csv>
`);
    console.log('Pair Debate / decisions:\n');
    console.log(pairDebateUsage());
    console.log('');
    console.log(singleDecisionUsage());
    console.log('');
    console.log(compareDecisionsUsage());
    console.log('');
    console.log(topDecisionsUsage());
    console.log('');
    console.log(salesActionUsage());
    console.log('');
    console.log(strategyExtractUsage());
    console.log('');
    console.log(
      'nightshift sales pair-debate-outcome --run <run_id> [--deal ...] [--outcome ...] [--tags a,b]'
    );
    console.log('nightshift sales pair-debate-eval validate');
    console.log('nightshift sales pair-debate-eval score-synthesis <synthesis.json>');
    console.log('nightshift sales pair-debate-eval score-run <full.json>');
    return;
  }

  console.error(`unknown sales command: ${cmd}\n`);
  console.error(`CRM: import-csv | import-gmail-meta | apply-pending | first-ship`);
  console.error('');
  console.error(pairDebateUsage());
  console.error(compareDecisionsUsage());
  console.error('');
  console.error(topDecisionsUsage());
  console.error('');
  console.error(salesActionUsage());
  console.error('');
  console.error(strategyExtractUsage());
  process.exit(2);
}
