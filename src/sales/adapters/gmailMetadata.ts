import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { CRMEntitySource } from '../types/entities.js';
import { CRMEntitySourceType, TrustLevel } from '../types/enums.js';
import type { SalesRepository } from '../storage/salesRepository.js';

/** Minimal Gmail metadata JSON: { messages: [{ id, threadId, from, to, subject }] } */
export interface GmailMetadataFile {
  messages: Array<{
    id: string;
    threadId?: string;
    from?: string;
    to?: string;
    subject?: string;
  }>;
}

export function loadGmailMetadataJson(path: string): GmailMetadataFile {
  return JSON.parse(readFileSync(path, 'utf8')) as GmailMetadataFile;
}

/** Persist each message as CRMEntitySource (audit only; planner can propose mutations separately). */
export function ingestGmailMetadata(
  repo: SalesRepository,
  filePath: string,
  adapterScope: string
): CRMEntitySource[] {
  const data = loadGmailMetadataJson(filePath);
  const t = new Date().toISOString();
  const out: CRMEntitySource[] = [];
  for (const m of data.messages) {
    const sourceId = m.id;
    const existing = repo.getCRMEntitySourceByAdapterKey(adapterScope, sourceId);
    if (existing) {
      out.push(existing);
      continue;
    }
    const src: CRMEntitySource = {
      id: randomUUID(),
      source_type: CRMEntitySourceType.gmail_metadata,
      source_id: sourceId,
      adapter_scope: adapterScope,
      imported_at: t,
      trust_level: TrustLevel.medium,
      metadata: { from: m.from, to: m.to, subject: m.subject, threadId: m.threadId },
    };
    repo.insertCRMEntitySource(src);
    out.push(src);
  }
  return out;
}
