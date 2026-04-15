import path from 'node:path';
import { SessionManager } from '../../engines/session-manager.js';
import { defaultWorldPath } from '../../sales/world/fileWorldStore.js';
import {
  takeDossierSourceFromArgv,
  resolveScopedWorld,
} from '../../sales/world/worldDossierResolution.js';
import { buildDossierPack } from '../../sales/pairDebate/dossierBuilder.js';
import { runPairDebate } from '../../sales/pairDebate/pairDebateOrchestrator.js';
import { exportPairDebateRun } from '../../sales/pairDebate/exportRun.js';
import type { EngineName } from '../../types.js';
import type { DossierScope } from '../../sales/world/types.js';

function parseArgv(argv: string[]): {
  world?: string;
  deal?: string;
  account?: string;
  contact?: string;
  rounds?: number;
  engineCloser?: EngineName;
  engineBuyer?: EngineName;
  exportDir?: string;
} {
  const out: ReturnType<typeof parseArgv> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--world' || a === '--json') out.world = argv[++i];
    else if (a === '--deal') out.deal = argv[++i];
    else if (a === '--account') out.account = argv[++i];
    else if (a === '--contact') out.contact = argv[++i];
    else if (a === '--rounds') out.rounds = Number(argv[++i]);
    else if (a === '--engine-closer') out.engineCloser = argv[++i] as EngineName;
    else if (a === '--engine-buyer') out.engineBuyer = argv[++i] as EngineName;
    else if (a === '--export') out.exportDir = argv[++i];
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

export async function runPairDebateCli(argv: string[]): Promise<void> {
  const { source, argv: rest } = takeDossierSourceFromArgv(argv);
  const parsed = parseArgv(rest);
  const scope = resolveScope(parsed);
  const worldPath = parsed.world ? path.resolve(parsed.world) : undefined;
  const { world, provenance, source_used } = resolveScopedWorld({ source, worldPath, scope });
  if (process.env.SALES_LOG_DOSSIER_PROVENANCE === '1') {
    console.error(`[sales] dossier provenance=${provenance} source_effective=${source_used}`);
  }
  const dossier = buildDossierPack(world, scope);

  const sessions = new SessionManager();
  try {
    const result = await runPairDebate({
      dossier,
      sessions,
      options: {
        maxRounds: parsed.rounds,
        closerEngine: parsed.engineCloser,
        buyerEngine: parsed.engineBuyer,
      },
    });

    if (parsed.exportDir) {
      const out = path.resolve(parsed.exportDir);
      const files = await exportPairDebateRun(out, result);
      console.log('');
      console.log('Exported:');
      console.log(`  ${files.synthesisJson}`);
      console.log(`  ${files.memoMd}`);
      console.log(`  ${files.draftTxt}`);
      console.log(`  ${path.join(out, `pair-debate-${result.run_id}-full.json`)}`);
      console.log('');
    }

    console.log('');
    console.log(`=== Pair Debate: ${result.dossier.scope_label} ===`);
    console.log('');
    console.log('--- Dossier summary (timing) ---');
    console.log(
      `decision_deadline: ${result.dossier.timing.decision_deadline ?? 'null'} | sensitivity: ${result.dossier.timing.timing_sensitivity}`
    );
    console.log('');
    console.log('--- Transcript (condensed) ---');
    for (const t of result.turns) {
      console.log(`\n### Round ${t.round} — ${t.role}\n`);
      console.log(t.raw_response.slice(0, 4000));
      if (t.raw_response.length > 4000) console.log('…(truncated)');
    }
    console.log('');
    console.log('--- Final blackboard (JSON) ---');
    console.log(JSON.stringify(result.final_blackboard, null, 2));
    console.log('');
    console.log('--- Synthesis ---');
    console.log(JSON.stringify(result.synthesis, null, 2));
    console.log('');
    console.log(
      `run_id: ${result.run_id} | Run log: ${result.logPath} | tokens=${result.total_tokens} cost_usd≈${result.total_cost_usd.toFixed(4)}`
    );
    console.log('');
    console.log('--- Human memo ---');
    console.log(`Recommended next step: ${result.synthesis.recommended_single_next_step}`);
    console.log(`Why now: ${result.synthesis.why_now}`);
    if (result.synthesis.draft_artifact?.content) {
      console.log('');
      console.log('Draft:');
      console.log(result.synthesis.draft_artifact.content);
    }
  } finally {
    await sessions.destroyAll();
  }
}

export function pairDebateUsage(): string {
  return [
    'nightshift sales pair-debate --deal <id>',
    'nightshift sales pair-debate --account <id>',
    'nightshift sales pair-debate --contact <id>',
    '',
    `Data: JSON world file (default ${defaultWorldPath()} or SALES_WORLD_JSON), or live CRM (--source crm / auto).`,
    'Optional: --source crm|world|auto  --world <path>  --rounds <n>  --engine-closer claude|codex|...  --engine-buyer ...',
    'Export: --export <dir>  writes synthesis JSON, memo.md, draft-email.txt, full.json',
  ].join('\n');
}
