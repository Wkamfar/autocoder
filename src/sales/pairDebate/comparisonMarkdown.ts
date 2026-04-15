import type { FinalDebateSynthesis } from './types.js';

export interface ComparisonMarkdownInput {
  scopeLabel: string;
  single: FinalDebateSynthesis;
  pair: FinalDebateSynthesis;
  singleCostUsd?: number;
  singleTokens?: number;
  pairCostUsd?: number;
  pairTokens?: number;
  pairRunId?: string;
}

export function renderComparisonMarkdown(p: ComparisonMarkdownInput): string {
  const lines: string[] = [];
  lines.push(`# Decision comparison: ${p.scopeLabel}`);
  lines.push('');
  lines.push('## Single-model baseline');
  if (p.singleTokens != null || p.singleCostUsd != null) {
    lines.push(
      `_Approx cost: $${(p.singleCostUsd ?? 0).toFixed(4)} · tokens ${p.singleTokens ?? 'n/a'}_`
    );
    lines.push('');
  }
  lines.push('### Recommended next step');
  lines.push(p.single.recommended_single_next_step || '(empty)');
  lines.push('');
  lines.push('### Why now');
  lines.push(p.single.why_now || '(empty)');
  lines.push('');
  lines.push('### Draft');
  lines.push('```');
  lines.push(p.single.draft_artifact?.content || '');
  lines.push('```');
  lines.push('');
  lines.push('### Risks');
  for (const r of p.single.what_could_go_wrong ?? []) lines.push(`- ${r}`);
  lines.push('');

  lines.push('## Pair Debate');
  if (p.pairRunId) lines.push(`_run_id: \`${p.pairRunId}\`_`);
  if (p.pairTokens != null || p.pairCostUsd != null) {
    lines.push(
      `_Approx cost: $${(p.pairCostUsd ?? 0).toFixed(4)} · tokens ${p.pairTokens ?? 'n/a'}_`
    );
  }
  lines.push('');
  lines.push('### Recommended next step');
  lines.push(p.pair.recommended_single_next_step || '(empty)');
  lines.push('');
  lines.push('### Why now');
  lines.push(p.pair.why_now || '(empty)');
  lines.push('');
  lines.push('### Agreement');
  for (const a of p.pair.agreement ?? []) lines.push(`- ${a}`);
  lines.push('');
  lines.push('### Remaining disagreements');
  for (const d of p.pair.remaining_disagreements ?? []) {
    lines.push(typeof d === 'string' ? `- ${d}` : `- **${d.topic}**`);
  }
  lines.push('');
  lines.push('### Draft');
  lines.push('```');
  lines.push(p.pair.draft_artifact?.content || '');
  lines.push('```');
  lines.push('');
  lines.push('### What could go wrong');
  for (const r of p.pair.what_could_go_wrong ?? []) lines.push(`- ${r}`);
  lines.push('');

  lines.push('## Quick diff (for review)');
  lines.push('- Single next step length vs Pair: compare sections above side-by-side.');
  lines.push('- Check whether Pair Debate surfaced tradeoffs Single flattened.');
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## Verdict (human — required for A/B review)');
  lines.push('');
  lines.push('- **Which output did you prefer?** (single-model / pair debate / neither)');
  lines.push('');
  lines.push('- **Why?**');
  lines.push('');
  lines.push('  - ');
  lines.push('');
  lines.push('- **What did Pair Debate catch that single-model missed?**');
  lines.push('');
  lines.push('  - ');
  lines.push('');
  lines.push('- **What did single-model do better (if anything)?**');
  lines.push('');
  lines.push('  - ');
  lines.push('');

  return lines.join('\n');
}
