# Agents 0-11 Deployment Status Summary

**Last Updated:** 2026-01-14  
**Source:** `wire2/WIRE2_BANK_GRADE_ROADMAP.md`

---

## Deployment Status Overview

| Agent | Name | Status | Deployed | Notes |
|-------|------|--------|----------|-------|
| **0** | Coordinator / CTO | 🟡 In Progress | Partial | Roadmap structure + docs shipped; numeric targets pending sign-off |
| **1** | UX/PM | ✅ Complete | ✅ Yes | Sign-off items delivered; ACs + route regression checks shipped |
| **2** | Frontend Polish | ✅ Complete | ✅ Yes | Frontend scope shipped; correctness gating + accessibility complete |
| **3** | Identity/IAM | 🟡 In Progress | Partial | Session substrate + OIDC path implemented; enterprise IAM (RBAC/SCIM) pending |
| **4** | Multi-Tenant Isolation | 🟡 In Progress | Partial | DB constraints complete; formal isolation proof pending Agent 0 sign-off |
| **5** | Security Hardening | 🟡 In Progress | Partial | CSP + rate limiting shipped; HSM/KMS + full pen test pending |
| **6** | Evidence/Audit | ✅ Shipped | ✅ Yes | End-to-end complete: intent event chain + signed bundles + exports + UI |
| **7** | Payments/Bank | 🟡 In Progress | Partial | Contracts + provider events shipped; full Plaid connectivity + execution pending |
| **7.1** | Plaid + Receipts | 🟡 In Progress | Partial | Receipt schema + signing shipped; real execution + SDK pending |
| **8** | Reliability/Jobs | ✅ P0 Complete | ✅ Yes | DB-backed job queue + worker + webhook delivery + DLQ shipped |
| **9** | Developer Platform | 🟡 In Progress | Partial | API keys + webhooks + docs shipped; SDK parity + quotas pending |
| **10** | QA/Release | 🟡 In Progress | Partial | CI gates + test docs shipped; staging-parity E2E pending |
| **11** | POSE On-Chain | 🟡 Contract Deployed | Partial | ✅ Contract deployed; ⏳ POSE Core + Wire2 config pending |

---

## Detailed Status by Agent

### Agent 0 — Coordinator / CTO
- **Status:** 🟡 In Progress
- **Deployed:** Partial (docs + structure)
- **Shipped:**
  - Bank-grade roadmap structure
  - Agent-0 "source of truth" docs
  - Evidence/compliance primitives with export surfaces
- **Pending:**
  - Finalize numeric targets (SLO/SLA/RPO/RTO)
  - CI gates enforcement
  - Release gates process

### Agent 1 — UX/PM
- **Status:** ✅ Complete
- **Deployed:** ✅ Yes
- **Shipped:**
  - Acceptance criteria template + critical flows + route inventory
  - Canonical status labels + paper cuts backlog
  - Top 5 flow ACs (Authenticate, Create Intent, Approve, Challenge/Proof, Execute)
  - Route regression check

### Agent 2 — Frontend Polish
- **Status:** ✅ Complete
- **Deployed:** ✅ Yes
- **Shipped:**
  - Correctness gating with permission/state checks
  - Voice onboarding hardening
  - A11y reliability (modal shell with focus trapping)
  - Table performance (client-side pagination)

### Agent 3 — Identity/IAM
- **Status:** 🟡 In Progress
- **Deployed:** Partial (session substrate)
- **Shipped:**
  - Session substrate + revocation UX
  - OIDC rollout path implemented
- **Pending:**
  - Enterprise IAM automation (RBAC mapping + SCIM)
  - Full evidence-grade audit coverage

### Agent 4 — Multi-Tenant Isolation
- **Status:** 🟡 In Progress
- **Deployed:** Partial (DB constraints)
- **Shipped:**
  - ✅ Extended org-scoped DB constraints to all intent-adjacent tables (29 composite FKs)
  - ✅ Static check preventing unscoped tenant reads
  - ✅ Expanded isolation tests for async/job handlers
- **Pending:**
  - Formal isolation proof (requires Agent 0 sign-off)

### Agent 5 — Security Hardening
- **Status:** 🟡 In Progress
- **Deployed:** Partial (CSP + rate limiting)
- **Shipped:**
  - ✅ Report-only CSP + reporting endpoint
  - ✅ Redis-backed rate limiting (per-org/per-user tiers)
- **Pending:**
  - HSM/KMS integration
  - Full pen test plan
  - WAF + DDoS protection

### Agent 6 — Evidence/Audit
- **Status:** ✅ Shipped
- **Deployed:** ✅ Yes
- **Shipped:**
  - ✅ Immutable audit log (intents): append-only + tamper-evident chain
  - ✅ Audit log viewer UI
  - ✅ Compliance exports: CSV/PDF + signed evidence bundles
  - ✅ Retention and legal hold
  - ✅ Evidence bundle generation + verification tooling
  - ✅ Key management (env-backed)
