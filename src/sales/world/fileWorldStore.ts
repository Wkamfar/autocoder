import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import type {
  SalesAccount,
  SalesActivity,
  SalesContact,
  SalesDeal,
  SalesWorldFile,
} from './types.js';

const DEFAULT_REL = 'sales-world.json';

export function defaultWorldPath(): string {
  const env = process.env.SALES_WORLD_JSON;
  if (env) return path.resolve(env);
  return path.join(config.runtime.stateDir, DEFAULT_REL);
}

export function loadSalesWorld(filePath?: string): SalesWorldFile {
  const p = filePath ?? defaultWorldPath();
  if (!fs.existsSync(p)) {
    throw new Error(
      `Sales world file not found: ${p}\nCreate it or set SALES_WORLD_JSON to a JSON file with accounts, contacts, deals, activities.`
    );
  }
  const raw = fs.readFileSync(p, 'utf8');
  const data = JSON.parse(raw) as SalesWorldFile;
  if (!Array.isArray(data.accounts)) data.accounts = [];
  if (!Array.isArray(data.contacts)) data.contacts = [];
  if (!Array.isArray(data.deals)) data.deals = [];
  if (!Array.isArray(data.activities)) data.activities = [];
  return data;
}

export function getAccount(world: SalesWorldFile, id: string): SalesAccount | undefined {
  return world.accounts.find((a) => a.id === id);
}

export function getDeal(world: SalesWorldFile, id: string): SalesDeal | undefined {
  return world.deals.find((d) => d.id === id);
}

export function getContact(world: SalesWorldFile, id: string): SalesContact | undefined {
  return world.contacts.find((c) => c.id === id);
}

export function contactsForAccount(world: SalesWorldFile, accountId: string): SalesContact[] {
  return world.contacts.filter((c) => c.account_id === accountId);
}

export function dealsForAccount(world: SalesWorldFile, accountId: string): SalesDeal[] {
  return world.deals.filter((d) => d.account_id === accountId);
}

export function activitiesForScope(
  world: SalesWorldFile,
  accountId: string,
  dealId?: string
): SalesActivity[] {
  return world.activities.filter((a) => {
    if (dealId && a.deal_id === dealId) return true;
    if (a.account_id === accountId && !dealId) return true;
    if (a.account_id === accountId && a.deal_id === dealId) return true;
    return false;
  });
}
