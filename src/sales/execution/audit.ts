import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config.js';
import type { SalesAction } from './types.js';

export function salesActionAuditPath(): string {
  const v = process.env.SALES_EXEC_AUDIT_PATH;
  return v && v.trim() ? path.resolve(v) : path.join(config.runtime.stateDir, 'sales-actions.jsonl');
}

/** Append one line for full traceability / replay (immutable log). */
export async function appendSalesActionAudit(row: SalesAction): Promise<string> {
  const p = salesActionAuditPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  const line = JSON.stringify(row) + '\n';
  await fs.appendFile(p, line, 'utf8');
  return p;
}

export async function loadSalesActionAudit(limit = 10_000): Promise<SalesAction[]> {
  const p = salesActionAuditPath();
  try {
    const raw = await fs.readFile(p, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const slice = lines.length > limit ? lines.slice(-limit) : lines;
    return slice.map((l) => JSON.parse(l) as SalesAction);
  } catch {
    return [];
  }
}
