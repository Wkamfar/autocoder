import path from 'node:path';
import { loadOutcomes } from '../../sales/pairDebate/outcomes.js';
import { loadSalesWorld, defaultWorldPath } from '../../sales/world/fileWorldStore.js';
import type { SalesWorldFile } from '../../sales/world/types.js';
import {
  takeDossierSourceFromArgv,
  resolveRankingWorld,
} from '../../sales/world/worldDossierResolution.js';
import {
  extractStrategyProfile,
  saveStrategyProfile,
  defaultStrategyProfilePath,
  STRATEGY_PROFILE_SCHEMA_VERSION,
} from '../../sales/intelligence/index.js';

function parseArgv(argv: string[]): { world?: string; out?: string; json: boolean; company?: string } {
  let world: string | undefined;
  let out: string | undefined;
  let json = false;
  let company: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--world') world = argv[++i];
    else if (a === '--out' || a === '-o') out = argv[++i];
    else if (a === '--json') json = true;
    else if (a === '--company') company = argv[++i];
  }
  return { world, out, json, company };
}

export async function runStrategyExtractCli(argv: string[]): Promise<void> {
  const { source, argv: rest } = takeDossierSourceFromArgv(argv);
  const p = parseArgv(rest);
  const outcomes = await loadOutcomes(50_000);
  let world: SalesWorldFile | undefined;
  if (p.world) {
    world = loadSalesWorld(path.resolve(p.world));
  } else if (source === 'crm') {
    world = resolveRankingWorld({ source: 'crm' }).world;
  } else if (source === 'world') {
    world = loadSalesWorld();
  }
  const company_id = p.company ?? process.env.SALES_COMPANY_ID;

  const profile = extractStrategyProfile({
    outcomes,
    world,
    company_id: company_id?.trim() || undefined,
  });

  const outPath = path.resolve(p.out ?? defaultStrategyProfilePath());
  saveStrategyProfile(profile);

  if (p.json) {
    console.log(JSON.stringify({ schema_version: STRATEGY_PROFILE_SCHEMA_VERSION, path: outPath, profile }, null, 2));
  } else {
    console.log(`Wrote SalesStrategyProfile → ${outPath}`);
    console.log(`  outcomes used: ${profile.extraction.outcome_rows_used} (tagged rows: ${profile.extraction.outcome_rows_with_tags})`);
    console.log(`  patterns: ${profile.strong_patterns.length}  segment tunings: ${profile.segment_priority_tunings.length}`);
    if (profile.extraction.warnings.length) {
      console.log(`  warnings: ${profile.extraction.warnings.join(' | ')}`);
    }
  }
}

export function strategyExtractUsage(): string {
  return [
    'nightshift sales strategy-extract [--world <sales-world.json>] [--out path] [--company id] [--json]',
    '  Reads pair-debate-outcomes + optional world; writes sales-strategy-profile JSON.',
    '  Without --world: use --source crm for live SQLite, or --source world for default JSON.',
    `  Default out: ${defaultStrategyProfilePath()} (override with SALES_STRATEGY_PROFILE_PATH)`,
  ].join('\n');
}
