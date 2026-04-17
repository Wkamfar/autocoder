import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { CREATE_SALES_TABLES, SALES_SCHEMA_VERSION } from './schema.js';

export type SalesDatabase = Database.Database;

let singleton: SalesDatabase | null = null;

export function openSalesDatabase(dbPath: string): SalesDatabase {
  if (singleton) return singleton;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(CREATE_SALES_TABLES);
  db.prepare(
    `INSERT OR REPLACE INTO sales_meta (key, value_json, updated_at) VALUES ('schema_version', ?, datetime('now'))`
  ).run(JSON.stringify(SALES_SCHEMA_VERSION));
  singleton = db;
  return db;
}

export function getSalesDatabase(): SalesDatabase {
  if (!singleton) {
    throw new Error('Sales database not opened; call openSalesDatabase first');
  }
  return singleton;
}

export function resetSalesDatabaseForTests(): void {
  singleton = null;
}
