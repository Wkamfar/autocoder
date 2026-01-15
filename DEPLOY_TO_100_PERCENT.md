# Deploy Wire2 Agents 0–11 to **100% (P0 definition)**
**Definition of “100% deployed” used here:** every Agent 0–11 **P0** requirement is (1) merged in repo, (2) **enabled/configured in the target environment**, (3) **running (services + workers)**, and (4) **verifiable** via checks/synthetics.

If you instead mean “finish all P1/P2 roadmap items”, that is a larger buildout (SCIM, KMS/HSM, full staging-parity browser E2E, etc.). This doc gets you to the **bank‑grade P0 bar**.

---

## Pre-flight (single source of truth)
- **Target hosts**
  - Wire2: `https://wire.pose.xyz`
  - POSE Core: `https://api.testnet.pose.xyz`
  - Blockscout: `https://explorer.testnet.pose.xyz`
- **Agent 11 contract**
  - EvidenceRegistry: `0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9`

---

## Step 1 — Ensure Wire2 prod stack is running (backend + worker + DB + Redis)
On the Wire2 server (droplet):

```bash
cd /opt/wire2
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

**Must be running:**
- `wire2-backend-prod`
- `wire2-worker-prod` (critical for Agents 8/9/11)
- `wire2-postgres-prod`
- `wire2-redis-prod`

---

## Step 2 — Wire2 `.env.production` (P0 required knobs)
Edit `/opt/wire2/.env.production` and ensure (at minimum):

```bash
# CORS (Agent 5)
CORS_ORIGIN=https://wire.pose.xyz

# Redis (Agent 8/3/5) - should be enabled in prod
REDIS_URL=redis://redis:6379

# CSP rollout (Agent 5)
CSP_MODE=report-only

# Secrets encryption (Agent 5/9) - required for webhook secret storage/rotation in prod
WIRE2_SECRETS_ENCRYPTION_KEY=...   # base64url 32 bytes

# Evidence signing (Agent 6/7.1) - required for bundles/receipts in prod
SIGNING_PRIVATE_KEY=...            # base64url (32 or 64 bytes per docs)
SIGNING_PUBLIC_KEY=...
SIGNING_KEY_ID=prod_key_1

# Agent 11 (POSE anchoring)
POSE_ANCHORING_ENABLED=true
POSE_CORE_HEALTH_URL=https://api.testnet.pose.xyz/health
POSE_ANCHOR_API_URL=https://api.testnet.pose.xyz/api/pose/anchors/intent-event
```

Restart after edits:

```bash
cd /opt/wire2
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml restart wire-backend wire-worker
```

---

## Step 3 — Configure POSE Core for Agent 11 (on droplet)
On the POSE Core droplet:

```bash
cd /opt/pose-core
grep -q "POSE_EVIDENCE_REGISTRY_ADDRESS=" core/backend/.env || echo "POSE_EVIDENCE_REGISTRY_ADDRESS=0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9" >> core/backend/.env
docker compose restart pose-backend
```

**Hard requirement:** POSE Core must also have `POSE_NETWORK_ENV=testnet`, `POSE_TESTNET_RPC_URL`, and a funded `POSE_TESTNET_PRIVATE_KEY` configured (so it can submit txs).

---

## Step 4 — Verify “P0 deployed” (fast checks)
From any machine with curl:

```bash
bash wire2/scripts/verify_agents.sh https://wire.pose.xyz
```

---

## Step 5 — Verify end-to-end Agent 11 on-chain anchors (real proof)
1) Create a Wire2 intent (UI or API) and drive it through at least `intent.created`.
2) Confirm Wire2 persisted `poseAnchorTxHash` on the corresponding intent events.
3) Open the tx in Blockscout:
- `https://explorer.testnet.pose.xyz/tx/<poseAnchorTxHash>`

You should see `EventAnchored` emitted by:
- `0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9`

---

## Step 6 — Run synthetics (Agent 10 “prove it works” gate)
From CI (recommended) configure GitHub Actions secrets for `.github/workflows/wire2-synthetics.yml`:
- `SYNTHETIC_BASE_URL`
- `SYNTHETIC_USER_ID`
- `SYNTHETIC_APPROVER_ID`

Or run locally against the deployed environment:

```bash
cd wire2/backend
SYNTHETIC_BASE_URL="https://wire.pose.xyz" SYNTHETIC_USER_ID="..." SYNTHETIC_APPROVER_ID="..." npm run synthetics
```

---

## What “100%” still does **not** include (P1/P2)
If you want “100% of the entire roadmap”, the biggest remaining blocks are:
- **Agent 3**: SCIM v2 provisioning + issuer/subject identity binding model + deeper enterprise IAM automation
- **Agent 5/6/7.1**: move signing/secrets into **KMS/HSM** + rotation automation
- **Agent 10**: staging-parity browser E2E, SAST/SCA/DAST gating with hard fail + exception process

