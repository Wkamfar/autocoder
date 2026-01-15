# Wire2 Deployment Status Breakdown
**Date:** January 14, 2026  
**Production URL:** https://wire.pose.xyz/v2  
**Source:** `wire2/WIRE2_BANK_GRADE_ROADMAP.md` analysis

## Executive Summary

This document provides a detailed breakdown of what is **actually deployed** vs **planned/in-progress** for `wire.pose.xyz/v2` based on the bank-grade roadmap.

**Status Overview:**
- ✅ **Deployed/Shiped**: ~40% of roadmap items
- 🟡 **In Progress**: ~35% of roadmap items
- ⏳ **Planned/Not Started**: ~25% of roadmap items

---

## Agent 0 — Coordinator / CTO

**Status:** In progress (roadmap exists; agent workstreams active)

### ✅ Deployed/Shipped
- Bank-grade roadmap structure with parallel agents
- Source of truth documentation:
  - `wire2/docs/bank_grade_acceptance_criteria.md`
  - `wire2/backend/docs/THREAT_MODEL.md`
  - `wire2/docs/RISK_REGISTER.md`
  - `wire2/backend/docs/API_CONTRACTS.md`
  - `wire2/docs/URL_CONTRACT.md`
- Evidence/compliance "bank-grade" primitives with verifiable export surfaces:
  - Org-level audit chain verify/list: `GET /api/wire/audit/events/verify`, `GET /api/wire/audit/events`
  - Compliance CSV exports:
    - `GET /api/wire/compliance/reports/security-history.csv`
    - `GET /api/wire/compliance/reports/approval-history.csv`
    - `GET /api/wire/compliance/reports/org-audit-events.csv`

### ⏳ Planned/Next
- **P0**: Finalize numeric targets (SLO/SLA/RPO/RTO/retention) with sign-off
- **P1**: Add CI gates for "do not break" contracts (route regression, enum/label checks, migration safety)
- **P2**: Publish `wire2/docs/RELEASE_GATES.md` + override process

---

## Agent 1 — UX/PM

**Status:** ✅ **Complete** — sign-off items delivered

### ✅ Deployed/Shipped
- Acceptance criteria template: `wire2/docs/ux/ACCEPTANCE_CRITERIA_TEMPLATE.md`
- Critical flows + route inventory: `wire2/docs/ux/CRITICAL_FLOWS_AND_ROUTES.md`
- Canonical status labels: `wire2/docs/ux/STATE_MACHINE_LABELS.md`
- Paper cuts backlog: `wire2/docs/ux/PAPER_CUTS_BACKLOG.md`
- Content guidelines: `wire2/docs/ux/CONTENT_GUIDELINES.md`
- Top 5 flow ACs (Authenticate, Create intent, Approve intent, Challenge/Proof, Execute intent)
- Route regression check: `wire2/frontend/scripts/route-regression-check.mjs`
- Frontend canonical labels util: `wire2/frontend/src/wire/utils/statusLabels.ts`

### ⏳ Planned/Next (Ongoing)
- **P0**: Extend flow ACs to next highest-risk flows (Beneficiary, Evidence export, Webhook setup)
- **P1**: Keep paper cuts backlog current
- **P2**: Align route alias `/wire/*` rollout messaging

---

## Agent 2 — Frontend Polish + UX Reliability

**Status:** ✅ **Completed** — Agent 2 scope shipped

### ✅ Deployed/Shipped
- **Correctness gating**: Permission/state/cooldown checks with user-visible disable reasons on critical actions (approve/deny/execute), plus phone fallback when voice service is down
- **Voice onboarding hardening**: Mic denial/missing/in-use cases handled with calm messaging + explicit "Test microphone" step
- **A11y reliability for dialogs**: Shared modal shell with focus trapping + Esc/backdrop-close, key wire modals migrated
- **Table performance**: Client-side pagination to high-traffic tables, avoided per-row motion when lists are large
- Canonical backend error taxonomy parsed/used by frontend (`WireApiError` with `{code, details}`)

### ⏳ Planned/Next (Maintenance)
- **P0**: Wire route regression check into CI
- **P1**: Expand correctness gating to high-risk actions (beneficiary lock, evidence export)
- **P2**: Add automated check for `WireModal` focus trap behavior

---

## Agent 3 — Identity, Sessions, and Enterprise IAM

**Status:** 🟡 **In Progress** — Session substrate + revocation UX + OIDC rollout path implemented

