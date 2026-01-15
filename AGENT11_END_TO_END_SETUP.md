# Agent 11: End-to-End Configuration Guide

**Complete setup for POSE on-chain anchoring of Wire2 intent events**

---

## ✅ Prerequisites (Already Complete)

- ✅ EvidenceRegistry contract deployed: `0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9`
- ✅ POSE Core backend endpoint: `/api/pose/anchors/intent-event`
- ✅ Wire2 job queue integration: `pose.anchor_intent_event` job type
- ✅ Wire2 worker handler: processes anchoring jobs

---

## Step 1: Configure POSE Core Backend

**Run on droplet:**

```bash
# Navigate to POSE Core
cd /opt/pose-core

# Set EvidenceRegistry address
echo "POSE_EVIDENCE_REGISTRY_ADDRESS=0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9" >> core/backend/.env

# Verify POSE Core has testnet config (check if these exist, add if missing)
grep -q "POSE_NETWORK_ENV=testnet" core/backend/.env || echo "POSE_NETWORK_ENV=testnet" >> core/backend/.env
grep -q "POSE_TESTNET_RPC_URL" core/backend/.env || echo "POSE_TESTNET_RPC_URL=https://sepolia.base.org" >> core/backend/.env
grep -q "POSE_TESTNET_PRIVATE_KEY" core/backend/.env || echo "# POSE_TESTNET_PRIVATE_KEY=0x..." >> core/backend/.env

# Restart POSE Core backend
docker compose restart pose-backend

# Wait for backend to be ready (check logs)
docker compose logs pose-backend --tail 50 | grep -i "initialized\|ready\|listening"
```

**Verify POSE Core is configured:**

```bash
# Test health endpoint
curl -fsS https://api.testnet.pose.xyz/health | jq .

# Test anchoring endpoint (should return 200, even if sequence check fails)
curl -X POST https://api.testnet.pose.xyz/api/pose/anchors/intent-event \
  -H "Content-Type: application/json" \
  -d '{
    "orgRef": "0x1111111111111111111111111111111111111111111111111111111111111111",
    "intentRef": "0x2222222222222222222222222222222222222222222222222222222222222222",
    "sequence": 1,
    "eventHash": "0x3333333333333333333333333333333333333333333333333333333333333333",
    "prevEventHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "source": "wire2"
  }' | jq .
```

Expected response (if configured correctly):
```json
{
  "ok": true,
  "txHash": "0x...",
  "contract": "0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9"
}
```

---

## Step 2: Configure Wire2 Backend

**Run on Wire2 deployment (wherever Wire2 backend runs):**

```bash
# Navigate to Wire2 backend directory
cd /path/to/wire2/backend

# Add POSE anchoring configuration to .env
cat >> .env << 'EOF'

# Agent 11: POSE On-Chain Anchoring
POSE_ANCHORING_ENABLED=true
POSE_CORE_HEALTH_URL=https://api.testnet.pose.xyz/health
POSE_ANCHOR_API_URL=https://api.testnet.pose.xyz/api/pose/anchors/intent-event
EOF

# Verify configuration
grep POSE_ANCHOR .env
```

**Environment Variables Required:**

- `POSE_ANCHORING_ENABLED=true` - Enables anchoring (default: false)
- `POSE_CORE_HEALTH_URL=https://api.testnet.pose.xyz/health` - Health check endpoint
- `POSE_ANCHOR_API_URL=https://api.testnet.pose.xyz/api/pose/anchors/intent-event` - Anchoring endpoint

---

## Step 3: Start Wire2 Worker

**The worker processes anchoring jobs. Run it continuously:**

```bash
# In Wire2 backend directory
cd /path/to/wire2/backend

# Start worker (runs continuously, processes jobs from queue)
npm run worker

# Or if using PM2/systemd:
# pm2 start npm --name "wire2-worker" -- run worker
# systemctl start wire2-worker
```

**Verify worker is processing jobs:**

```bash
# Check worker logs
tail -f logs/worker.log | grep -i "pose.*anchor"

# Or if using PM2:
pm2 logs wire2-worker | grep -i "pose.*anchor"
```

---

## Step 4: Verify End-to-End Flow

### 4.1 Create a Test Intent in Wire2

Use Wire2 API or UI to create an intent. The following events should trigger anchoring jobs:

- `intent.created` - When intent is first created
- `proof.received` - When voice proof is submitted
- `intent.approved` - When intent is approved
- `intent.executed` - When intent is executed
- `settlement.reported` - When settlement is reported

### 4.2 Check Intent Events Have Anchors

```bash
# Query Wire2 API for intent events (replace INTENT_ID)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://wire.pose.xyz/api/wire/intents/INTENT_ID/events | jq '.[] | {eventType, poseAnchorTxHash, poseAnchoredAt}'
```

