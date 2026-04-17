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

export interface CsvImportRow {
  company: string;
  domain?: string;
  email: string;
  name?: string;
}

/**
 * Minimal CSV: headers company,domain,email,name
 * Persists CRMEntitySource per row, proposes create_account + create_contact mutations.
 * Run mutation apply, then optionally propose create_deal via `sales propose-deals` or planner.
 */
export function parseCsv(content: string): CsvImportRow[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(',').map((s) => s.trim());
  const idx = (name: string) => header.indexOf(name);
  const rows: CsvImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((s) => s.trim());
    const row: CsvImportRow = {
      company: cols[idx('company')] ?? '',
      domain: cols[idx('domain')] || undefined,
      email: cols[idx('email')] ?? '',
      name: cols[idx('name')] || undefined,
    };
    if (row.company && row.email) rows.push(row);
  }
  return rows;
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
    const acc = buildCreateAccountMutation(repo, row.company, row.domain, ev, autoApplyMutations);
    mutationIds.push(acc.id);
    const contact = buildCreateContactMutation(repo, undefined, row.email, row.name, ev, autoApplyMutations);
    mutationIds.push(contact.id);
  }

  return { sources, mutationIds: [...new Set(mutationIds)] };
}
