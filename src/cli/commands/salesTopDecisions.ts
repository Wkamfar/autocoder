import path from 'node:path';
import { config } from '../../config.js';
import { defaultWorldPath } from '../../sales/world/fileWorldStore.js';
import {
  takeDossierSourceFromArgv,
  resolveRankingWorld,
} from '../../sales/world/worldDossierResolution.js';
import {
  rankDealsForDebate,
  DECISION_SCORE_SCHEMA_VERSION,
} from '../../sales/decisionEngine/index.js';
import type { DecisionScore } from '../../sales/decisionEngine/types.js';

function parseArgv(argv: string[]): {
  world?: string;
  limit: number;
  json: boolean;
  all: boolean;
} {
  let limit = 20;
  let json = false;
  let all = false;
  let world: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--world' || a === '--json-file') world = argv[++i];
    else if (a === '--limit') limit = Math.max(1, Number(argv[++i]) || 20);
    else if (a === '--json') json = true;
    else if (a === '--all') all = true;
  }
  return { world, limit, json, all };
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function renderHumanUx(rows: DecisionScore[]): string {
  const lines: string[] = [];
  lines.push('Pair Debate — top decisions today (advisory only · no auto-run)');
  lines.push('═'.repeat(58));
  if (rows.length === 0) {
    lines.push('');
    lines.push('No deals match the current recommendation filters.');
    lines.push('Try: lower DECISION_MIN_PRIORITY_INDEX, set DECISION_TRIGGER_MIN_DEAL_USD=0,');
    lines.push('or pass --all to list scored deals even when not recommended.');
    lines.push('');
    return lines.join('\n');
  }

  rows.forEach((r, i) => {
    const label = r.deal_name ?? r.deal_id;
    const acct = r.account_name ? `${r.account_name} · ` : '';
    lines.push('');
    lines.push(`${i + 1}. ${acct}${label}`);
    lines.push(
      `   ${formatUsd(r.deal_value)} · stalled ${r.staleness}d · stage ${r.stage_risk}`
    );
    lines.push(
      `   priority ${r.priority_index}/100 · uncertainty ${r.uncertainty.toFixed(2)} · impact ${r.expected_impact.toFixed(2)}`
    );
    if (r.learned_priority_boost != null && r.learned_priority_boost > 0) {
      lines.push(`   Phase 5 boost: +${r.learned_priority_boost} (${r.learned_priority_basis ?? 'see sales-strategy-profile'})`);
    }
    lines.push(`   triggers: ${r.trigger_reasons.join(' · ') || '(none)'}`);
    lines.push(`   → nightshift sales pair-debate --deal ${r.deal_id}`);
  });

  lines.push('');
  lines.push('—'.repeat(58));
  lines.push('Tune triggers via DECISION_* env vars (see docs/sales-decision-engine.md).');
  lines.push('');
  return lines.join('\n');
}

export async function runTopDecisionsCli(argv: string[]): Promise<void> {
  const { source, argv: rest } = takeDossierSourceFromArgv(argv);
  const p = parseArgv(rest);
  const worldPath = p.world ? path.resolve(p.world) : undefined;
  const { world, provenance, source_used } = resolveRankingWorld({ source, worldPath });

  const rows = await rankDealsForDebate(world, {
    limit: p.limit,
    onlyRecommended: !p.all,
  });

  if (p.json) {
    const payload = {
      schema_version: DECISION_SCORE_SCHEMA_VERSION,
      world_path: worldPath ?? defaultWorldPath(),
      dossier_provenance: provenance,
      dossier_source_effective: source_used,
      generated_at: new Date().toISOString(),
      config_snapshot: {
        triggerMinDealValueUsd: config.decisionEngine.triggerMinDealValueUsd,
        triggerStallDays: config.decisionEngine.triggerStallDays,
        minPriorityIndex: config.decisionEngine.minPriorityIndex,
        debateMinTriggers: config.decisionEngine.debateMinTriggers,
      },
      decisions: rows,
    };
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  process.stdout.write(renderHumanUx(rows));
}

export function topDecisionsUsage(): string {
  return [
    'nightshift sales top-decisions [--world <path>] [--limit N] [--json] [--all]',
    '  Ranks open deals by DecisionScore + trigger rules (Phase 3). Advisory only.',
    '  --all  include deals scored but not debate_recommended',
    '  --source crm|world|auto  data layer (default: SALES_DOSSIER_SOURCE or auto). crm = live SQLite.',
    `  World file (when source is world, or auto): ${defaultWorldPath()} or SALES_WORLD_JSON`,
  ].join('\n');
}
