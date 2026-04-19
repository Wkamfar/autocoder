import type { FinalDebateSynthesis } from '../../sales/pairDebate/types.js';
import type { DecisionScore } from '../../sales/decisionEngine/types.js';
import type { DecisionMoment } from '../../sales/decisionEngine/decisionMomentTypes.js';
import { E, alertLines, bullets, clip } from './layout.js';

const MAX_MSG = 1900;

function header(emoji: string, title: string): string {
  return `${emoji} **${title.toUpperCase()}**`;
}

/**
 * /sales — minimal command map (ephemeral).
 */
export function formatSalesOverview(): string {
  return [
    header(E.top, 'Sales OS'),
    '`/top-decisions` · `/debate` · `/compare` · `/send` · `/outcome`',
    `${E.ready} ranked deals · debate · compare · draft · log`,
  ].join('\n');
}

/**
 * /top-decisions — HEADER, CONTEXT, numbered lines (no fluff).
 */
export function formatTopDecisionsList(
  rows: DecisionScore[],
  worldHint: string
): string {
  if (rows.length === 0) {
    return [header(E.warn, 'Nothing queued'), clip(worldHint, 120), 'Tune `DECISION_*` or use `include_non_recommended`'].join(
      '\n'
    );
  }
  const ctx = clip(worldHint, 100);
  const lines = rows.map((r, i) => {
    const name = r.deal_name ?? r.deal_id;
    const ac = r.account_name ? `${r.account_name} · ` : '';
    return `${i + 1} · ${ac}${name} · ${money(r.deal_value)} · ${r.staleness}d · ${clip(r.stage_risk, 24)} · p${r.priority_index}`;
  });
  return [header(E.top, 'Top decisions'), ctx, '', ...lines].join('\n').slice(0, MAX_MSG);
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
}

/**
 * Pair Debate thread — DECISION, WHY, seen, unresolved, draft. Buttons come after in API.
 */
export function formatPairDebateSynthesis(params: {
  dealId: string;
  runId: string;
  synthesis: FinalDebateSynthesis;
  patternNote?: string;
}): string {
  const { synthesis: s, dealId, runId, patternNote } = params;
  const decision = clip(s.recommended_single_next_step || '—', 280);

  const whyBlock = bullets([s.why_now], 3);
  const seen = bullets((s.agreement ?? []).slice(0, 3), 3);
  const unresolved = (s.remaining_disagreements ?? [])
    .slice(0, 3)
    .map((d) => (typeof d === 'string' ? d : d.topic))
    .filter(Boolean);
  const unBlock = bullets(unresolved, 3);

  const draft = (s.draft_artifact?.content ?? '').trim();

  const parts = [
    header(E.decision, 'Decision'),
    `\`${dealId}\` · \`${runId}\``,
    '',
    `${E.ready} ${decision}`,
    '',
    '**Why**',
    whyBlock || '• —',
    '',
    "**What we've seen**",
    seen || '• —',
    '',
    '**Still unresolved**',
    unBlock || '• —',
  ];

  if (patternNote?.trim()) {
    parts.push('', '**Pattern**', `• ${clip(patternNote, 200)}`);
  }

  if (draft) {
    parts.push('', '**Draft**', '```', clip(draft, 1200), '```');
  }

  return parts.join('\n').slice(0, MAX_MSG);
}

/**
 * Compare — winner, why, what baseline did better.
 */
export function formatCompareSummary(params: {
  scopeLabel: string;
  single: FinalDebateSynthesis;
  pair: FinalDebateSynthesis;
  costUsd: number;
}): string {
  const { scopeLabel, single, pair, costUsd } = params;

  const pairMoreHonest = (pair.remaining_disagreements?.length ?? 0) >= (single.remaining_disagreements?.length ?? 0);
  const winner = pairMoreHonest ? 'Pair Debate' : 'Single (simpler)';
  const why = pairMoreHonest
    ? '• Pair keeps tradeoffs visible'
    : '• Single is shorter — check Pair for risks';

  const baselineEdge =
    (single.what_could_go_wrong ?? [])[0] ||
    (single.draft_artifact?.content && single.draft_artifact.content.length < (pair.draft_artifact?.content?.length ?? 999)
      ? 'Tighter draft length'
      : 'Faster read');

  return [
    header(E.compare, 'Compare'),
    clip(scopeLabel, 120),
    '',
    `**Winner** · ${winner}`,
    '',
    '**Why**',
    why,
    '• ' + clip(pair.why_now || '—', 100),
    '',
    '**Baseline did better**',
    '• ' + clip(baselineEdge, 160),
    '',
    `_~$${costUsd.toFixed(3)} · 2 pipelines_`,
  ]
    .join('\n')
    .slice(0, MAX_MSG);
}

/** /send preview — HEADER, CONTEXT, DECISION = draft first line */
export function formatSendPreview(draft: string): string {
  const first = draft.split('\n').map((l) => l.trim()).find(Boolean) ?? '—';
  return [
    header(E.send, 'Send'),
    'No auto-send · stub only',
    '',
    `${E.ready} ${clip(first, 200)}`,
    '',
    '```',
    clip(draft, 900),
    '```',
  ].join('\n');
}

export function formatOutcomeOk(logPath: string): string {
  return alertLines([`${E.log} Logged`, clip(logPath, 80)]);
}

export function formatViewDeal(title: string, body: string): string {
  return [header(E.top, 'Deal'), clip(title, 80), '', clip(body, 700)].join('\n');
}

export function formatAlertError(err: string): string {
  return alertLines([`${E.warn} ${clip(err, 180)}`]);
}

export function formatDebateRunningStub(): string {
  return alertLines(['🔄 Debate running…', 'Wait — ~1–3 min typical']);
}

export function formatCompareRunningStub(): string {
  return alertLines(['🔄 Compare running…', '2× pipelines · ~2–6 min']);
}

export function formatThreadParentPing(runId: string, cost: number): string {
  return alertLines([`${E.decision} Done`, `\`${runId}\` · ~$${cost.toFixed(3)}`, '↓ thread']);
}

/** Phase 8 — one-card proactive moment (before buttons). */
export function formatDecisionMomentCard(
  m: DecisionMoment,
  opts: { escalation: 0 | 1 | 2; precomputed?: boolean; expiresInShort?: string }
): string {
  const label = m.account_label ?? m.deal_id;
  const val = m.value_usd ? money(m.value_usd) : '';
  const lines = [
    `${E.moment} **DECISION NEEDED** — ${label}${val ? ` (${val})` : ''}`,
    m.why_now.slice(0, 2).join(' · ') || '—',
    '',
    `${E.ready} ${opts.precomputed ? 'ready · draft pre-built' : 'ready to act'}`,
    '',
    '**Why**',
    bullets(m.why_now.slice(0, 3), 3),
  ];
  if (opts.expiresInShort) lines.push('', `⏱ ${opts.expiresInShort}`);
  if (opts.escalation === 1) lines.push('', '🔁 Still worth — timing');
  if (opts.escalation === 2) lines.push('', '⏳ Last chance');
  return lines.join('\n').slice(0, MAX_MSG);
}

export function formatStubReply(kind: 'send' | 'edit' | 'skip' | 'full', detail?: string): string {
  switch (kind) {
    case 'send':
      return alertLines(['No mail adapter', 'Copy draft · log in CRM']);
    case 'edit':
      return alertLines(['Edit outside Discord', 'CRM or email client']);
    case 'skip':
      return alertLines(['Skipped']);
    case 'full':
      return alertLines(['Artifacts', clip(detail ?? '', 120)]);
    default:
      return '—';
  }
}
