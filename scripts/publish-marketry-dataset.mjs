#!/usr/bin/env node
/**
 * Merges datasets/marketry/chunk-*.mjs → examples/marketry_chicago_targets.csv
 * Run: node scripts/publish-marketry-dataset.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stringify } from 'csv-stringify/sync';

import c1 from '../datasets/marketry/chunk-01.mjs';
import c2 from '../datasets/marketry/chunk-02.mjs';
import c3 from '../datasets/marketry/chunk-03.mjs';
import c4 from '../datasets/marketry/chunk-04.mjs';
import c5 from '../datasets/marketry/chunk-05.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const merged = [...c1, ...c2, ...c3, ...c4, ...c5];
const seen = new Set();
const rows = [];
for (const r of merged) {
  const d = String(r.domain || '')
    .replace(/^www\./i, '')
    .toLowerCase();
  if (!d || seen.has(d)) continue;
  seen.add(d);
  rows.push({
    company: r.company,
    email: r.email || `unknown@${d}`,
    domain: r.domain,
    tier: r.tier,
    segment: r.segment,
    warmth_score: String(r.warmth_score),
    icp_fit_score: String(r.icp_fit_score),
    buyer_roles: r.buyer_roles,
    opportunity_hypothesis: r.opportunity_hypothesis,
    why_now: r.why_now,
  });
}

const csv = stringify(rows, {
  header: true,
  columns: [
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
  ],
});

const out = join(root, 'examples/marketry_chicago_targets.csv');
writeFileSync(out, csv, 'utf8');
console.log('wrote', out, 'rows:', rows.length);
