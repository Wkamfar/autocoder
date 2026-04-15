import { config } from '../../config.js';
import type { PairDebateOutcomeRecord } from '../pairDebate/types.js';
import type { HistoricalPattern } from '../pairDebate/types.js';
import type { SalesWorldFile } from '../world/types.js';
import { applyPatternStrength } from '../pairDebate/patternRecall.js';
import { dealValueBucketUsd, normalizeStage } from './valueBuckets.js';
import type {
  LearnedStrategyPattern,
  SalesStrategyProfile,
  SegmentPriorityTuning,
  SegmentStrategyHint,
  StrategySegment,
} from './types.js';

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase().slice(0, 48) || 'x';
}

function positiveSignal(o: PairDebateOutcomeRecord): boolean {
  return o.outcome === 'replied_positive' || o.outcome === 'replied_neutral';
}

function outcomeKnown(o: PairDebateOutcomeRecord): boolean {
  return o.outcome != null && o.outcome !== 'unknown';
}

function motionLabel(o: PairDebateOutcomeRecord): string {
  return (o.email_type || o.debate_decision || 'unspecified').slice(0, 120);
}

interface Agg {
  n: number;
  wins: number;
  known: number;
  actions: Map<string, number>;
}

function emptyAgg(): Agg {
  return { n: 0, wins: 0, known: 0, actions: new Map() };
}

function feedAgg(g: Agg, o: PairDebateOutcomeRecord): void {
  g.n += 1;
  if (outcomeKnown(o)) {
    g.known += 1;
    if (positiveSignal(o)) g.wins += 1;
  }
  const m = motionLabel(o);
  g.actions.set(m, (g.actions.get(m) ?? 0) + 1);
}

function dominantAction(g: Agg): string {
  let best = '';
  let c = 0;
  for (const [k, v] of g.actions) {
    if (v > c) {
      c = v;
      best = k;
    }
  }
  return best || 'unspecified';
}

function dealMeta(
  o: PairDebateOutcomeRecord,
  world?: SalesWorldFile
): { stage: string; bucket: StrategySegment['deal_value_bucket'] } {
  if (!o.deal_id || !world) return { stage: 'unknown', bucket: 'unknown' };
  const deal = world.deals.find((d) => d.id === o.deal_id);
  if (!deal) return { stage: 'unknown', bucket: 'unknown' };
  const usd = deal.value_cents != null ? deal.value_cents / 100 : 0;
  return { stage: deal.stage, bucket: dealValueBucketUsd(usd) };
}

function strengthForN(n: number): 'strong' | 'anecdotal' {
  const min = config.pairDebate.patternMinSample;
  return n >= min ? 'strong' : 'anecdotal';
}

function boostFromRate(rate: number, n: number): number {
  if (n < config.pairDebate.patternMinSample) return 0;
  const raw = Math.round((rate - 0.45) * 35);
  return Math.max(0, Math.min(15, raw));
}

/**
 * Derive a `SalesStrategyProfile` from local outcome rows. Purely interpretable:
 * frequencies, rates, and explicit small-n warnings — no hidden model.
 */
