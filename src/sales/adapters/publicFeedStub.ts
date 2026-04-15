/**
 * v1 third source: one allowlisted public company feed (plan §7).
 * Proposes create_account mutations only — conservative auto_apply (off).
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { CRMEntitySource } from '../types/entities.js';
import { CRMEntitySourceType, TrustLevel } from '../types/enums.js';
import type { SalesRepository } from '../storage/salesRepository.js';
import { buildCreateAccountMutation, evidenceFromSource, nowIso } from '../builder/crmMutationHelpers.js';
import { freshnessForIngest } from '../builder/freshnessPolicy.js';
import { normalizeRegistrableDomain } from '../builder/entityNormalization.js';
import {
  mergeScoreJsonEnrichment,
  buildIcpSnapshotV1,
  buildOpportunityHypothesisV1,
  buildOutreachReadiness,
} from '../builder/icpHypothesisBuilder.js';
import type { CsvImportRow } from './csvImport.js';

export interface PublicFeedItem {
  name: string;
  domain?: string;
  ticker?: string;
  cik?: string;
}

export interface PublicFeedFile {
  items: PublicFeedItem[];
}

export function loadPublicFeedJson(path: string): PublicFeedFile {
  return JSON.parse(readFileSync(path, 'utf8')) as PublicFeedFile;
}

function itemToCsvRow(item: PublicFeedItem): CsvImportRow {
  return {
    company: item.name,
    domain: item.domain,
    email: `placeholder@${normalizeRegistrableDomain(item.domain) || 'unknown.invalid'}`,
    extras: {
      ticker: item.ticker ?? '',
      cik: item.cik ?? '',
      source: 'public_registry_feed',
    },
  };
}

/**
 * Ingests feed rows as CRMEntitySource + proposed account creations (no contacts — public stub).
 */
export function ingestPublicRegistryFeed(
  repo: SalesRepository,
  filePath: string,
  adapterScope = 'public_registry_v1'
): { sources: CRMEntitySource[]; mutationIds: string[] } {
  const data = loadPublicFeedJson(filePath);
  const t = nowIso();
  const trust = TrustLevel.low;
  const fresh = freshnessForIngest(t, trust);
  const sources: CRMEntitySource[] = [];
  const mutationIds: string[] = [];
  const icpProfileIds: string[] = [];

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    const sourceId = `pub:${item.cik || item.ticker || item.domain || i}:${item.name}`.slice(0, 200);
    const existing = repo.getCRMEntitySourceByAdapterKey(adapterScope, sourceId);
    if (existing) {
      sources.push(existing);
      continue;
    }

    const src: CRMEntitySource = {
      id: randomUUID(),
      source_type: CRMEntitySourceType.public_registry_feed,
      source_id: sourceId,
      adapter_scope: adapterScope,
      imported_at: t,
      trust_level: trust,
      metadata: { item },
    };
    repo.insertCRMEntitySource(src);
    sources.push(src);

    const row = itemToCsvRow(item);
    const ev = evidenceFromSource(src.id);
    const baseScore: Record<string, unknown> = {
      pipeline: {
        source: 'public_registry_feed',
        imported_at: t,
        raw: { ticker: item.ticker, cik: item.cik },
      },
    };
    const hyp = buildOpportunityHypothesisV1(row, ev, icpProfileIds, t);
    const icpSnap = buildIcpSnapshotV1(row, t);
    const outreach = buildOutreachReadiness(false);
    const scoreJson = mergeScoreJsonEnrichment(baseScore, {
      opportunity_hypothesis: hyp,
      icp_snapshot: icpSnap,
      outreach,
      candidate_routing: { bucket: 'watchlist', reason: 'public_stub_no_verified_contact' },
    });

    const m = buildCreateAccountMutation(
      repo,
      item.name,
      normalizeRegistrableDomain(item.domain),
      ev,
      false,
      {
        score_json: scoreJson,
        ...fresh,
        confidence_score: 0.45,
      }
    );
    mutationIds.push(m.id);
  }

  return { sources, mutationIds: [...new Set(mutationIds)] };
}