- **Pending:**
  - ⏳ Move signing keys into HSM/KMS (production)

### Agent 7 — Payments/Bank
- **Status:** 🟡 In Progress
- **Deployed:** Partial (contracts + events)
- **Shipped:**
  - ✅ Provider-event boundary (dedupe + replay-safe processing)
  - ✅ Plaid webhook verification
  - ✅ Transfer sync worker
- **Pending:**
  - Full Plaid connectivity (real execution)
  - Signed receipt integration

### Agent 7.1 — Plaid + Receipts
- **Status:** 🟡 In Progress
- **Deployed:** Partial (schema + signing)
- **Shipped:**
  - ✅ Signed receipt schema (JWS payload)
  - ✅ Key management for signing (v1)
  - ✅ Receipt issuance implementation
  - ✅ Verifier materials published
  - ✅ Plaid Link/Auth/Identity integration
  - ✅ Account ingestion + verification snapshot
- **Pending:**
  - Real Plaid Transfer execution connector
  - SDK wrapper (optional, deferred)

### Agent 8 — Reliability/Jobs
- **Status:** ✅ P0 Complete
- **Deployed:** ✅ Yes
- **Shipped:**
  - ✅ DB-backed job queue with retries/backoff/DLQ
  - ✅ Worker process (`npm run worker`)
  - ✅ Webhook delivery via async jobs
  - ✅ Prometheus job metrics
  - ✅ Admin visibility + replay tooling
  - ✅ Synthetic monitoring harness
  - ✅ Trace propagation baseline

### Agent 9 — Developer Platform
- **Status:** 🟡 In Progress
- **Deployed:** Partial (core primitives)
- **Shipped:**
  - ✅ API keys (routes + auth middleware)
  - ✅ Webhooks (routes + service + signing spec)
  - ✅ Developer docs (`wire2/docs/dev/*`)
- **Pending:**
  - SDK parity (Node first)
  - Per-tenant quotas + abuse controls
  - Sandbox mode polish

### Agent 10 — QA/Release
- **Status:** 🟡 In Progress
- **Deployed:** Partial (CI gates)
- **Shipped:**
  - ✅ CI gates (`.github/workflows/wire2-ci.yml`)
  - ✅ Release + test policy docs
- **Pending:**
  - Staging-parity E2E tests
  - Security scan gates (SAST/SCA/DAST)
  - Browser coverage expansion

### Agent 11 — POSE On-Chain
- **Status:** 🟡 Contract Deployed (Config Pending)
- **Deployed:** Partial
- **Shipped:**
  - ✅ EvidenceRegistry contract deployed: `0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9`
  - ✅ POSE Core endpoint: `/api/pose/anchors/intent-event`
  - ✅ Wire2 job queue integration: `pose.anchor_intent_event`
  - ✅ Wire2 worker handler
  - ✅ E2E test framework
- **Pending:**
  - ⏳ Configure POSE Core: Set `POSE_EVIDENCE_REGISTRY_ADDRESS` and restart
  - ⏳ Configure Wire2: Set `POSE_ANCHORING_ENABLED`, `POSE_CORE_HEALTH_URL`, `POSE_ANCHOR_API_URL`
  - ⏳ Start Wire2 worker to process anchoring jobs
  - ⏳ End-to-end verification (create intent → anchor on-chain → view on Blockscout)

---

## Summary Statistics

- **Fully Deployed (✅):** 3 agents (1, 2, 6, 8)
- **Partially Deployed (🟡):** 8 agents (0, 3, 4, 5, 7, 7.1, 9, 10, 11)
- **Not Started:** 0 agents

**Overall Progress:** ~40% fully deployed, ~60% in progress

---

## Next Steps

### Immediate (Agent 11)
1. Configure POSE Core backend with `POSE_EVIDENCE_REGISTRY_ADDRESS`
2. Configure Wire2 with anchoring environment variables
3. Start Wire2 worker
4. Verify end-to-end flow on Blockscout

### Short-term (P0 Items)
- Agent 0: Finalize numeric targets and CI gates
- Agent 3: Complete enterprise IAM (RBAC/SCIM)
- Agent 4: Formal isolation proof sign-off
- Agent 7.1: Real Plaid Transfer execution
- Agent 10: Staging-parity E2E tests

### Medium-term (P1/P2 Items)
- Agent 5: HSM/KMS integration + pen tests
- Agent 9: SDK parity + quotas
- Agent 10: Security scan gates

---

## References

- **Main Roadmap:** `wire2/WIRE2_BANK_GRADE_ROADMAP.md`
- **Agent 11 Setup:** `wire2/AGENT11_END_TO_END_SETUP.md`
- **Agent 11 Deployment:** `core/l1-protocol/AGENT11_DEPLOYMENT_COMPLETE.md`
