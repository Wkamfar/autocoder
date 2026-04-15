#!/usr/bin/env bash
# Automated smoke: decision engine + SalesAction policy + CRM SQLite schema (no API keys, no Discord).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export STATE_DIR="${STATE_DIR:-$ROOT/state}"
mkdir -p "$STATE_DIR"

bash "$ROOT/scripts/seed-sales-world.sh"

node dist/index.js sales top-decisions --limit 3 --json | node --input-type=module -e "
import fs from 'fs';
const s = fs.readFileSync(0, 'utf8');
const j = JSON.parse(s);
if (!j.decisions || !Array.isArray(j.decisions)) {
  console.error('top-decisions JSON missing decisions[]');
  process.exit(1);
}
if (j.decisions.length < 1) {
  console.error('top-decisions: expected at least one ranked deal from sample world');
  process.exit(1);
}
console.log('top-decisions ok:', j.decisions.length, 'row(s)');
"

node dist/index.js sales sales-action policy-eval \
  examples/sales-action.sample.json \
  examples/sales-action-context.sample.json

node "$ROOT/scripts/smoke-crm-sqlite.mjs"

echo "smoke-ci: all checks passed"
