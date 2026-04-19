import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import type { HistoricalPattern, PairDebateOutcomeRecord } from './types.js';
import { outcomesLogPath } from './outcomes.js';

function isPositiveOutcome(o: PairDebateOutcomeRecord): boolean {
  return o.outcome === 'replied_positive' || o.outcome === 'replied_neutral';
}

/** Read outcomes log synchronously (bounded tail) for dossier injection. */
function readOutcomesTail(maxLines = 5000): PairDebateOutcomeRecord[] {
  const p = outcomesLogPath();
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  const slice = lines.length > maxLines ? lines.slice(-maxLines) : lines;
  const out: PairDebateOutcomeRecord[] = [];
  for (const l of slice) {
    try {
      out.push(JSON.parse(l) as PairDebateOutcomeRecord);
    } catch {
      /* skip */
    }
  }
  return out;
}

function loadSeedPatterns(): HistoricalPattern[] {
  const env = process.env.PAIR_DEBATE_PATTERNS_SEED;
  const seedPath = env?.trim()
    ? path.resolve(env)
    : path.join(config.runtime.stateDir, 'pair-debate-patterns.seed.json');
  if (!fs.existsSync(seedPath)) return [];
  try {
    const j = JSON.parse(fs.readFileSync(seedPath, 'utf8')) as { patterns?: HistoricalPattern[] };
    return Array.isArray(j.patterns) ? j.patterns : [];
  } catch {
    return [];
  }
}

/** Label strong vs anecdotal using PAIR_DEBATE_PATTERN_MIN_N (default 3). */
export function applyPatternStrength(p: HistoricalPattern): HistoricalPattern {
  const min = config.pairDebate.patternMinSample;
  const n = p.sample_size ?? 0;
  const anecdotal = n < min;
  const pattern_strength: 'strong' | 'anecdotal' = anecdotal ? 'anecdotal' : 'strong';
  let notes = p.notes ?? '';
  if (anecdotal && n > 0) {
    notes = notes
      ? `${notes} (n=${n} < min ${min} — anecdotal, not statistical proof)`
      : `n=${n} < min ${min} — anecdotal, not statistical proof`;
  } else if (anecdotal && n === 0) {
    notes = notes ? `${notes} (sample size unknown — treat as anecdotal)` : 'sample size unknown — treat as anecdotal';
  }
  return { ...p, pattern_strength, notes: notes || undefined };
}

/**
 * Aggregate simple win rates by scenario_tags from local outcomes.
 * No ML — frequency + positive-outcome rate only.
 */
export function aggregatePatternsFromOutcomes(): HistoricalPattern[] {
  const rows = readOutcomesTail();
  const byTag = new Map<string, { wins: number; n: number; actions: Map<string, number> }>();
  for (const o of rows) {
    const tags = o.scenario_tags?.length ? o.scenario_tags : [];
    if (tags.length === 0) continue;
    for (const tag of tags) {
      let g = byTag.get(tag);
      if (!g) {
        g = { wins: 0, n: 0, actions: new Map() };
        byTag.set(tag, g);
      }
      g.n += 1;
      if (isPositiveOutcome(o)) g.wins += 1;
      const a = (o.email_type || o.debate_decision || 'unspecified').slice(0, 120);
      g.actions.set(a, (g.actions.get(a) ?? 0) + 1);
    }
  }
  const patterns: HistoricalPattern[] = [];
  for (const [scenario, g] of byTag) {
    let bestAction = '';
    let best = 0;
    for (const [act, c] of g.actions) {
      if (c > best) {
        best = c;
        bestAction = act;
      }
    }
    patterns.push(
      applyPatternStrength({
        scenario,
        best_action: bestAction || '(no action label)',
        win_rate: g.n ? g.wins / g.n : undefined,
        sample_size: g.n,
        notes: 'Aggregated from local PAIR_DEBATE_OUTCOMES log',
      })
    );
  }
  patterns.sort((a, b) => (b.sample_size ?? 0) - (a.sample_size ?? 0));
  return patterns.slice(0, 12);
}

/** Merge seed file + aggregated outcomes; dedupe by scenario label. */
export function buildHistoricalPatternsForDossier(): HistoricalPattern[] {
  const seed = loadSeedPatterns().map((p) => applyPatternStrength({ ...p }));
  const fromLog = aggregatePatternsFromOutcomes();
  const seen = new Set<string>();
  const merged: HistoricalPattern[] = [];
  for (const p of [...seed, ...fromLog]) {
    const k = p.scenario.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(p);
  }
  return merged.slice(0, 15);
}

export function appendPatternsToDossierBody(
  pack: { body: string; historical_patterns?: HistoricalPattern[] },
  patterns: HistoricalPattern[]
): void {
  if (!patterns.length) return;
  pack.historical_patterns = patterns;
  pack.body += '\n\n## Historical patterns (experience-weighted — advisory)\n\n';
  const min = config.pairDebate.patternMinSample;
  for (const p of patterns) {
    const strength =
      p.pattern_strength ?? ((p.sample_size ?? 0) >= min ? 'strong' : 'anecdotal');
    const label = strength === 'strong' ? 'Strong' : 'Anecdotal';
    let line = `- **${label}** — **${p.scenario}** → typical action: ${p.best_action} (n=${p.sample_size ?? 0}, floor=${min})`;
    if (p.win_rate != null && p.sample_size != null) {
      if (strength === 'strong') {
        line += ` — positive signal rate ≈ ${(p.win_rate * 100).toFixed(0)}%`;
      } else {
        line += ` — observed rate ≈ ${(p.win_rate * 100).toFixed(0)}% (anecdotal; do not treat as statistical proof)`;
      }
    }
    if (p.notes) line += ` _(${p.notes})_`;
    pack.body += line + '\n';
  }
}
