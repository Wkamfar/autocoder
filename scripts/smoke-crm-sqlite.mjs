#!/usr/bin/env node
/**
 * Opens a throwaway SQLite file, applies CRM schema — validates v7 storage path without Discord.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openSalesDatabase, resetSalesDatabaseForTests } from '../dist/sales/storage/salesDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dbPath = path.join(root, 'state', '.ci-smoke-crm.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
try {
  fs.unlinkSync(dbPath);
} catch {
  /* */
}
resetSalesDatabaseForTests();
const db = openSalesDatabase(dbPath);
const { n } = db.prepare(`SELECT COUNT(*) as n FROM sqlite_master WHERE type = 'table'`).get();
if (n < 1) {
  console.error('crm sqlite: no tables');
  process.exit(1);
}
db.close();
try {
  fs.unlinkSync(dbPath);
} catch {
  /* */
}
resetSalesDatabaseForTests();
console.log('crm sqlite schema ok');
