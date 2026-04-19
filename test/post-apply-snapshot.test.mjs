import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPostApplyExportConfig } from '../dist/sales/world/postApplySnapshot.js';

test('getPostApplyExportConfig: disabled when env unset', () => {
  const prev = process.env.SALES_POST_APPLY_EXPORT_PATH;
  const prevB = process.env.SALES_POST_APPLY_BRIDGE_PATH;
  delete process.env.SALES_POST_APPLY_EXPORT_PATH;
  delete process.env.SALES_POST_APPLY_BRIDGE_PATH;
  assert.equal(getPostApplyExportConfig(), null);
  if (prev !== undefined) process.env.SALES_POST_APPLY_EXPORT_PATH = prev;
  if (prevB !== undefined) process.env.SALES_POST_APPLY_BRIDGE_PATH = prevB;
});

test('getPostApplyExportConfig: resolves paths when set', () => {
  const prev = process.env.SALES_POST_APPLY_EXPORT_PATH;
  const prevB = process.env.SALES_POST_APPLY_BRIDGE_PATH;
  process.env.SALES_POST_APPLY_EXPORT_PATH = '/tmp/ns-snapshot-test.json';
  process.env.SALES_POST_APPLY_BRIDGE_PATH = '/tmp/ns-bridge-test.json';
  const c = getPostApplyExportConfig();
  assert.ok(c);
  assert.equal(c.outPath, '/tmp/ns-snapshot-test.json');
  assert.equal(c.bridgePath, '/tmp/ns-bridge-test.json');
  if (prev !== undefined) process.env.SALES_POST_APPLY_EXPORT_PATH = prev;
  else delete process.env.SALES_POST_APPLY_EXPORT_PATH;
  if (prevB !== undefined) process.env.SALES_POST_APPLY_BRIDGE_PATH = prevB;
  else delete process.env.SALES_POST_APPLY_BRIDGE_PATH;
});