export function extractStrategyProfile(input: {
  outcomes: PairDebateOutcomeRecord[];
  world?: SalesWorldFile;
  company_id?: string;
}): SalesStrategyProfile {
  const minFloor = config.pairDebate.patternMinSample;
  const outcomes = input.outcomes;
  const warnings: string[] = [];

  if (outcomes.length < 5) {
    warnings.push('Very few outcome rows — treat all patterns as exploratory.');
  }

  const byTag = new Map<string, Agg>();
  const byStageBucket = new Map<string, Agg & { stage: string; bucket: NonNullable<StrategySegment['deal_value_bucket']> }>();

  let rowsWithTags = 0;
  for (const o of outcomes) {
    const { stage, bucket } = dealMeta(o, input.world);
    const tags = o.scenario_tags?.length ? o.scenario_tags : [];
    if (tags.length) rowsWithTags += 1;

    const tagList = tags.length ? tags : ['__untagged__'];

    for (const tag of tagList) {
      const k = tag;
      let g = byTag.get(k);
      if (!g) {
        g = emptyAgg();
        byTag.set(k, g);
      }
      feedAgg(g, o);
    }

    const sbKey = `stage:${normalizeStage(stage)}|bucket:${bucket}`;
    let sg = byStageBucket.get(sbKey);
    if (!sg) {
      sg = {
        ...emptyAgg(),
        stage,
        bucket: bucket ?? 'unknown',
      };
      byStageBucket.set(sbKey, sg);
    }
    feedAgg(sg, o);
  }

  if (rowsWithTags === 0 && outcomes.length > 0) {
    warnings.push('No scenario_tags on outcomes — tag rows in pair-debate-outcome for better extraction.');
  }

  const strong_patterns: LearnedStrategyPattern[] = [];
  for (const [tag, g] of byTag) {
    if (tag === '__untagged__' && g.n === 0) continue;
    const rate = g.known ? g.wins / g.known : undefined;
    const dom = dominantAction(g);
    const strength = strengthForN(g.n);
    const id = `lp_tag_${slug(tag)}`;
    const label =
      tag === '__untagged__' ? 'Untagged outcomes' : `Tag: ${tag}`;
    const interpretation =
      rate != null && g.known
        ? `For outcomes tagged "${tag === '__untagged__' ? '(none)' : tag}", ${g.known} had a known buyer signal; ${(rate * 100).toFixed(0)}% were positive/neutral (n=${g.n} rows). Dominant motion label: ${dom}.`
        : `For outcomes tagged "${tag === '__untagged__' ? '(none)' : tag}", n=${g.n} rows. Dominant motion label: ${dom}.`;

    strong_patterns.push({
      id,
      label,
      scenario_key: tag,
      sample_size: g.n,
      positive_signal_rate: rate,
      known_outcomes: g.known,
      dominant_followup: dom,
      strength,
      interpretation,
    });
  }

  strong_patterns.sort((a, b) => b.sample_size - a.sample_size);

  const segment_hints: SegmentStrategyHint[] = [];
  const segment_priority_tunings: SegmentPriorityTuning[] = [];

  for (const [key, g] of byStageBucket) {
    const rate = g.known ? g.wins / g.known : 0;
    const seg: StrategySegment = {
      stage_substring: g.stage,
      deal_value_bucket: g.bucket,
    };
    const bullets: string[] = [];
    if (g.known > 0) {
      bullets.push(
        `Positive/neutral buyer signals ≈ ${(rate * 100).toFixed(0)}% of ${g.known} known outcomes (rows=${g.n}).`
      );
    } else {
      bullets.push(`Rows=${g.n}; most outcomes missing buyer outcome — log outcomes for stronger signals.`);
    }
    bullets.push(`Common motion label: ${dominantAction(g)}.`);

    segment_hints.push({
      segment_key: key,
      segment: seg,
      bias_bullets: bullets,
      pattern_ids: [],
    });

    const boost = boostFromRate(rate, g.n);
    if (boost > 0 && g.known >= minFloor) {
      segment_priority_tunings.push({
        segment_key: key,
        segment: seg,
        priority_boost_suggestion: boost,
        basis: `Stage "${g.stage}" + bucket "${g.bucket}": observed positive-signal rate ${(rate * 100).toFixed(0)}% over ${g.known} known outcomes (n=${g.n} rows, floor=${minFloor}).`,
        sample_size: g.n,
      });
    }
  }

  segment_hints.sort((a, b) => a.segment_key.localeCompare(b.segment_key));

  /** Avoid list from override reasons */
  const avoidCounts = new Map<string, number>();
  for (const o of outcomes) {
    if (o.recommended_action_used !== false) continue;
    const r = o.human_override_reason?.trim();
    if (!r) continue;
    const k = r.slice(0, 120);
    avoidCounts.set(k, (avoidCounts.get(k) ?? 0) + 1);
  }
  const avoid = [...avoidCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([reason]) => reason);

  /** Tone + best follow-up heuristics */
  const withMod = outcomes.filter((o) => o.human_modified != null);
  let tone: string | undefined;
  if (withMod.length >= 4) {
    const heavy = withMod.filter((o) => o.human_modified === 'heavy').length / withMod.length;
    tone = heavy < 0.28 ? 'direct_low_friction' : 'consultative_pacing';
  }

  const positives = outcomes.filter((o) => positiveSignal(o) && motionLabel(o) !== 'unspecified');
  const followCounts = new Map<string, number>();
  for (const o of positives) {
    const m = motionLabel(o);
    followCounts.set(m, (followCounts.get(m) ?? 0) + 1);
  }
  let best_followup_type: string | undefined;
  let bestC = 0;
  for (const [m, c] of followCounts) {
    if (c > bestC) {
      bestC = c;
      best_followup_type = m;
    }
  }

  /** HistoricalPattern-compatible rows for dossier injection */
  const pattern_summaries: HistoricalPattern[] = strong_patterns.slice(0, 15).map((p) =>
    applyPatternStrength({
      scenario: p.label,
      best_action: p.dominant_followup ?? '(unspecified)',
      win_rate: p.positive_signal_rate,
      sample_size: p.sample_size,
      notes: `Phase 5 extraction — ${p.interpretation}`,
    })
  );

  return {
    schema_version: '1',
    company_id: input.company_id,
    updated_at: new Date().toISOString(),
    tone,
    best_followup_type,
    avoid,
    strong_patterns,
    pattern_summaries,
    segment_hints,
    segment_priority_tunings,
    extraction: {
      extracted_at: new Date().toISOString(),
      outcome_rows_used: outcomes.length,
      outcome_rows_with_tags: rowsWithTags,
      min_sample_floor: minFloor,
      warnings,
    },
  };
}
