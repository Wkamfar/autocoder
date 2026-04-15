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

export function buildIcpSnapshotV1(row: CsvImportRow, atIso: string): ICPScoreSnapshotV1 {
  const { fit, explain } = keywordFit(row.company, row.extras);
  return {
    version: '1',
    computed_at: atIso,
    fit_score: fit,
    components: { keyword_fit: fit },
    explain,
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
  return {
    hypothesis_id: randomUUID(),
    version: 1,
    risk_thesis: segment
      ? `${row.company} (${segment}): parametric / structured risk and index-linked exposure — hypothesis from pipeline import.`
      : `${row.company}: parametric risk / prediction-market adjacent buyer — hypothesis from pipeline import.`,
    likely_use_case: 'Exposure management, hedging, or trading workflow tied to verifiable indices or event triggers.',
    likely_buying_center: 'Risk / treasury / trading operations leadership (roles only; contacts reviewed separately).',
    why_now: 'Imported into NightShift pipeline for ICP alignment and evidence-backed qualification.',
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