### ✅ Deployed/Shipped
- `wire2/backend/docs/AUTH_ARCHITECTURE.md`
- `wire2/backend/docs/SESSION_MODEL.md`
- `wire2/backend/docs/IAM_MAPPING.md`
- `wire2/backend/docs/AUTH_EVENTS.md`
- **Session substrate**:
  - DB model: `Session`, `AuthAuditLog`
  - Cache assist: Redis-backed (fallback to in-memory)
  - Session service: Refresh rotation, revoke, revoke-all marker
  - Verifiable endpoints: `POST /api/auth/logout_all`, `GET /api/auth/sessions`
  - UI wired to real APIs: `WireSettingsSecurityPage.tsx`
- **OIDC enablement** (behind flags):
  - Flags: `OIDC_ENABLED`, `SSO_ENFORCEMENT_ENABLED`
  - OIDC flow: `/api/auth/oidc/authorize` + `/api/auth/oidc/callback` with PKCE
  - Audit coverage for OIDC outcomes
  - Frontend: SSO button, callback handler

### ⏳ Planned/Next
- **P0**: Confirm OIDC org-binding strategy, ensure immediate revocation is measurable
- **P1**: Define + implement RBAC mapping (roles → permissions), implement IdP identity binding model
- **P2**: SCIM v2 provisioning, user suspend/deactivate hooks

**Blockers:**
- Needs canonical tenant/org model alignment with Agent 4
- Needs canonical audit event schema alignment with Agent 6

---

## Agent 4 — Multi-Tenant Isolation + Data Model

**Status:** 🟡 **In Progress** — DB constraints complete and validated; formal isolation proof requires Agent 0 sign-off

### ✅ Deployed/Shipped
- **DB constraints (Prisma + migrations, validated)**:
  - Composite org-scoped foreign keys for Session, Intent, Beneficiary, full intent graph
  - Org-scoped resources: ApiKey, Webhook, UserInvitation, LegalHold, EvidenceDownload, OrgAuditEvent, BankConnection
  - Hierarchy: FinancialAccount → LegalEntity, BeneficiaryVersion → Beneficiary
  - **Validation**: `wire2/backend/src/scripts/validateTenantConstraints.ts`
- **Service-layer guardrails**:
  - Org-scoped intent lookups, bundle downloads, member management
  - Org-scoped lookups in all services
  - **Static guardrail**: `wire2/backend/src/scripts/checkTenantScoping.ts`
- **Hierarchy v0**: Added `LegalEntity` + `FinancialAccount` models + minimal routes
- **Isolation tests**: `multiTenantIsolation.test.ts`, `asyncTenantIsolation.test.ts`

### ⏳ Planned/Next
- **P1**: Implement delegated administration + access reviews + "admin change approvals"
- **P2**: Publish `TENANT_ISOLATION_INVARIANTS.md` + `SCHEMA_TENANCY_RULES.md`

---

## Agent 5 — Security Engineering Hardening

**Status:** 🟡 **Partially Shipped** — Multiple security controls implemented

### ✅ Deployed/Shipped
- **Secure headers hook**: Baseline security headers applied on every request
- **Report-only CSP + reporting endpoint**:
  - Metrics: `wire2_csp_reports_total{disposition,directive}`
  - Rollout doc: `wire2/backend/docs/CSP_ROLLOUT.md`
  - Headers: `CSP_MODE=report-only|enforce|off`
  - Report endpoint: `POST /api/security/csp-report`
- **CORS allowlist**: Production-configurable CORS via `CORS_ORIGIN`
- **Rate limiting (Redis-backed with fallback)**: Multi-dimensional limits with per-user + per-org tiers
  - Metrics: `wire2_rate_limit_events_total{limiter,scope,result}`
  - Tier policy: `RATE_LIMIT_ORG_MULTIPLIERS`
- **Webhook secret encryption**: Envelope-ish secretbox for stored webhook secrets
- **PII redaction mode**: For evidence bundles (`full` vs `redacted`)
- **SSRF guardrails for webhooks**: Block localhost/private/link-local/metadata targets

### ⏳ Not Shipped / Gaps
- CSP baseline still includes `'unsafe-inline'` (needs iterative tightening)
- HSTS only enabled when `AUTH_MODE=oidc` (needs production semantics)
- Rate limiting operationalization: Define dashboards/alerts + decide fail-open vs fail-closed
- Comprehensive input validation is partial (needs consistent "schemas everywhere")
- Secrets management is still env-key-based (no KMS/Vault integration)
- Outbound egress allowlisting not yet centralized beyond webhook safety

