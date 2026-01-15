#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://wire.pose.xyz}"

fail() { echo "[verify_agents] FAIL: $*" >&2; exit 1; }
pass() { echo "[verify_agents] OK: $*"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

require_cmd curl

echo "[verify_agents] base_url=$BASE_URL"

get_code() {
  curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$1" || echo "000"
}

assert_200() {
  local url="$1"
  local code
  code="$(get_code "$url")"
  [[ "$code" == "200" ]] || fail "expected 200 url=$url got=$code"
  pass "200 $url"
}

echo ""
echo "== Core liveness/readiness (Agent 8/10 baseline) =="
assert_200 "$BASE_URL/health"
assert_200 "$BASE_URL/ready"
assert_200 "$BASE_URL/metrics"

echo ""
echo "== Public verification materials (Agent 7.1) =="
assert_200 "$BASE_URL/.well-known/pose-jwks.json"
assert_200 "$BASE_URL/api/wire/keys/jwks"

echo ""
echo "== Security headers baseline (Agent 5) =="
headers="$(curl -sS -D - -o /dev/null --max-time 10 "$BASE_URL/health" || true)"

echo "$headers" | grep -qi '^x-content-type-options:' || fail "missing X-Content-Type-Options"
echo "$headers" | grep -qi '^x-frame-options:' || fail "missing X-Frame-Options"
echo "$headers" | grep -qi '^referrer-policy:' || fail "missing Referrer-Policy"
echo "$headers" | grep -qi '^content-security-policy' || fail "missing Content-Security-Policy / Content-Security-Policy-Report-Only"
pass "security headers present on /health"

echo ""
echo "== Agent 11 (anchoring) preflight =="
echo "[verify_agents] NOTE: This script does not create a real Wire2 intent; it only verifies the public surfaces."
echo "[verify_agents] Next: create an intent and confirm poseAnchorTxHash appears, then view tx in Blockscout."

echo ""
echo "[verify_agents] COMPLETE"

