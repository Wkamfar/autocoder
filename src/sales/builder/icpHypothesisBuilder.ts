/**
 * Builds OpportunityHypothesis + ICP snapshot + outreach readiness for account score_json.
 */
import { randomUUID } from 'node:crypto';
import type { EvidenceRef } from '../types/entities.js';
import type {
  ICPScoreSnapshotV1,
  OpportunityHypothesisV1,
  OutreachReadinessV1,
} from '../types/scoreJsonContracts.js';
import { SCORE_JSON_KEYS } from '../types/scoreJsonContracts.js';
import type { CsvImportRow } from '../adapters/csvImport.js';

const SCORER_VERSION = 'icp_v1_heuristic';

function keywordFit(company: string, extras: Record<string, string>): { fit: number; explain: string[] } {
  const text = `${company} ${Object.values(extras).join(' ')}`.toLowerCase();
  const explain: string[] = [];
  let score = 0.35;
  if (/risk|insurance|reinsur|parametric|cat\s*bond|derivative|trading|market/i.test(text)) {
    score += 0.25;
    explain.push('sector_keyword_parametric_risk');
  }
  if (/fund|asset|portfolio|treasury|hedge/i.test(text)) {
    score += 0.15;
    explain.push('buyer_archetype_finance');
  }
  if (/mid|midsize|middle\s*market|sme/i.test(text)) {
    score += 0.1;
    explain.push('size_band_hint');
  }
  return { fit: Math.min(1, score), explain };
}

function sheetScore01(extras: Record<string, string>, key: 'icp_fit_score' | 'warmth_score'): number | undefined {
  const raw = extras[key]?.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1, Math.max(0, n / 10));
}

export function buildIcpSnapshotV1(row: CsvImportRow, atIso: string): ICPScoreSnapshotV1 {
  const { fit, explain } = keywordFit(row.company, row.extras);
  const sheetIcp = sheetScore01(row.extras, 'icp_fit_score');
  const sheetWarmth = sheetScore01(row.extras, 'warmth_score');
  const fit_score = sheetIcp ?? fit;
  const components: Record<string, number> = { keyword_fit: fit };
  if (sheetIcp != null) components.sheet_icp_fit = sheetIcp;
  if (sheetWarmth != null) components.sheet_warmth = sheetWarmth;
  const explainOut =
    sheetIcp != null ? ['icp_fit_score_from_sheet', ...explain] : explain;
  return {
    version: '1',
    computed_at: atIso,
    fit_score,
    components,
    explain: explainOut,
  };
}

export function buildOpportunityHypothesisV1(
  row: CsvImportRow,
  evidence: EvidenceRef[],
  icpProfileIds: string[],
  atIso: string
): OpportunityHypothesisV1 {
  const snap = buildIcpSnapshotV1(row, atIso);
  const segment = row.extras.segment?.trim();
  const customThesis = row.extras.opportunity_hypothesis?.trim();
  const customWhy = row.extras.why_now?.trim();
  const buyerRoles = row.extras.buyer_roles?.trim();
  const tier = row.extras.tier?.trim();

  const defaultThesis = segment
    ? `${row.company} (${segment}): parametric / structured risk and index-linked exposure — hypothesis from pipeline import.`
    : `${row.company}: parametric risk / prediction-market adjacent buyer — hypothesis from pipeline import.`;

  const risk_thesis = customThesis || defaultThesis;
  const why_now =
    customWhy || 'Imported into NightShift pipeline for ICP alignment and evidence-backed qualification.';
  const likely_buying_center = buyerRoles
    ? buyerRoles.split('|').map((s) => s.trim()).filter(Boolean).join(', ')
    : 'Risk / treasury / trading operations leadership (roles only; contacts reviewed separately).';

  const likely_use_case =
    tier != null
      ? `Tier ${tier} target — exposure management and parametric risk transfer aligned to sheet qualification.`
      : 'Exposure management, hedging, or trading workflow tied to verifiable indices or event triggers.';

  return {
    hypothesis_id: randomUUID(),
    version: 1,
    risk_thesis,
    likely_use_case,
    likely_buying_center,
    why_now,
    fit_score: snap.fit_score,
    source_evidence: evidence,
    icp_binding: {
      icp_profile_ids: icpProfileIds,
      scorer_version: SCORER_VERSION,
    },
    created_at: atIso,
    updated_at: atIso,
  };
}

export function buildOutreachReadiness(hasVerifiedContactPath: boolean): OutreachReadinessV1 {
  if (hasVerifiedContactPath) {
    return { state: 'eligible_pending_review', reason: 'contact_present_pending_policy_review' };
  }
  return { state: 'not_eligible', reason: 'no_verified_contact' };
}

/** Merge hypothesis, icp_snapshot, outreach into existing score_json from CSV pipeline. */
export function mergeScoreJsonEnrichment(
  base: Record<string, unknown> | undefined,
  parts: {
    opportunity_hypothesis?: OpportunityHypothesisV1;
    icp_snapshot?: ICPScoreSnapshotV1;
    outreach?: OutreachReadinessV1;
    candidate_routing?: { bucket: string; reason?: string; strategic_interest?: boolean };
  }
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(base ?? {}) };
  if (parts.opportunity_hypothesis) {
    out[SCORE_JSON_KEYS.opportunity_hypothesis] = parts.opportunity_hypothesis;
  }
  if (parts.icp_snapshot) {
    out[SCORE_JSON_KEYS.icp_snapshot] = parts.icp_snapshot;
  }
  if (parts.outreach) {
    out[SCORE_JSON_KEYS.outreach] = parts.outreach;
  }
  if (parts.candidate_routing) {
    out[SCORE_JSON_KEYS.candidate_routing] = parts.candidate_routing;
  }
  return out;
}
