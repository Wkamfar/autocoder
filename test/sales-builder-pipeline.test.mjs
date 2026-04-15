import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

test('examples/public_feed.sample.json has items[]', () => {
  const p = path.join(root, 'examples/public_feed.sample.json');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(Array.isArray(data.items));
  assert.ok(data.items.length >= 1);
});

test('gen-milestone-csv outputs header + 100 rows', () => {
  const out = execSync('node scripts/gen-milestone-csv.mjs', { cwd: root, encoding: 'utf8' });
  const lines = out.trim().split('\n');
  assert.equal(lines.length, 101);
  assert.ok(lines[0].includes('company'));
  assert.ok(lines[1].includes('Milestone Test Co 1'));
});
