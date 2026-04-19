/**
 * CRM SQLite → SalesWorldFile-compatible snapshot (+ envelope) for Pair Debate / top-decisions.
 * @see docs/CRM_SALES_OS_UNIFICATION.md
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Account, Activity, Contact, Deal } from '../types/entities.js';
import type { SalesRepository } from '../storage/salesRepository.js';
import type { SalesAccount, SalesActivity, SalesContact, SalesDeal, SalesWorldFile } from './types.js';

/** Bump when export field mappings change (doc §7). */
export const CRM_EXPORT_VERSION = 1;

export const CRM_WORLD_SCHEMA_VERSION = '1' as const;

export interface CrmWorldExportEnvelope {
  schema_version: typeof CRM_WORLD_SCHEMA_VERSION;
  exported_at: string;
  source: 'crm_snapshot';
  crm_export_version: number;
}

/** Root JSON written by crm-export-world (validator allows extra keys beside accounts…activities). */
export type CrmWorldExportRoot = CrmWorldExportEnvelope & SalesWorldFile;

/** Optional identity map for debugging (not authoritative). Doc §8. */
export interface CrmWorldBridgeFile {
  exported_at: string;
  crm_export_version: number;
  accounts: Record<string, { crm_account_id: string }>;
  contacts: Record<string, { crm_contact_id: string; account_id?: string }>;
  deals: Record<string, { crm_deal_id: string; account_id: string }>;
}

function daysBetweenIso(fromIso: string, toMs: number): number {
  const t = Date.parse(fromIso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((toMs - t) / 86_400_000));
}

/** Best-effort economics from account enrichment (CRM deals table has no value column). */
export function pickDealEconomicsFromAccount(account: Account | undefined): {
  value_cents?: number;
  currency?: string;
} {
  if (!account?.score_json || typeof account.score_json !== 'object') return {};
  const sj = account.score_json as Record<string, unknown>;
  const hyp = sj.opportunity_hypothesis;
  if (hyp && typeof hyp === 'object') {
    const h = hyp as Record<string, unknown>;
    const usd = h.estimated_value_usd;
    if (typeof usd === 'number' && Number.isFinite(usd) && usd > 0) {
      return { value_cents: Math.round(usd * 100), currency: 'USD' };
    }
  }
  const raw = sj.estimated_deal_value_cents;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return { value_cents: Math.round(raw), currency: typeof sj.currency === 'string' ? sj.currency : 'USD' };
  }
  return {};
}

export function mapCrmAccountToSales(a: Account): SalesAccount {
  const notesParts: string[] = [];
  if (a.domain) notesParts.push(`domain: ${a.domain}`);
  if (a.segment) notesParts.push(`segment: ${a.segment}`);
  const notes = notesParts.length ? notesParts.join(' · ') : undefined;
  return {
    id: a.id,
    name: a.name,
    owner: a.owner_user_id,
    notes,
  };
}

export function mapCrmContactToSales(c: Contact): SalesContact | null {
  if (!c.account_id?.trim()) return null;
  return {
    id: c.id,
    account_id: c.account_id,
    name: c.full_name?.trim() || c.email || c.id,
    email: c.email,
    role: c.title,
  };
}

export function mapCrmDealToSales(
  d: Deal,
  accountById: Map<string, Account>,
  nowMs: number
): SalesDeal {
  const acct = accountById.get(d.account_id);
  const econ = pickDealEconomicsFromAccount(acct);
  const name =
    acct?.name != null ? `${acct.name} · ${d.deal_stage}` : `${d.deal_stage} (${d.id.slice(0, 8)})`;
  const lastTouch = d.last_contacted_at
    ? daysBetweenIso(d.last_contacted_at, nowMs)
    : undefined;
  return {
    id: d.id,
    account_id: d.account_id,
    name,
    stage: String(d.deal_stage),
    value_cents: econ.value_cents,
    currency: econ.currency,
    last_touch_days_ago: lastTouch,
  };
}

function activitySummary(a: Activity): string {
  if (a.payload && typeof a.payload === 'object') {
    try {
      const s = JSON.stringify(a.payload);
      if (s.length > 500) return s.slice(0, 497) + '…';
      return s;
    } catch {
      /* fall through */
    }
  }
  return a.activity_type;
}

