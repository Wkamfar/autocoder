#!/usr/bin/env bash
# Seed state/sales-world.json from the checked-in sample so Discord / CLI sales commands work.
# Idempotent: does not overwrite an existing world file.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SAMPLE="$ROOT/examples/sales-world.sample.json"
TARGET="$ROOT/state/sales-world.json"
mkdir -p "$ROOT/state"
if [[ ! -f "$SAMPLE" ]]; then
  echo "error: missing $SAMPLE" >&2
  exit 1
fi
if [[ -f "$TARGET" ]]; then
  echo "state/sales-world.json already exists — leaving unchanged (delete it to re-seed)"
  exit 0
fi
cp "$SAMPLE" "$TARGET"
echo "Seeded $TARGET from examples/sales-world.sample.json"
echo "Deal id for /debate: acme-expansion-2026 (see file)"