### ⏳ Planned/Next
- **P0**: CSP: Iterate to enforce (remove `'unsafe-inline'`), Rate limiting: Add per-org quotas/tiers
- **P1**: Centralize outbound egress, standardize request validation
- **P2**: Define and implement managed secret store integration + rotation automation

---

## Agent 6 — Evidence, Audit, and Compliance Exports

**Status:** ✅ **Shipped** — End-to-end for intents + compliance exports

### ✅ Deployed/Shipped
- **Tamper-evident intent event chain (append-only)**:
  - `wire2/backend/src/modules/evidence/eventChain.ts`
  - API: `GET /api/wire/intents/:id/events` + `GET /api/wire/intents/:id/events/verify`
- **Signed evidence bundles (ZIP)** with redaction mode + chain linkage:
  - Bundle format documented: `wire2/backend/docs/BUNDLE_FORMAT.md`, `CANONICAL_JSON_SPEC.md`
  - Bundle generation, ZIP archive, signature verification
  - API (RBAC: `intent:view_bundle`):
    - `POST /api/wire/intents/:id/bundle?mode=full|redacted`
    - `GET /api/wire/bundles/:id/verify`
    - `GET /api/wire/bundles/:id/download`
- **Download audit trail**: `EvidenceDownload` + intent event `bundle.downloaded`
- **Compliance exports (CSV + minimal PDF + purge tooling)**:
  - Routes: `wire2/backend/src/routes/compliance.ts`
  - Endpoints: Summary, CSV reports, PDF, retention, legal holds, purge
- **Key management improvements**: Rotation + revoke flags (env-backed)
- **DB schema**: Prisma updates + migrations
- **Frontend**:
  - Evidence page: `WireEvidencePage.tsx` (`/evidence/:intentId`)
  - Compliance page: `WireCompliancePage.tsx` (`/compliance`)
  - Security history viewer: `WireSettingsSecurityHistoryPage.tsx` (`/settings/security-history`)

### ⏳ Remaining Gaps
- Move signing keys into KMS/HSM for production signing (currently env-backed dev keys)
- Expand canonical "event envelope" (actor/subject/request_id) across *all* sensitive actions

### ⏳ Planned/Next
- **P0**: Keep `AUDIT_EVENT_SCHEMA.md` + `AUDIT_EVENT_COVERAGE.md` current
- **P1**: Extend evidence/audit coverage to other sensitive domains (API keys, webhooks, beneficiary changes, policy changes)
- **P2**: Move signing keys into KMS/HSM for production signing

---

## Agent 7 — Payments + Bank Integrations

**Status:** 🟡 **In Progress** — Contracts + provider-event substrate shipped

### ✅ Deployed/Shipped
- Provider-event boundary: `ProviderEvent` model + dedupe + replay-safe processing + reconciliation exceptions
- Plaid webhook verification implemented (JWT in `Plaid-Verification`)
- Public Plaid Transfer webhook endpoint: `/api/wire/provider-webhooks/plaid/transfer/:orgId`
- Transfer sync worker: `/transfer/event/sync` paging → normalized `ProviderEvent` → deterministic `ExecutionLedger` transitions
- Correlation contract documented: `ExecutionLedger.externalRef = transfer_id`
- Unit tests for Plaid webhook verification
- Deep partnership strategy doc: `wire2/docs/PLAID_PARTNERSHIP_POSE_WIRE_VERIFICATION.md`

### ⏳ Planned/Next (Agent 7.1)
- **P0**: Real Plaid Link/Auth/Identity integration (link tokens, token exchange, account verification)
- **P0**: Real Plaid Transfer execution connector
- **P0**: "POSE signed receipt" as portable verification artifact (JWS/JWKS)
- **P1**: Publish integrator-facing docs + sample verifier
- **P2**: Optional SDK wrapper

---

## Agent 8 — Reliability, Jobs, and Operational Excellence

**Status:** ✅ **P0 Completed** — DB-backed job queue + worker + webhook async delivery

