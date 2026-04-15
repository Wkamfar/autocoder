#!/usr/bin/env bash
# Offline regression gate: eval fixtures, decision ranking, policy, CRM DB, CSV import.
# No API keys, no Discord, no LLM calls.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export STATE_DIR="${STATE_DIR:-$ROOT/state}"
mkdir -p "$STATE_DIR"

WORLD="$ROOT/examples/sales-world.sample.json"
test -f "$WORLD"

echo "== sales world JSON shape (checked-in sample)"
node "$ROOT/scripts/validate-sales-world-shape.mjs" "$WORLD"

bash "$ROOT/scripts/seed-sales-world.sh"

echo "== pair-debate-eval validate (dossier fixtures)"
node dist/index.js sales pair-debate-eval validate

echo "== top-decisions (explicit world, --all avoids recommendation-threshold brittleness)"
node dist/index.js sales top-decisions --limit 15 --json --world "$WORLD" --all | node --input-type=module -e "
import fs from 'fs';
const s = fs.readFileSync(0, 'utf8');
const j = JSON.parse(s);
if (!j.decisions || !Array.isArray(j.decisions)) {
  console.error('top-decisions: invalid JSON shape');
  process.exit(1);
}
if (j.decisions.length < 1) {
  console.error('top-decisions: expected ≥1 scored deal for sample world');
  process.exit(1);
}
const d0 = j.decisions[0];
if (typeof d0.deal_id !== 'string' || !d0.deal_id.length) {
  console.error('top-decisions: missing deal_id');
  process.exit(1);
}
if (typeof d0.priority_index !== 'number' || Number.isNaN(d0.priority_index)) {
  console.error('top-decisions: missing priority_index');
  process.exit(1);
}
console.log('top-decisions ok:', j.decisions.length, 'rows; first:', d0.deal_id, 'priority', d0.priority_index);
"

echo "== sales-action policy-eval (samples)"
node dist/index.js sales sales-action policy-eval \
  examples/sales-action.sample.json \
  examples/sales-action-context.sample.json

echo "== CRM SQLite schema (v7 storage)"
node "$ROOT/scripts/smoke-crm-sqlite.mjs"

echo "== CSV → CRMEntitySource (v7 import path)"
node "$ROOT/scripts/smoke-csv-import.mjs"

echo "== Marketry canonical CSV (column contract + row count)"
node "$ROOT/scripts/validate-marketry-csv.mjs"

echo "smoke-ci: all checks passed"
