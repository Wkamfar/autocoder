#!/usr/bin/env bash
set -euo pipefail

# Verifies Agent 11 end-to-end on a droplet:
# - Wire2 API is reachable
# - Worker is configured for POSE anchoring
# - Creating an intent enqueues an anchor job and results in poseAnchorTxHash on IntentEvent
#
# Designed to run ON THE DROPLET (called via GitHub Actions SSH).

BASE_URL="${BASE_URL:-https://wire.pose.xyz}"
WIRE2_PATH="${WIRE2_PATH:-/opt/wire2}"
RESTART_STACK="${RESTART_STACK:-false}" # set true to rebuild/recreate backend+worker before verification

fail() { echo "[agent11-verify] FAIL: $*" >&2; exit 1; }
log()  { echo "[agent11-verify] $*"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

require_cmd curl
require_cmd python3
require_cmd docker

log "base_url=$BASE_URL"
log "wire2_path=$WIRE2_PATH"

cd "$WIRE2_PATH"

if [[ "$RESTART_STACK" == "true" ]]; then
  log "restart_stack=true: rebuilding/recreating wire-backend + wire-worker"
  docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build --force-recreate wire-backend wire-worker
fi

log "docker compose ps (wire2)"
docker compose --env-file .env.production -f docker-compose.prod.yml ps

log "checking /api/wire/health"
curl -fsS --max-time 10 "$BASE_URL/api/wire/health" >/dev/null

log "checking worker env for POSE_*"
docker exec -i wire2-worker-prod sh -lc 'printenv | egrep "^POSE_(ANCHORING_ENABLED|CORE_HEALTH_URL|ANCHOR_API_URL)=" || true'

POSE_ENABLED="$(docker exec -i wire2-worker-prod sh -lc 'printf "%s" "${POSE_ANCHORING_ENABLED:-}"' || true)"
[[ "$POSE_ENABLED" == "true" ]] || fail "POSE_ANCHORING_ENABLED is not true inside wire2-worker-prod (got: ${POSE_ENABLED:-<empty>})"

# Create an ephemeral org/admin so this can run unattended.
RUN_TAG="${GITHUB_RUN_ID:-$(date +%s)}"
ADMIN_EMAIL="agent11-ci+${RUN_TAG}@wire.pose.xyz"
ADMIN_PASS="ChangeMe123!"
ORG_NAME="POSE Wire (Agent11 CI ${RUN_TAG})"
ADMIN_NAME="POSE Agent11 CI"

log "signup (ephemeral org: $ORG_NAME)"
signup_json="$(
  curl -fsS --max-time 15 -X POST "$BASE_URL/api/signup" \
    -H 'content-type: application/json' \
    -d "{\"organizationName\":\"$ORG_NAME\",\"adminName\":\"$ADMIN_NAME\",\"adminEmail\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}"
)"

log "login"
login_json="$(
  curl -fsS --max-time 15 -X POST "$BASE_URL/api/auth/login" \
    -H 'content-type: application/json' \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}"
)"

TOKEN="$(python3 - <<'PY'
import json, sys
data=json.loads(sys.stdin.read())
tok=data.get("token")
if not tok:
  raise SystemExit("missing token in login response")
print(tok)
PY
<<<"$login_json")"

# Do not print token.

log "create beneficiary"
benef_json="$(
  curl -fsS --max-time 15 -X POST "$BASE_URL/api/wire/beneficiaries" \
    -H "authorization: Bearer $TOKEN" \
    -H 'content-type: application/json' \
    -d '{"displayName":"Pose Beneficiary CI","country":"US","railsAllowed":["ACH"],"bankLast4":"1234"}'
)"
BENEFICIARY_ID="$(python3 - <<'PY'
import json, sys
data=json.loads(sys.stdin.read())
bid=data.get("id")
if not bid:
  raise SystemExit("missing beneficiary id")
print(bid)
PY
<<<"$benef_json")"
log "beneficiary_id=$BENEFICIARY_ID"

log "create intent (should enqueue pose.anchor_intent_event)"
intent_json="$(
  curl -fsS --max-time 15 -X POST "$BASE_URL/api/wire/intents" \
    -H "authorization: Bearer $TOKEN" \
    -H 'content-type: application/json' \
    -H "x-idempotency-key: agent11-ci-${RUN_TAG}" \
    -d "{\"railsType\":\"ACH\",\"amountMinor\":\"10000\",\"currency\":\"USD\",\"beneficiaryId\":\"$BENEFICIARY_ID\",\"purpose\":\"Agent11 anchor CI\"}"
)"
INTENT_ID="$(python3 - <<'PY'
import json, sys
data=json.loads(sys.stdin.read())
iid=data.get("id")
if not iid:
  raise SystemExit("missing intent id")
print(iid)
PY
<<<"$intent_json")"
log "intent_id=$INTENT_ID"

# Poll events until intent.created has txHash or a terminal error.
log "polling intent events for poseAnchorTxHash (intent.created)"
tx=""
err=""
for i in $(seq 1 45); do
  events_json="$(curl -fsS --max-time 15 "$BASE_URL/api/wire/intents/$INTENT_ID/events" -H "authorization: Bearer $TOKEN")"
  read -r tx err < <(python3 - <<'PY'
import json, sys
events=json.loads(sys.stdin.read())
created=[e for e in events if e.get("eventType")=="intent.created"]
if not created:
  print("", "")
  raise SystemExit(0)
e=created[0]
print(e.get("poseAnchorTxHash") or "", e.get("poseAnchorLastError") or "")
PY
<<<"$events_json")

  if [[ -n "$tx" ]]; then
    log "OK tx_hash=$tx"
    log "Blockscout: https://explorer.testnet.pose.xyz/tx/$tx"
    break
  fi

  # If error is present, keep retrying briefly (worker backoff) but surface it in logs.
  if [[ -n "$err" ]]; then
    log "attempt $i: tx=<none> err=$err"
  else
    log "attempt $i: tx=<none> err=<none>"
  fi
  sleep 2
done

if [[ -z "$tx" ]]; then
  log "dumping recent Job rows for pose.anchor_intent_event"
  docker exec -i wire2-postgres-prod psql -U wire2_user -d "${POSTGRES_DB:-wire2}" -c \
    "select id,type,status,attempts,maxAttempts,runAt,lockedAt,lockedBy,lastError,createdAt from \"Job\" where type='pose.anchor_intent_event' order by createdAt desc limit 10;" || true
  log "dumping IntentEvent anchor fields"
  docker exec -i wire2-postgres-prod psql -U wire2_user -d "${POSTGRES_DB:-wire2}" -c \
    "select seq,\"eventType\",\"poseAnchorTxHash\",\"poseAnchorLastError\" from \"IntentEvent\" where \"intentId\"='${INTENT_ID}' order by seq asc;" || true
  log "tail worker logs"
  docker logs --tail 200 wire2-worker-prod || true
  fail "poseAnchorTxHash not observed within timeout"
fi

log "COMPLETE: Agent 11 anchoring end-to-end verified"