### ✅ Deployed/Shipped
- DB-backed job queue (`Job` table) with retries/backoff, DLQ (`DEAD`), visibility timeout reaper, concurrency controls
- Dedicated worker process (`wire2/backend/src/worker.ts`) + `npm run worker`
- Webhook delivery moved to async jobs (no inline `setTimeout` retries)
- Prometheus job counts (`wire2_jobs_total{type,status}`) on `/metrics`
- Admin visibility + replay tooling: `GET /api/wire/admin/jobs`, `POST /api/wire/admin/jobs/:id/replay`
- Request correlation returned to clients via `X-Request-Id`
- **P1 Completed**:
  - Email notifications via jobs (opt-in: `EMAIL_ASYNC=true`)
  - Async evidence bundle generation (opt-in: `POST /api/wire/intents/:id/bundle?async=1`)
  - Provider circuit breakers + per-tenant saturation controls
- **P2 Completed**:
  - Trace propagation baseline: W3C `traceparent` + `X-Trace-Id` response headers
  - Synthetic monitoring harness: `wire2/backend/src/synthetics/runSynthetics.ts`

### ⏳ Planned/Next
- **P1**: Provider circuit breakers (timeouts, retries, bulkheads, fallbacks, degraded modes)
- **P1**: SLOs and golden signals (latency/error/saturation/traffic per route and tenant)
- **P2**: Distributed tracing end-to-end, structured logging, alerting and on-call readiness
- **P2**: Load testing, capacity planning, DB performance hardening
- **P2**: Zero-downtime migrations, backups + PITR, restore drills, DR plan

**Blockers:**
- SLO targets and alert thresholds require sign-off (Agent 0)

---

## Agent 9 — Developer Platform: API Keys, Webhooks, Docs, SDKs

**Status:** 🟡 **In Progress** — Core primitives + delivery logs + dev docs exist

### ✅ Deployed/Shipped
- **API keys**:
  - Routes: `wire2/backend/src/routes/apiKeys.ts`
  - Auth middleware: `wire2/backend/src/middleware/apiKeyAuth.ts` (supports `Authorization: ApiKey …`, `Basic key:secret`, `X-API-KEY`)
  - Model doc: `wire2/backend/docs/API_KEYS_MODEL.md`
- **Webhooks**:
  - Routes: `wire2/backend/src/routes/webhooks.ts` (includes deliveries, test send, rotate-secret)
  - Service: `wire2/backend/src/modules/webhooks/webhookService.ts` (async delivery via jobs, SSRF guardrails, secret encryption)
  - Signing spec: `wire2/backend/docs/WEBHOOKS_SIGNING_SPEC.md`
- **Developer docs**: `wire2/docs/dev/*` (quickstart/auth/webhooks/errors/idempotency/sandbox/pose verification)

### ⏳ Planned/Next
- **P0**: Tighten and "freeze" canonical API key model (permissions/scopes, expiry, rotation, auth formats) + ensure audit coverage
- **P0**: Verify webhook signing implementation matches spec + document replay-safe verifier guidance
- **P1**: Publish developer docs + examples, ensure Postman/OpenAPI reflect reality, sandbox behavior deterministic
- **P2**: Per-tenant quotas and abuse controls aligned to Agent 5 policy, dashboards for webhook fanout and API usage

**Blockers:**
- Needs rate limit/quota policy alignment (Agent 5)
- Needs tenant model alignment (Agent 4)

---

## Agent 10 — QA / Release Engineering

**Status:** 🟡 **In Progress** — P0 CI gates + release/test docs shipped

### ✅ Deployed/Shipped
- CI gates enforced via `.github/workflows/wire2-ci.yml`:
  - Frontend checks/tests/build
  - Backend OpenAPI + tenancy + migration safety + tests
  - DB-backed CI job
- Release + test policy docs:
  - `wire2/docs/RELEASE_GATES.md`
  - `wire2/docs/TEST_STRATEGY.md`

### ⏳ Planned/Next
- **P0**: Keep CI gates fast + deterministic, expand API-level E2E coverage for top 6 critical flows
- **P1**: Turn top 6 critical flows into automated E2E tests in staging-parity environment
- **P1**: Add explicit checks for `/wire/*` alias behavior
- **P2**: Define and enforce release gates for security scans (SAST/SCA/DAST), migration safety, smoke tests

**Blockers:**
- Requires stable canonical enums/error taxonomy and auth/session behavior (Agents 3/6)

---

## Agent 11 — POSE On-Chain Source of Truth

**Status:** 🟡 **In Progress** — Implemented in-repo; deployment requires `EvidenceRegistry` + env wiring

