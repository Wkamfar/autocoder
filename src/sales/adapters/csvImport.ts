import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { CRMEntitySource } from '../types/entities.js';
import { CRMEntitySourceType, TrustLevel } from '../types/enums.js';
import type { SalesRepository } from '../storage/salesRepository.js';
import {
  buildCreateAccountMutation,
  buildCreateContactMutation,
  evidenceFromSource,
  nowIso,
} from '../builder/crmMutationHelpers.js';

const CORE_HEADERS = new Set(['company', 'domain', 'email', 'name']);

export interface CsvImportRow {
  company: string;
  domain?: string;
  email: string;
  name?: string;
  /** Any non-core column → flexible pipeline / ICP / metrics (string values). */
  extras: Record<string, string>;
}

/**
 * CSV: required columns `company`, `email`. Optional: `domain`, `name`.
 * Any **additional** headers are stored in `extras` and, on apply, merged into
 * `accounts.score_json` under `pipeline.raw` plus optional `segment` from a `segment` column.
 *
 * Avoid commas inside fields unless you use a proper CSV exporter; tabs are OK in values if you don't split on tab.
 */
export function parseCsv(content: string): CsvImportRow[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((s) => s.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);

  const rows: CsvImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((s) => s.trim());
    const extras: Record<string, string> = {};
    for (let hi = 0; hi < header.length; hi++) {
      const h = header[hi];
      if (!h || CORE_HEADERS.has(h)) continue;
      const v = cols[hi]?.trim();
      if (v) extras[h] = v;
    }
    const row: CsvImportRow = {
      company: col('company') >= 0 ? (cols[col('company')] ?? '') : '',
      domain: col('domain') >= 0 ? cols[col('domain')] || undefined : undefined,
      email: col('email') >= 0 ? (cols[col('email')] ?? '') : '',
      name: col('name') >= 0 ? cols[col('name')] || undefined : undefined,
      extras,
    };
    if (row.company && row.email) rows.push(row);
  }
  return rows;
}

function buildAccountScoreJson(row: CsvImportRow): Record<string, unknown> | undefined {
  const raw = { ...row.extras };
  const segment = raw.segment;
  if (segment) delete raw.segment;
  const payload: Record<string, unknown> = {
    pipeline: {
      source: 'csv_import',
      vertical: 'parametric_risk_markets',
      imported_at: nowIso(),
      raw,
    },
  };
  if (Object.keys(raw).length === 0 && !segment) {
    return undefined;
  }
  return payload;
}

function accountSegmentFromRow(row: CsvImportRow): string | undefined {
  const s = row.extras.segment?.trim();
  return s || undefined;
}

export function importCsvToSourcesAndProposals(
  repo: SalesRepository,
  csvPath: string,
  adapterScope: string,
  autoApplyMutations: boolean
): { sources: CRMEntitySource[]; mutationIds: string[] } {
  const content = readFileSync(csvPath, 'utf8');
  const parsed = parseCsv(content);
  const sources: CRMEntitySource[] = [];
  const mutationIds: string[] = [];
  const t = nowIso();

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    const sourceId = `csv:${i}:${row.email}`;
    const existing = repo.getCRMEntitySourceByAdapterKey(adapterScope, sourceId);
    if (existing) {
      sources.push(existing);
      continue;
    }
    const src: CRMEntitySource = {
      id: randomUUID(),
      source_type: CRMEntitySourceType.csv_row,
      source_id: sourceId,
      adapter_scope: adapterScope,
      imported_at: t,
      trust_level: TrustLevel.medium,
      metadata: { row },
    };
    repo.insertCRMEntitySource(src);
    sources.push(src);

    const ev = evidenceFromSource(src.id);
    const scoreJson = buildAccountScoreJson(row);
    const acc = buildCreateAccountMutation(repo, row.company, row.domain, ev, autoApplyMutations, {
      segment: accountSegmentFromRow(row),
      score_json: scoreJson,
    });
    mutationIds.push(acc.id);
    const contact = buildCreateContactMutation(repo, undefined, row.email, row.name, ev, autoApplyMutations);
    mutationIds.push(contact.id);
  }

  return { sources, mutationIds: [...new Set(mutationIds)] };
}