Expected response should show `poseAnchorTxHash` for anchored events:
```json
[
  {
    "eventType": "intent.created",
    "poseAnchorTxHash": "0x...",
    "poseAnchoredAt": "2026-01-14T..."
  },
  {
    "eventType": "proof.received",
    "poseAnchorTxHash": "0x...",
    "poseAnchoredAt": "2026-01-14T..."
  }
]
```

### 4.3 Verify on Blockscout

For each `poseAnchorTxHash`, visit:
- https://explorer.testnet.pose.xyz/tx/0xTX_HASH

You should see:
- Transaction details
- `EventAnchored` event with:
  - `intentRef` (indexed)
  - `orgRef` (indexed)
  - `sequence`
  - `eventHash`
  - `prevEventHash`

### 4.4 View Contract on Blockscout

View the EvidenceRegistry contract:
- https://explorer.testnet.pose.xyz/address/0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9

You should see:
- Recent `EventAnchored` events
- Contract state (nextSequence, lastEventHash for each intentRef)

---

## Step 5: Monitor and Troubleshoot

### Check POSE Core Logs

```bash
# On droplet
cd /opt/pose-core
docker compose logs pose-backend | grep -i "anchor\|evidence" | tail -50
```

### Check Wire2 Worker Logs

```bash
# In Wire2 backend
tail -f logs/worker.log | grep -i "pose"
```

### Check for Failed Anchoring Jobs

```bash
# Query Wire2 database for events with errors
# (adjust connection string as needed)
psql $DATABASE_URL -c "
  SELECT 
    intent_id,
    seq,
    event_type,
    pose_anchor_tx_hash,
    pose_anchor_last_error,
    pose_anchored_at
  FROM intent_events
  WHERE pose_anchor_last_error IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 20;
"
```

### Common Issues

**1. "POSE_EVIDENCE_REGISTRY_ADDRESS not configured"**
- Fix: Set `POSE_EVIDENCE_REGISTRY_ADDRESS` in POSE Core `.env` and restart

**2. "Signer not initialized"**
- Fix: Ensure `POSE_TESTNET_PRIVATE_KEY` is set in POSE Core `.env`

**3. "POSE_CORE_NOT_READY"**
- Fix: Check POSE Core health endpoint is accessible
- Fix: Verify `POSE_CORE_HEALTH_URL` is correct in Wire2 `.env`

**4. "bad_sequence"**
- Fix: This is expected if events are out of order. The contract enforces strict sequence ordering.

**5. Jobs not processing**
- Fix: Ensure Wire2 worker is running (`npm run worker`)
- Fix: Check database connection and job queue table

---

## Step 6: Production Checklist

Before going to production:

- [ ] POSE Core backend has `POSE_EVIDENCE_REGISTRY_ADDRESS` set
- [ ] POSE Core has `POSE_TESTNET_RPC_URL` and `POSE_TESTNET_PRIVATE_KEY` configured
- [ ] Wire2 has `POSE_ANCHORING_ENABLED=true`
- [ ] Wire2 has `POSE_CORE_HEALTH_URL` and `POSE_ANCHOR_API_URL` configured
- [ ] Wire2 worker is running continuously (PM2/systemd)
- [ ] Test intent flow creates anchored events
- [ ] Anchored events visible on Blockscout
- [ ] Monitoring/alerting for failed anchoring jobs
- [ ] Database backup includes `intent_events` table with anchor fields

---

## Architecture Overview

```
Wire2 Intent Event
    ↓
IntentService/ProviderEvents enqueues job
    ↓
Job Queue: pose.anchor_intent_event
    ↓
Wire2 Worker processes job
    ↓
poseAnchoring.ts calls POSE Core
    ↓
POSE Core /api/pose/anchors/intent-event
    ↓
EvidenceRegistry.anchorEvent() on-chain
    ↓
Blockscout indexes EventAnchored event
    ↓
Verifiable on-chain evidence anchor ✅
```

---

## Related Documentation

- **Deployment**: `core/l1-protocol/AGENT11_DEPLOYMENT_COMPLETE.md`
- **Roadmap**: `wire2/WIRE2_BANK_GRADE_ROADMAP.md` (Agent 11 section)
- **Contract**: `core/l1-protocol/contracts/EvidenceRegistry.sol`
- **POSE Core Endpoint**: `core/backend/api/routes_pose_anchors.ts`
- **Wire2 Integration**: `wire2/backend/src/modules/pose/poseAnchoring.ts`

---

## Support

If anchoring fails:
1. Check POSE Core health: `curl https://api.testnet.pose.xyz/health`
2. Check Wire2 worker logs for errors
3. Verify environment variables are set correctly
4. Check Blockscout for recent transactions from the deployer address
