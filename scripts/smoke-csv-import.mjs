#!/usr/bin/env node
/**
 * v7 path: SQLite + importCsvToSourcesAndProposals(sample_leads.csv).
 * Uses a dedicated DB file; set SALES_DB_PATH before salesContext loads config.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dbPath = path.join(root, 'state', '.ci-csv-import.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
try {
  fs.unlinkSync(dbPath);
} catch {
  /* */
}
process.env.SALES_DB_PATH = dbPath;

const { initSalesMode, getSalesContext } = await import('../dist/sales/salesContext.js');
const { importCsvToSourcesAndProposals } = await import('../dist/sales/adapters/csvImport.js');

initSalesMode();
const { repo } = getSalesContext();
const csvPath = path.join(root, 'examples/sample_leads.csv');
const r = importCsvToSourcesAndProposals(repo, csvPath, 'ci-smoke', false);
if (r.sources.length < 1) {
  console.error('csv import: expected ≥1 CRMEntitySource');
  process.exit(1);
}
console.log('csv import ok:', r.sources.length, 'sources,', r.mutationIds.length, 'mutations');
