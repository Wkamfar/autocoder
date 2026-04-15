import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { parse } from 'csv-parse/sync';
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

function extrasScore01(extras: Record<string, string>, key: string): number | undefined {
  const raw = extras[key]?.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1, Math.max(0, n / 10));
}

export interface CsvImportRow {
  company: string;
  domain?: string;
  email: string;
  name?: string;
  /** Any non-core column → flexible pipeline / ICP / metrics (string values). */
  extras: Record<string, string>;
}

/**
 * CSV: required `company`. **`email` or `domain`** — if `email` is missing, we use `unknown@<domain>`.
 * Optional: `name`. RFC 4180 quoted fields (commas inside quotes) supported via `csv-parse`.
 * Rich columns (`opportunity_hypothesis`, `why_now`, `icp_fit_score`, …) map into `extras` and
 * into `score_json` enrichment (see `icpHypothesisBuilder`).
 */
export function parseCsv(content: string): CsvImportRow[] {
  let records: Record<string, unknown>[];
  try {
    records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    }) as Record<string, unknown>[];
  } catch {
    return [];
  }

  const rows: CsvImportRow[] = [];
  for (const rec of records) {
    const lower: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (v == null) continue;
      lower[String(k).trim().toLowerCase()] = String(v).trim();
    }

    let company = lower['company'] ?? '';
    if (/additional rows follow/i.test(company) || /\.\.\.\s*\(additional/i.test(company)) continue;

    const domain = lower['domain'] || undefined;
    let email = lower['email'] ?? '';
    if (!email && domain) {
      const d = domain.replace(/^www\./i, '').trim();
      email = `unknown@${d}`;
    }

    if (!company || !email) continue;

    const extras: Record<string, string> = {};
    for (const [k, v] of Object.entries(lower)) {
      if (CORE_HEADERS.has(k)) continue;
      if (v) extras[k] = v;
    }

    rows.push({
      company,
      email,
      domain,
      name: lower['name'] || undefined,
      extras,
    });
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
  const icp = extrasScore01(row.extras, 'icp_fit_score');
  const warm = extrasScore01(row.extras, 'warmth_score');
  if (icp != null) c = Math.max(c, 0.4 + icp * 0.55);
  else if (warm != null) c = Math.max(c, 0.35 + warm * 0.45);
  return Math.min(1, c);
}

function strategicallyInteresting(row: CsvImportRow): boolean {
  if (row.extras.tier?.trim().toUpperCase() === 'A') return true;
  const icp = extrasScore01(row.extras, 'icp_fit_score');
  if (icp != null && icp >= 0.75) return true;
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
  const domainsSeenInBatch = new Set<string>();

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    const nd = normalizeRegistrableDomain(row.domain) || emailDomain(row.email);
    if (nd) {
      if (domainsSeenInBatch.has(nd)) continue;
      domainsSeenInBatch.add(nd);
    }
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