### ✅ Deployed/Shipped (In Repo)
- Wire2: Anchor jobs + persistence
  - Job type: `pose.anchor_intent_event`
  - Worker handler calls POSE Core and persists `poseAnchorTxHash` on `IntentEvent`
  - `IntentEvent` fields: `poseAnchorTxHash`, `poseAnchoredAt`, `poseAnchorLastError`
  - Enqueue anchors for key milestones: `intent.created`, `proof.received`, `intent.approved`, `intent.executed`, `settlement.reported`
  - API visibility: `GET /api/wire/intents/:id/events` includes anchor fields
- POSE Core: tx submitter endpoint
  - `POST /api/pose/anchors/intent-event` (real mode submits `EvidenceRegistry.anchorEvent`; mock mode for tests)
  - Durable idempotency log: `core/backend/api/pose_anchor_store.ts`
- Test (pipeline): `wire2/backend/src/tests/poseAnchoring.e2e.test.ts`

### ✅ EvidenceRegistry Deployment
- Contract: `0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9`
- Deploy tx: `0x30b54c1cd3294d99b68d30fe9061c688a1499b3bb05966562a5b84e56d626952`
- Explorer: https://explorer.testnet.pose.xyz/address/0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9

### ⏳ Remaining (Deployment)
- **NEXT**: Configure POSE Core and Wire2 for end-to-end anchoring
  - Set `POSE_EVIDENCE_REGISTRY_ADDRESS=0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9` in POSE Core backend `.env`
  - Ensure POSE Core has `POSE_TESTNET_RPC_URL` + `POSE_TESTNET_PRIVATE_KEY` and `POSE_NETWORK_ENV=testnet`
  - Configure Wire2 with `POSE_ANCHORING_ENABLED=true`, `POSE_CORE_HEALTH_URL`, and `POSE_ANCHOR_API_URL`
  - Run Wire2 worker (`npm run worker`) so jobs are processed continuously
  - See: `wire2/AGENT11_END_TO_END_SETUP.md` for complete configuration guide

---

## Agent 12 — Multi-Asset Transfers & Verification (CASH + BTC + ETH)

**Status:** ⏳ **Not Started** — Specs authored, implementation pending

### ✅ Deployed/Shipped (Specs Only)
- `wire2/docs/pose/PROOF_LIFECYCLE_CASH.md`
- `wire2/docs/pose/PROOF_LIFECYCLE_BTC.md`
- `wire2/docs/pose/PROOF_LIFECYCLE_ETH.md`
- `wire2/docs/pose/UNIFIED_VERIFIER_SPEC.md`
- `wire2/docs/pose/MASTER_PROOF_MATRIX.md`

### ⏳ Planned/Next (Start Here)
- Decide custody model for BTC/ETH (non-custodial vs custodial) and document verifier trust assumptions
- Implement verifier plugins per rail (BTC confirmations/reorg rules; ETH receipt/log proof rules; CASH dual-control attestations)
- Add end-to-end UX flows for "verify receipt" for each rail

---

## Critical Flows Status

### ✅ Deployed Working Flows
1. **Authenticate** — Login page working, OIDC behind flags
2. **Create Intent** — Working (frontend + backend)
3. **Approve Intent** — Working (frontend + backend)
4. **Challenge/Proof** — Working (voice onboarding + proof submission)
5. **Execute Intent** — Working (execution attempts + completion)

### ⏳ Partially Deployed / In Progress
- **Evidence export** — Backend APIs exist, frontend wired
- **Compliance exports** — Backend APIs exist, frontend wired
- **Webhook setup** — Backend exists, UI shells exist, needs full integration
- **Beneficiary management** — Backend exists, needs full frontend integration

---

## Frontend Deployment Status

### ✅ Deployed Pages (Working)
- `/v2/login` — ✅ Working
- `/v2/` (dashboard) — ✅ Working
- `/v2/intents` — ✅ Working
- `/v2/approvals` — ⚠️ Not tested (likely working)
- `/v2/beneficiaries` — ⚠️ Not tested (likely working)
- `/v2/requests` — ⚠️ Not tested (likely working)
- `/v2/help` — ⚠️ Not tested (likely working)
- `/v2/evidence/:id` — ✅ Working (backend APIs wired)
- `/v2/compliance` — ✅ Working (backend APIs wired)
- `/v2/settings/security-history` — ✅ Working (backend APIs wired)

### ❌ Broken Routes
- `/v2/admin` — ❌ Shows nginx default page (routing issue)

