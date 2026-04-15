import fs from 'node:fs';
import path from 'node:path';
import { SessionManager } from '../../engines/session-manager.js';
import { loadSalesWorld, defaultWorldPath } from '../../sales/world/fileWorldStore.js';
import { buildDossierPack } from '../../sales/pairDebate/dossierBuilder.js';
import { runSingleDecisionModel } from '../../sales/pairDebate/singleDecision.js';
import { runPairDebate } from '../../sales/pairDebate/pairDebateOrchestrator.js';
import { renderComparisonMarkdown } from '../../sales/pairDebate/comparisonMarkdown.js';
import type { DossierScope } from '../../sales/world/types.js';
import type { FinalDebateSynthesis } from '../../sales/pairDebate/types.js';
import type { EngineName } from '../../types.js';

function parseArgv(argv: string[]): {
  world?: string;
  deal?: string;
  account?: string;
  contact?: string;
  singleJson?: string;
  pairJson?: string;
  out?: string;
  rounds?: number;
  engineCloser?: EngineName;
  engineBuyer?: EngineName;
} {
  const out: ReturnType<typeof parseArgv> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--world' || a === '--json') out.world = argv[++i];
    else if (a === '--deal') out.deal = argv[++i];
    else if (a === '--account') out.account = argv[++i];
    else if (a === '--contact') out.contact = argv[++i];
    else if (a === '--single-json') out.singleJson = argv[++i];
    else if (a === '--pair-json') out.pairJson = argv[++i];
    else if (a === '--out' || a === '-o') out.out = argv[++i];
    else if (a === '--rounds') out.rounds = Number(argv[++i]);
    else if (a === '--engine-closer') out.engineCloser = argv[++i] as EngineName;
    else if (a === '--engine-buyer') out.engineBuyer = argv[++i] as EngineName;
  }
  return out;
}

function resolveScope(p: ReturnType<typeof parseArgv>): DossierScope {
  const n = [p.deal, p.account, p.contact].filter(Boolean).length;
  if (n !== 1) {
    throw new Error('Specify exactly one of --deal <id> | --account <id> | --contact <id>');
  }
  if (p.deal) return { kind: 'deal', id: p.deal };
  if (p.account) return { kind: 'account', id: p.account };
  return { kind: 'contact', id: p.contact! };
}

function loadSynthesisAndMeta(filePath: string): {
  synthesis: FinalDebateSynthesis;
  dossier_scope?: string;
} {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8');
  const j = JSON.parse(raw) as {
    synthesis?: FinalDebateSynthesis;
    dossier_scope?: string;
  } & Partial<FinalDebateSynthesis>;
  if (j.synthesis && typeof j.synthesis.recommended_single_next_step === 'string') {
    return { synthesis: j.synthesis, dossier_scope: j.dossier_scope };
  }
  if (typeof j.recommended_single_next_step === 'string') {
    return { synthesis: j as FinalDebateSynthesis, dossier_scope: j.dossier_scope };
  }
  throw new Error(
    `Could not parse synthesis from ${filePath} (expected export *-synthesis.json or raw synthesis JSON)`
  );
}

export async function runCompareDecisionsCli(argv: string[]): Promise<void> {
  const parsed = parseArgv(argv);

  if (parsed.singleJson && parsed.pairJson) {
    const A = loadSynthesisAndMeta(parsed.singleJson);
    const B = loadSynthesisAndMeta(parsed.pairJson);
    const scope = B.dossier_scope || A.dossier_scope || 'comparison (offline)';
    const md = renderComparisonMarkdown({
      scopeLabel: String(scope),
      single: A.synthesis,
      pair: B.synthesis,
    });
    const outPath = path.resolve(parsed.out ?? 'comparison.md');
    fs.writeFileSync(outPath, md, 'utf8');
    console.log(`Wrote ${outPath}`);
    return;
  }

  const hasScope = parsed.deal || parsed.account || parsed.contact;
  if (!hasScope) {
    console.error('usage:');
    console.error('  Offline (no LLM):');
    console.error(
      '    nightshift sales compare-decisions --single-json <synthesis.json> --pair-json <synthesis.json> [--out comparison.md]'
    );
    console.error('  Online (runs TWO LLM pipelines — high cost/latency):');
    console.error(
      '    nightshift sales compare-decisions --deal <id> [--world ...] [--out comparison.md] [--rounds N] ...'
    );
    process.exit(2);
  }

  console.error('');
  console.error('*** WARNING: compare-decisions (online) runs TWO full LLM pipelines:');
  console.error('    1) single-decision model');
  console.error('    2) pair debate (Closer + BuyerMind + synthesis)');
  console.error('    Expect roughly 2x token usage vs pair-debate alone, and multi-minute latency.');
  console.error('');

  const world = loadSalesWorld(parsed.world);
  const scope = resolveScope(parsed);
  const dossier = buildDossierPack(world, scope);

  const sessions = new SessionManager();
  try {
    const singleR = await runSingleDecisionModel({ dossier, sessions });
    const pairR = await runPairDebate({
      dossier,
      sessions,
      options: {
        maxRounds: parsed.rounds,
        closerEngine: parsed.engineCloser,
        buyerEngine: parsed.engineBuyer,
      },
    });

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

    const outPath = path.resolve(parsed.out ?? 'comparison.md');
    fs.writeFileSync(outPath, md, 'utf8');
    console.log(`Wrote ${outPath}`);
    console.error(
      `Approx total cost (single + pair): $${(singleR.cost_usd + pairR.total_cost_usd).toFixed(4)}`
    );
  } finally {
    await sessions.destroyAll();
  }
}

export function compareDecisionsUsage(): string {
  return [
    'Offline: nightshift sales compare-decisions --single-json <path> --pair-json <path> [-o comparison.md]',
    `Online:  nightshift sales compare-decisions --deal <id> [-o comparison.md]  (see stderr cost warning)`,
    `World: ${defaultWorldPath()} or SALES_WORLD_JSON`,
  ].join('\n');
}
