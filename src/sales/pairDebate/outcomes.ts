import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config.js';
import type { PairDebateOutcomeRecord } from './types.js';

export function outcomesLogPath(): string {
  const v = process.env.PAIR_DEBATE_OUTCOMES_PATH;
  return v && v.trim() ? path.resolve(v) : path.join(config.runtime.stateDir, 'pair-debate-outcomes.jsonl');
}

export async function appendOutcome(row: PairDebateOutcomeRecord): Promise<string> {
  const p = outcomesLogPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  const line = JSON.stringify(row) + '\n';
  await fs.appendFile(p, line, 'utf8');
  return p;
}

export async function loadOutcomes(limit = 50_000): Promise<PairDebateOutcomeRecord[]> {
  const p = outcomesLogPath();
  try {
    const raw = await fs.readFile(p, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const slice = lines.length > limit ? lines.slice(-limit) : lines;
    return slice.map((l) => JSON.parse(l) as PairDebateOutcomeRecord);
  } catch {
    return [];
  }
}
