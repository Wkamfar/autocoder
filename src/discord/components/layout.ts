/** Phase 7 — tight Discord copy; scannable in ~3s. */

export const E = {
  top: '⚡',
  decision: '🧠',
  compare: '⚖️',
  send: '✉️',
  log: '✅',
  warn: '⚠️',
  moment: '⚠️',
  ready: '→',
} as const;

export function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

/** Max N bullets, one line each. */
export function bullets(lines: (string | undefined | null)[], max = 3): string {
  const out = lines
    .map((l) => (l ?? '').trim())
    .filter(Boolean)
    .slice(0, max)
    .map((l) => `• ${clip(l, 120)}`);
  return out.join('\n');
}

/** Alerts: max 3 short lines total. */
export function alertLines(lines: string[]): string {
  return lines.slice(0, 3).map((l) => clip(l, 200)).join('\n');
}