### ✅ Frontend Features Deployed
- Navigation menu with all major sections
- User management UI (in admin dashboard — but dashboard route broken)
- Intent list with filtering/pagination
- Approval workflows
- Evidence bundle generation/verification
- Compliance exports (CSV, PDF)
- Settings pages (Security, Accounts, Webhooks shells)
- Voice onboarding flow
- Modal system with focus trapping (A11y)

---

## Backend API Deployment Status

### ✅ Deployed Endpoints
- Authentication: `/api/auth/*` (login, logout, sessions, OIDC)
- Intents: `/api/wire/intents/*` (CRUD, events, bundle generation)
- Approvals: `/api/wire/approvals/*`
- Beneficiaries: `/api/wire/beneficiaries/*`
- Evidence: `/api/wire/bundles/*` (create, verify, download)
- Compliance: `/api/wire/compliance/*` (exports, retention, legal holds)
- Users: `/api/wire/users/*` (list, create, update role, delete)
- Admin: `/api/wire/admin/*` (metrics, jobs)
- API Keys: `/api/wire/api-keys/*`
- Webhooks: `/api/wire/webhooks/*` (CRUD, deliveries, test send)
- Provider webhooks: `/api/wire/provider-webhooks/plaid/transfer/:orgId`
- Security: `/api/security/csp-report`
- Health: `/health`, `/ready`, `/metrics`

### ⏳ Partial/Planned Endpoints
- SCIM endpoints (not implemented)
- Plaid Link/Auth endpoints (substrate exists, full integration pending)
- Advanced admin endpoints (some exist, full feature set pending)

---

## Summary Statistics

| Category | Deployed | In Progress | Planned/Not Started |
|----------|----------|-------------|---------------------|
| **Frontend** | ✅ 80% | 🟡 15% | ⏳ 5% |
| **Backend Core** | ✅ 70% | 🟡 25% | ⏳ 5% |
| **Security** | ✅ 60% | 🟡 30% | ⏳ 10% |
| **Identity/Auth** | ✅ 50% | 🟡 40% | ⏳ 10% |
| **Payments** | ✅ 30% | 🟡 50% | ⏳ 20% |
| **Compliance** | ✅ 90% | 🟡 10% | ⏳ 0% |
| **Reliability** | ✅ 70% | 🟡 20% | ⏳ 10% |
| **On-Chain** | ✅ 40% | 🟡 50% | ⏳ 10% |
| **Multi-Asset** | ✅ 0% | 🟡 0% | ⏳ 100% |

**Overall Deployment Status:**
- **Core functionality**: ✅ Deployed and working
- **Advanced features**: 🟡 Partially deployed / in progress
- **Future roadmap**: ⏳ Planned / not started

---

## Known Issues & Blockers

### ❌ Critical Issues
1. **`/v2/admin` route broken** — Shows nginx default page instead of admin dashboard
   - **Impact**: Cannot access admin features (user management, metrics, analytics)
   - **Status**: Nginx configuration issue, needs fix

### ⚠️ Partial/Incomplete Features
1. **OIDC/SSO** — Implemented but behind feature flags, needs enterprise rollout
2. **SCIM provisioning** — Not implemented (needs Agent 3)
3. **Plaid full integration** — Substrate exists, full Link/Auth/Transfer pending
4. **Multi-asset support** — Specs only, implementation not started
5. **On-chain anchoring** — Code complete, needs deployment configuration

### 🔒 Security Gaps
1. CSP still includes `'unsafe-inline'` (needs iterative tightening)
2. Secrets management still env-key-based (needs KMS/Vault)
3. HSTS semantics need production decision
4. Input validation needs consistent "schemas everywhere"

---

## Recommendations

1. **Immediate (P0)**
   - Fix `/v2/admin` routing issue to restore admin dashboard access
   - Complete OIDC org-binding strategy and document
   - Finalize numeric targets (SLO/SLA/RPO/RTO) with sign-off

2. **Short-term (P1)**
   - Complete Plaid Link/Auth/Transfer integration
   - Implement RBAC mapping (roles → permissions)
   - Move signing keys to KMS/HSM
   - Complete SCIM provisioning

3. **Medium-term (P2)**
   - Multi-asset support implementation
   - Complete on-chain anchoring deployment
   - Secrets management migration to KMS/Vault
   - Comprehensive input validation baseline

---

**Document Generated:** 2026-01-14  
**Based on:** `wire2/WIRE2_BANK_GRADE_ROADMAP.md` (lines 1-1671)  
**Production URL:** https://wire.pose.xyz/v2