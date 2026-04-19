import path from 'node:path';
import { SessionManager } from '../../engines/session-manager.js';
import { defaultWorldPath } from '../../sales/world/fileWorldStore.js';
import {
  takeDossierSourceFromArgv,
  resolveScopedWorld,
} from '../../sales/world/worldDossierResolution.js';
import { buildDossierPack } from '../../sales/pairDebate/dossierBuilder.js';
import { runSingleDecisionModel } from '../../sales/pairDebate/singleDecision.js';
import type { EngineName } from '../../types.js';
import type { DossierScope } from '../../sales/world/types.js';

function parseArgv(argv: string[]): {
  world?: string;
  deal?: string;
  account?: string;
  contact?: string;
  engine?: EngineName;
} {
  const out: ReturnType<typeof parseArgv> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--world' || a === '--json') out.world = argv[++i];
    else if (a === '--deal') out.deal = argv[++i];
    else if (a === '--account') out.account = argv[++i];
    else if (a === '--contact') out.contact = argv[++i];
    else if (a === '--engine') out.engine = argv[++i] as EngineName;
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

export async function runSingleDecisionCli(argv: string[]): Promise<void> {
  const { source, argv: rest } = takeDossierSourceFromArgv(argv);
  const parsed = parseArgv(rest);
  const scope = resolveScope(parsed);
  const worldPath = parsed.world ? path.resolve(parsed.world) : undefined;
  const { world } = resolveScopedWorld({ source, worldPath, scope });
  const dossier = buildDossierPack(world, scope);

  const sessions = new SessionManager();
  try {
    const r = await runSingleDecisionModel({
      dossier,
      sessions,
      engine: parsed.engine,
    });
    console.log(JSON.stringify(r.synthesis, null, 2));
    console.error(`tokens=${r.tokens} cost_usd≈${r.cost_usd.toFixed(4)}`);
  } finally {
    await sessions.destroyAll();
  }
}

export function singleDecisionUsage(): string {
  return [
    'nightshift sales single-decision --deal <id>   (baseline single-model; compare to pair-debate)',
    `Data: ${defaultWorldPath()} or SALES_WORLD_JSON; or CRM via --source crm / auto`,
    'Optional: --source crm|world|auto  --engine claude|codex|...',
  ].join('\n');
}
