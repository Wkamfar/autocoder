import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateSalesWorldShape } from '../scripts/validate-sales-world-shape.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

test('examples/sales-world.sample.json matches SalesWorld shape', () => {
  const p = path.join(root, 'examples/sales-world.sample.json');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const r = validateSalesWorldShape(data);
  assert.equal(r.ok, true, r.errors?.join('; ') ?? '');
});

test('examples/strategy-profile.sample.json is valid JSON', () => {
  const p = path.join(root, 'examples/strategy-profile.sample.json');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(data && typeof data === 'object');
});
