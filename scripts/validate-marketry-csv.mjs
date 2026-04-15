#!/usr/bin/env node
/**
 * Fail if examples/marketry_chicago_targets.csv drifts from the v6 contract
 * (exact header order + 44 data rows). No network; uses csv-parse.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const csvPath = path.join(root, 'examples', 'marketry_chicago_targets.csv');

export const EXPECTED_MARKETRY_HEADERS = [
  'company',
  'email',
  'domain',
  'tier',
  'segment',
  'warmth_score',
  'icp_fit_score',
  'buyer_roles',
  'opportunity_hypothesis',
  'why_now',
  'notes',
  'employee_band',
  'revenue_band',
  'regions',
  'regulated',
  'parametric_maturity',
  'innovation_partner_fit',
  'captive_or_alt_risk',
  'hq_city',
  'hq_state',
  'hq_country',
  'ownership',
  'linkedin_company_url',
  'evidence_url',
  'evidence_note',
  'evidence_date',
  'intro_path',
  'intro_path_confidence',
  'hq_verified',
  'hq_verification_status',
  'domain_verified',
  'domain_verification_status',
  'primary_risk_vector',
  'contact_confidence',
  'email_verified',
  'outreach_eligible',
  'record_type',
  'contact_source_note',
];

const EXPECTED_ROW_COUNT = 44;

function main() {
  if (!fs.existsSync(csvPath)) {
    console.error('validate-marketry-csv: missing', csvPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(csvPath, 'utf8');
  const all = parse(raw, {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: false,
  });
  if (all.length < 2) {
    console.error('validate-marketry-csv: expected header + ≥1 data row');
    process.exit(1);
  }
  const headers = all[0];
  if (headers.length !== EXPECTED_MARKETRY_HEADERS.length) {
    console.error(
      'validate-marketry-csv: expected',
      EXPECTED_MARKETRY_HEADERS.length,
      'columns, got',
      headers.length
    );
    process.exit(1);
  }
  for (let i = 0; i < EXPECTED_MARKETRY_HEADERS.length; i++) {
    if (headers[i] !== EXPECTED_MARKETRY_HEADERS[i]) {
      console.error(
        `validate-marketry-csv: column ${i}: expected "${EXPECTED_MARKETRY_HEADERS[i]}", got "${headers[i]}"`
      );
      process.exit(1);
    }
  }
  const dataRows = all.length - 1;
  if (dataRows !== EXPECTED_ROW_COUNT) {
    console.error(
      'validate-marketry-csv: expected',
      EXPECTED_ROW_COUNT,
      'data rows, got',
      dataRows
    );
    process.exit(1);
  }
  console.log(
    'validate-marketry-csv: ok',
    EXPECTED_ROW_COUNT,
    'rows,',
    EXPECTED_MARKETRY_HEADERS.length,
    'columns'
  );
}

main();
