import type { SalesStrategyProfile } from './types.js';
import { dealValueBucketUsd, normalizeStage } from './valueBuckets.js';

/**
 * Short block appended to Closer system prompt — cites n and stays interpretable.
 */
export function formatAdaptiveCloserHints(
  profile: SalesStrategyProfile | null | undefined,
  ctx: { deal_stage?: string; deal_value_usd?: number }
): string {
  if (!profile) return '';

  const lines: string[] = [];
  lines.push('## Company strategy profile (Phase 5 — learned, interpretable)');
  if (profile.tone) lines.push(`- **Tone bias:** ${profile.tone}`);
  if (profile.best_followup_type) {
    lines.push(`- **Often-winning motion label (from logged wins):** ${profile.best_followup_type}`);
  }
  if (profile.avoid.length) {
    lines.push(`- **Frequent human overrides / caution:** ${profile.avoid.slice(0, 8).join('; ')}`);
  }

  const stage = ctx.deal_stage ?? 'unknown';
  const bucket =
    ctx.deal_value_usd != null && Number.isFinite(ctx.deal_value_usd)
      ? dealValueBucketUsd(ctx.deal_value_usd)
      : 'unknown';
  const sk = `stage:${normalizeStage(stage)}|bucket:${bucket}`;
  const hint = profile.segment_hints.find((h) => h.segment_key === sk);
  if (hint) {
    lines.push(`- **This segment (${sk}):**`);
    for (const b of hint.bias_bullets.slice(0, 5)) lines.push(`  - ${b}`);
  }

  const top = profile.strong_patterns[0];
  if (top) {
    const clip = top.interpretation.length > 360 ? `${top.interpretation.slice(0, 360)}…` : top.interpretation;
    lines.push(`- **Strongest tagged pattern:** ${clip}`);
  }

  if (profile.extraction.warnings.length) {
    lines.push(`- **Data warnings:** ${profile.extraction.warnings.join(' | ')}`);
  }

  lines.push(
    '_Bias toward these signals when consistent with the dossier — do not invent facts or guarantees._'
  );
  return lines.join('\n');
}
