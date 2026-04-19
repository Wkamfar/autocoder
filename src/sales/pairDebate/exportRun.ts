import fs from 'node:fs/promises';
import path from 'node:path';
import type { PairDebateRunResult } from './types.js';

export function renderHumanMemo(result: PairDebateRunResult): string {
  const s = result.synthesis;
  const lines: string[] = [];
  lines.push(`# Pair Debate — ${result.dossier.scope_label}`);
  lines.push('');
  lines.push(`Run id: \`${result.run_id}\``);
  lines.push('');
  lines.push('## Agreement');
  for (const a of s.agreement) lines.push(`- ${a}`);
  lines.push('');
  lines.push('## Remaining disagreements');
  for (const d of s.remaining_disagreements) {
    lines.push(typeof d === 'string' ? `- ${d}` : `- **${d.topic}**`);
  }
  lines.push('');
  lines.push('## Recommended next step');
  lines.push(s.recommended_single_next_step);
  lines.push('');
  lines.push('## Why now');
  lines.push(s.why_now);
  lines.push('');
  lines.push('## What could go wrong');
  for (const w of s.what_could_go_wrong) lines.push(`- ${w}`);
  lines.push('');
  if (s.what_would_change_the_recommendation?.length) {
    lines.push('## What would change this');
    for (const w of s.what_would_change_the_recommendation) lines.push(`- ${w}`);
    lines.push('');
  }
  lines.push(`human_decision_required: **${s.human_decision_required}**`);
  if (s.confidence) lines.push(`confidence: ${s.confidence}`);
  return lines.join('\n');
}

export async function exportPairDebateRun(
  outDir: string,
  result: PairDebateRunResult
): Promise<{ synthesisJson: string; memoMd: string; draftTxt: string }> {
  await fs.mkdir(outDir, { recursive: true });
  const base = `pair-debate-${result.run_id}`;
  const synthesisJson = path.join(outDir, `${base}-synthesis.json`);
  const memoMd = path.join(outDir, `${base}-memo.md`);
  const draftTxt = path.join(outDir, `${base}-draft-email.txt`);
  const fullJson = path.join(outDir, `${base}-full.json`);

  const synthesisPayload = {
    run_id: result.run_id,
    dossier_scope: result.dossier.scope_label,
    synthesis: result.synthesis,
    logPath: result.logPath,
    total_tokens: result.total_tokens,
    total_cost_usd: result.total_cost_usd,
  };

  await fs.writeFile(synthesisJson, JSON.stringify(synthesisPayload, null, 2), 'utf8');
  await fs.writeFile(memoMd, renderHumanMemo(result), 'utf8');
  await fs.writeFile(
    draftTxt,
    result.synthesis.draft_artifact?.content ?? '',
    'utf8'
  );
  await fs.writeFile(
    fullJson,
    JSON.stringify(
      {
        run_id: result.run_id,
        dossier: result.dossier,
        turns: result.turns,
        final_blackboard: result.final_blackboard,
        synthesis: result.synthesis,
        logPath: result.logPath,
        total_tokens: result.total_tokens,
        total_cost_usd: result.total_cost_usd,
      },
      null,
      2
    ),
    'utf8'
  );

  return { synthesisJson, memoMd, draftTxt };
}
