import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSalesWorldShape } from '../scripts/validate-sales-world-shape.mjs';
import {
  mapCrmAccountToSales,
  mapCrmContactToSales,
  mapCrmDealToSales,
  mapCrmActivityToSales,
  buildCrmWorldExportRoot,
  CRM_EXPORT_VERSION,
} from '../dist/sales/world/crmWorldExport.js';

const nowMs = Date.parse('2026-04-15T12:00:00.000Z');

test('mapper: account → SalesAccount', () => {
  const a = {
    id: 'acc-1',
    name: 'Acme',
    domain: 'acme.com',
    segment: 'mid',
    owner_user_id: 'u1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
  const s = mapCrmAccountToSales(a);
  assert.equal(s.id, 'acc-1');
  assert.equal(s.name, 'Acme');
  assert.equal(s.owner, 'u1');
  assert.ok(s.notes?.includes('acme.com'));
});

test('mapper: contact without account_id → null', () => {
  assert.equal(
    mapCrmContactToSales({
      id: 'c1',
      created_at: 'x',
      updated_at: 'x',
    }),
    null
  );
});

test('mapper: deal → SalesDeal stage + name', () => {
  const accountById = new Map([
    [
      'acc-1',
      {
        id: 'acc-1',
        name: 'Beta LLC',
        created_at: 'x',
        updated_at: 'x',
      },
    ],
  ]);
  const d = {
    id: 'deal-1',
    account_id: 'acc-1',
    assigned_mode: 'primary_owner',
    deal_stage: 'qualification',
    last_contacted_at: '2026-04-10T12:00:00.000Z',
    created_at: 'x',
    updated_at: 'x',
  };
  const s = mapCrmDealToSales(d, accountById, nowMs);
  assert.equal(s.id, 'deal-1');
  assert.equal(s.account_id, 'acc-1');
  assert.equal(s.stage, 'qualification');
  assert.ok(s.name?.includes('Beta'));
  assert.equal(s.last_touch_days_ago, 5);
});

test('buildCrmWorldExportRoot uses repo lists + envelope', () => {
  const accounts = [
    {
      id: 'a1',
      name: 'Co',
      created_at: 'x',
      updated_at: 'x',
    },
  ];
  const contacts = [
    {
      id: 'c1',
      account_id: 'a1',
      email: 'x@co.com',
      full_name: 'Pat',
      created_at: 'x',
      updated_at: 'x',
    },
  ];
  const deals = [
    {
      id: 'd1',
      account_id: 'a1',
      assigned_mode: 'primary_owner',
      deal_stage: 'discovery',
      created_at: 'x',
      updated_at: 'x',
    },
  ];
  const activities = [
    {
      id: 'act1',
      activity_type: 'note',
      entity_type: 'deal',
      entity_id: 'd1',
      created_at: '2026-04-01T00:00:00.000Z',
    },
  ];
  const repo = {
    listAccounts: () => accounts,
    listContacts: () => contacts,
    listDeals: () => deals,
    listActivities: () => activities,
  };
  const root = buildCrmWorldExportRoot(repo, '2026-04-15T12:00:00.000Z');
  assert.equal(root.schema_version, '1');
  assert.equal(root.source, 'crm_snapshot');
  assert.equal(root.crm_export_version, CRM_EXPORT_VERSION);
  assert.equal(root.accounts.length, 1);
  assert.equal(root.deals[0].stage, 'discovery');
  const shape = validateSalesWorldShape(root);
  assert.equal(shape.ok, true, shape.errors?.join('; ') ?? '');
});

test('activity maps deal entity to deal_id + account_id', () => {
  const accountById = new Map([['a1', { id: 'a1', name: 'X', created_at: 'x', updated_at: 'x' }]]);
  const dealById = new Map([
    ['d1', { id: 'd1', account_id: 'a1', assigned_mode: 'x', deal_stage: 's', created_at: 'x', updated_at: 'x' }],
  ]);
  const contactById = new Map();
  const sa = mapCrmActivityToSales(
    {
      id: 'n1',
      activity_type: 'touch',
      entity_type: 'deal',
      entity_id: 'd1',
      created_at: '2026-04-01T00:00:00.000Z',
    },
    accountById,
    dealById,
    contactById
  );
  assert.equal(sa.deal_id, 'd1');
  assert.equal(sa.account_id, 'a1');
});