export function mapCrmActivityToSales(
  a: Activity,
  accountById: Map<string, Account>,
  dealById: Map<string, Deal>,
  contactById: Map<string, Contact>
): SalesActivity {
  let account_id: string | undefined;
  let deal_id: string | undefined;
  const et = a.entity_type?.toLowerCase();
  const eid = a.entity_id;

  if (et === 'deal' && eid) {
    deal_id = eid;
    const d = dealById.get(eid);
    if (d) account_id = d.account_id;
  } else if (et === 'account' && eid) {
    account_id = eid;
  } else if (et === 'contact' && eid) {
    const c = contactById.get(eid);
    if (c?.account_id) account_id = c.account_id;
  }

  return {
    id: a.id,
    account_id,
    deal_id,
    at: a.created_at,
    type: a.activity_type,
    summary: activitySummary(a),
  };
}

export function buildCrmWorldExportRoot(repo: SalesRepository, exportedAt: string): CrmWorldExportRoot {
  const accounts = repo.listAccounts();
  const accountById = new Map(accounts.map((x) => [x.id, x] as const));
  const contactsRaw = repo.listContacts();
  const contacts: SalesContact[] = [];
  for (const c of contactsRaw) {
    const m = mapCrmContactToSales(c);
    if (m) contacts.push(m);
  }
  const deals = repo.listDeals();
  const dealById = new Map(deals.map((x) => [x.id, x] as const));
  const contactById = new Map(contactsRaw.map((x) => [x.id, x] as const));
  const nowMs = Date.now();

  const envelope: CrmWorldExportEnvelope = {
    schema_version: CRM_WORLD_SCHEMA_VERSION,
    exported_at: exportedAt,
    source: 'crm_snapshot',
    crm_export_version: CRM_EXPORT_VERSION,
  };

  return {
    ...envelope,
    accounts: accounts.map(mapCrmAccountToSales),
    contacts,
    deals: deals.map((d) => mapCrmDealToSales(d, accountById, nowMs)),
    activities: repo
      .listActivities()
      .map((a) => mapCrmActivityToSales(a, accountById, dealById, contactById)),
  };
}

export function buildCrmWorldBridge(exportedAt: string): CrmWorldBridgeFile {
  return {
    exported_at: exportedAt,
    crm_export_version: CRM_EXPORT_VERSION,
    accounts: {},
    contacts: {},
    deals: {},
  };
}

/** Populate bridge maps with 1:1 CRM ids (export uses same ids as SQLite). */
export function fillCrmWorldBridgeFromExport(
  bridge: CrmWorldBridgeFile,
  accounts: Account[],
  contacts: Contact[],
  deals: Deal[]
): CrmWorldBridgeFile {
  for (const a of accounts) {
    bridge.accounts[a.id] = { crm_account_id: a.id };
  }
  for (const c of contacts) {
    bridge.contacts[c.id] = { crm_contact_id: c.id, account_id: c.account_id };
  }
  for (const d of deals) {
    bridge.deals[d.id] = { crm_deal_id: d.id, account_id: d.account_id };
  }
  return bridge;
}

export interface WriteCrmWorldExportOptions {
  repo: SalesRepository;
  outPath: string;
  bridgePath?: string;
  exportedAt?: string;
}

/** Serializes CRM snapshot JSON (+ optional bridge). Creates parent dirs for `outPath` / `bridgePath`. */
export function writeCrmWorldExport(opt: WriteCrmWorldExportOptions): {
  root: CrmWorldExportRoot;
  bridge?: CrmWorldBridgeFile;
} {
  const exportedAt = opt.exportedAt ?? new Date().toISOString();
  const root = buildCrmWorldExportRoot(opt.repo, exportedAt);
  const dir = path.dirname(path.resolve(opt.outPath));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.resolve(opt.outPath), JSON.stringify(root, null, 2), 'utf8');

  let bridge: CrmWorldBridgeFile | undefined;
  if (opt.bridgePath) {
    const b = fillCrmWorldBridgeFromExport(
      buildCrmWorldBridge(exportedAt),
      opt.repo.listAccounts(),
      opt.repo.listContacts(),
      opt.repo.listDeals()
    );
    const bdir = path.dirname(path.resolve(opt.bridgePath));
    mkdirSync(bdir, { recursive: true });
    writeFileSync(path.resolve(opt.bridgePath), JSON.stringify(b, null, 2), 'utf8');
    bridge = b;
  }

  return { root, bridge };
}
