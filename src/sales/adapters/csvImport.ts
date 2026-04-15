import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { CRMEntitySource } from '../types/entities.js';
import {
  CRMEntitySourceType,
  CRMMutationType,
  EntityResolutionOutcome,
  TrustLevel,
} from '../types/enums.js';
import type { SalesRepository } from '../storage/salesRepository.js';
import {
  buildCreateAccountMutation,
  buildCreateContactMutation,
  evidenceFromSource,
  nowIso,
} from '../builder/crmMutationHelpers.js';
import { freshnessForIngest } from '../builder/freshnessPolicy.js';
import { routeCandidate } from '../builder/candidateRouting.js';
import { defaultAutoApplyAllowed } from '../builder/mutationRoutingPolicy.js';
import { resolveAccountCandidate } from '../builder/entityResolution.js';
import { emailDomain, normalizeRegistrableDomain } from '../builder/entityNormalization.js';
import {
  buildOpportunityHypothesisV1,
  buildOutreachReadiness,
  mergeScoreJsonEnrichment,
  buildIcpSnapshotV1,
} from '../builder/icpHypothesisBuilder.js';

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

function rowConfidence(row: CsvImportRow): number {
  let c = 0.35;
  if (row.email?.includes('@')) c += 0.25;
  const dom = row.domain?.trim() || emailDomain(row.email);
  if (dom) c += 0.2;
  if (row.company?.trim().length > 2) c += 0.1;
  if (row.extras.segment?.trim()) c += 0.1;
  return Math.min(1, c);
}

function strategicallyInteresting(row: CsvImportRow): boolean {
  const blob = `${row.company} ${Object.values(row.extras).join(' ')}`.toLowerCase();
  return /risk|parametric|insurance|trading|fund|market/i.test(blob);
}

/**
 * Track A + Builder scoring: CRMEntitySource per row, entity resolution, watchlist/discard,
 * opportunity hypothesis + ICP snapshot on accounts, freshness, mutation routing.
 */
export function importCsvToSourcesAndProposals(
  repo: SalesRepository,
  csvPath: string,
  adapterScope: string | undefined,
  autoApplyMutations: boolean
): { sources: CRMEntitySource[]; mutationIds: string[] } {
  const scope = adapterScope ?? 'network_csv';
  const content = readFileSync(csvPath, 'utf8');
  const parsed = parseCsv(content);
  const sources: CRMEntitySource[] = [];
  const mutationIds: string[] = [];
  const t = nowIso();
  const trust = TrustLevel.medium;
  const fresh = freshnessForIngest(t, trust);
  const icpProfileIds: string[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    const sourceId = `csv:${i}:${row.email}`;
    const existing = repo.getCRMEntitySourceByAdapterKey(scope, sourceId);
    if (existing) {
      sources.push(existing);
      continue;
    }

    const routing = routeCandidate({
      confidence: rowConfidence(row),
      strategicallyInteresting: strategicallyInteresting(row),
      hasDomain: !!(row.domain?.trim() || emailDomain(row.email)),
      hasEmail: row.email.includes('@'),
      hasCompany: row.company.trim().length > 0,
    });

    const src: CRMEntitySource = {
      id: randomUUID(),
      source_type: CRMEntitySourceType.csv_row,
      source_id: sourceId,
      adapter_scope: scope,
      imported_at: t,
      trust_level: trust,
      metadata: { row, candidate_routing: routing },
    };
    repo.insertCRMEntitySource(src);
    sources.push(src);

    if (routing.bucket === 'discard') {
      continue;
    }

    const ev = evidenceFromSource(src.id);
    const baseScore = buildAccountScoreJson(row) ?? {};
    const hyp = buildOpportunityHypothesisV1(row, ev, icpProfileIds, t);
    const icpSnap = buildIcpSnapshotV1(row, t);
    const outreach = buildOutreachReadiness(true);
    const scoreJson = mergeScoreJsonEnrichment(baseScore, {
      opportunity_hypothesis: hyp,
      icp_snapshot: icpSnap,
      outreach,
      candidate_routing: routing,
    });

    const effectiveDomain = row.domain?.trim() || emailDomain(row.email);
    const resolution = resolveAccountCandidate(
      repo,
      {
        companyName: row.company,
        domain: effectiveDomain,
        evidence: ev,
      },
      t
    );

    const manualNetworkExport = scope === 'network_csv' || scope === 'first-ship';
    const hypothesisOk =
      routing.bucket === 'promote' || routing.bucket === 'watchlist';

    const autoBaseAccount = defaultAutoApplyAllowed(CRMMutationType.create_account, {
      hypothesisPresentOrWaivedForWatchlist: hypothesisOk,
    });
    const autoBaseContact = defaultAutoApplyAllowed(CRMMutationType.create_contact, {
      isManualAttestedContact: manualNetworkExport,
    });

    let autoAccount = autoApplyMutations || (autoBaseAccount && routing.bucket === 'promote');
    let autoContact = autoApplyMutations || (autoBaseContact && routing.bucket === 'promote');
    if (resolution.outcome === EntityResolutionOutcome.await_review) {
      autoAccount = false;
      autoContact = false;
    }
    if (routing.bucket === 'watchlist') {
      autoAccount = false;
      autoContact = false;
    }

    if (resolution.outcome === EntityResolutionOutcome.link_to_account && resolution.matched) {
      const contact = buildCreateContactMutation(
        repo,
        resolution.matched.id,
        row.email,
        row.name,
        ev,
        autoContact,
        { ...fresh, confidence_score: 0.88 }
      );
      mutationIds.push(contact.id);
      continue;
    }

    const accMut = buildCreateAccountMutation(repo, row.company, normalizeRegistrableDomain(effectiveDomain), ev, autoAccount, {
      segment: accountSegmentFromRow(row),
      score_json: scoreJson,
      ...fresh,
      confidence_score: resolution.decision.confidence,
    });
    mutationIds.push(accMut.id);

    const contactMut = buildCreateContactMutation(repo, undefined, row.email, row.name, ev, autoContact, {
      ...fresh,
      confidence_score: 0.82,
    });
    mutationIds.push(contactMut.id);
  }

  return { sources, mutationIds: [...new Set(mutationIds)] };
}
