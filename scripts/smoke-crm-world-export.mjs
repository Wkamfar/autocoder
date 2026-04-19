#!/usr/bin/env node
/**
 * Phase 1: import CSV → apply-pending → crm-export-world → validate shape → top-decisions --world.
 * Proves dossier load path (buildDossierPack) without LLM (no pair-debate API calls).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateSalesWorldShape } from './validate-sales-world-shape.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dbPath = path.join(root, 'state', '.ci-crm-world-export.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
try {
  fs.unlinkSync(dbPath);
} catch {
  /* */
}
process.env.SALES_DB_PATH = dbPath;

const exportPath = path.join(root, 'state', '.ci-crm-world-export.out.json');
const postApplySnapshotPath = path.join(root, 'state', '.ci-post-apply-snapshot.json');
try {
  fs.unlinkSync(postApplySnapshotPath);
} catch {
  /* */
}

const { initSalesMode, getSalesContext } = await import('../dist/sales/salesContext.js');
const { importCsvToSourcesAndProposals } = await import('../dist/sales/adapters/csvImport.js');
const { applyPendingPipeline } = await import('../dist/sales/operations.js');
const { writeCrmWorldExport } = await import('../dist/sales/world/crmWorldExport.js');
const { buildDossierPack } = await import('../dist/sales/pairDebate/dossierBuilder.js');
const { loadSalesWorld } = await import('../dist/sales/world/fileWorldStore.js');

initSalesMode();
const ctx = getSalesContext();
const csvPath = path.join(root, 'examples/sample_leads.csv');
importCsvToSourcesAndProposals(ctx.repo, csvPath, 'ci-crm-export', false);
process.env.SALES_POST_APPLY_EXPORT_PATH = postApplySnapshotPath;
const applied = applyPendingPipeline(ctx, 'ci-smoke');
if (applied.mutationsApplied < 1) {
  console.error('crm-world-export smoke: expected ≥1 applied mutation');
  process.exit(1);
}
if (applied.postApplySnapshot.status !== 'wrote') {
  console.error('crm-world-export smoke: expected Phase 3 post-apply snapshot', applied.postApplySnapshot);
  process.exit(1);
}
const vPost = validateSalesWorldShape(JSON.parse(fs.readFileSync(postApplySnapshotPath, 'utf8')));
if (!vPost.ok) {
  console.error('crm-world-export smoke: post-apply snapshot invalid shape', vPost.errors?.join('; '));
  process.exit(1);
}
delete process.env.SALES_POST_APPLY_EXPORT_PATH;

writeCrmWorldExport({ repo: ctx.repo, outPath: exportPath });

const raw = fs.readFileSync(exportPath, 'utf8');
const data = JSON.parse(raw);
const v = validateSalesWorldShape(data);
if (!v.ok) {
  console.error('crm-world-export smoke: invalid world shape:', v.errors?.join('; '));
  process.exit(1);
}

if (!data.source || data.source !== 'crm_snapshot') {
  console.error('crm-world-export smoke: expected envelope source crm_snapshot');
  process.exit(1);
}

const world = loadSalesWorld(exportPath);
if (!world.deals?.length) {
  console.error('crm-world-export smoke: expected ≥1 deal after apply-pending');
  process.exit(1);
}

const dealId = world.deals[0].id;
const dossier = buildDossierPack(world, { kind: 'deal', id: dealId });
if (!dossier.body || dossier.body.length < 20) {
  console.error('crm-world-export smoke: dossier body too short');
  process.exit(1);
}

const { execFileSync } = await import('node:child_process');
const td = execFileSync(
  process.execPath,
  [path.join(root, 'dist/index.js'), 'sales', 'top-decisions', '--limit', '5', '--json', '--world', exportPath, '--all'],
  { encoding: 'utf8' }
);
const ranked = JSON.parse(td);
if (!ranked.decisions?.length) {
  console.error('crm-world-export smoke: top-decisions returned no rows');
  process.exit(1);
}

const tdCrm = execFileSync(
  process.execPath,
  [
    path.join(root, 'dist/index.js'),
    'sales',
    'top-decisions',
    '--limit',
    '5',
    '--json',
    '--source',
    'crm',
    '--all',
  ],
  { encoding: 'utf8', env: { ...process.env, SALES_DB_PATH: dbPath } }
);
const rankedCrm = JSON.parse(tdCrm);
if (rankedCrm.dossier_provenance !== 'crm_backed' || rankedCrm.dossier_source_effective !== 'crm') {
  console.error('crm-world-export smoke: expected --source crm json metadata');
  process.exit(1);
}
if (!rankedCrm.decisions?.length) {
  console.error('crm-world-export smoke: top-decisions --source crm returned no rows');
  process.exit(1);
}

console.log(
  'crm-world-export smoke ok: export valid, post-apply snapshot, dossier for deal',
  dealId,
  'top-decisions',
  ranked.decisions.length,
  'top-decisions --source crm',
  rankedCrm.decisions.length
);
