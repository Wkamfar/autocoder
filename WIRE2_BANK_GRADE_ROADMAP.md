# WIREv2 “Bank‑Grade” Roadmap (wire.pose.xyz)

**Scope:** This roadmap is for **`/wire2`** (the deployed WIREv2 product at `wire.pose.xyz`).  
**Goal:** Improve end‑to‑end security, reliability, compliance, and UX **without breaking what already works**.

---

## Product Principles (Non‑Negotiable)

- **Do not break the working frontend**: the deployed UI is “fully functional” (see `wire2/COMPREHENSIVE_FRONTEND_TEST_REPORT.md`). Any changes must be backwards compatible or feature‑flagged.
- **Fail closed for money movement**: if identity, policy, evidence, or bank connectivity is degraded, the system must prevent execution or require step‑up controls (maker‑checker + cooldown).
- **Multi‑tenant by construction**: every read/write must be scoped by tenant/org and verified at multiple layers (API → service → DB).
- **Evidence is a first‑class product**: every sensitive action generates verifiable, tamper‑evident evidence with retention controls.
- **UX must be calm and unambiguous**: the UI must never imply something happened if it didn’t; all states must be explainable, recoverable, and consistent.

---

## Current State Snapshot (Wire2)

- **Frontend**: deployed and navigable; settings pages exist and render (including Security, Accounts, Webhooks UI shells).  
  - Reference: `wire2/COMPREHENSIVE_FRONTEND_TEST_REPORT.md`
- **Backend (Wire2)**: multi‑service architecture + ops scaffolding exists (health/ready/metrics, SLO docs, migration safety).  
  - References: `wire2/backend/README.md`, `wire2/README_OPERATIONS.md`, `wire2/backend/docs/SLOS_AND_ALERTING.md`
- **Auth mode**: demo/auth scaffolding exists; production target includes OIDC/SSO.  
  - References: `wire2/PRODUCTION_READY_CHECKLIST.md`, `wire2/PRODUCTION_READY_SUMMARY.md`

---

## “Bank‑Grade” Acceptance Criteria (define first; implement second)

Agent 0 owns final numbers and sign‑off, but the platform must explicitly define:

- **Availability**: SLOs for UI + API + execution paths; error budgets; maintenance windows.
- **Latency**: P95/P99 for login, list views, create intent, approve, execute, evidence export.
- **Durability**: DB + object storage durability guarantees; PITR; restore drills; RPO/RTO.
- **Auditability**: immutable audit/event chain + signed evidence bundles; verifiable exports; retention.
- **Fraud loss tolerance**: explicit tolerated loss rate, step‑up thresholds, kill switches, and monitoring.
- **Regulator expectations**: policy enforcement evidence, access reviews, change management, SOC2‑aligned controls.
- **Customer support SLAs**: severity definitions, response time, escalation workflows, support tooling with approvals.
- **Operational processes**: on‑call, runbooks, incident response, postmortems, change/release gates.

Deliverable: **`wire2/docs/bank_grade_acceptance_criteria.md`**.

---

## Formal Threat Model (must exist before “enterprise” claims)

Threat model must include:

- **Assets**: funds movement, bank tokens, credentials, sessions, voiceprints, audit bundles, API keys, webhook secrets.
- **Trust boundaries**: browser ↔ API gateway ↔ services ↔ DB/Redis ↔ storage ↔ external providers (IdP, bank, email).
- **Attacker goals**: fraud execution, beneficiary tampering, ATO, evidence tampering, exfiltration, denial of service.
- **Abuse cases**: phishing, magic‑link scanning, replay, tampering, fraud rings, insider threat, SSRF via integrations.
- **Mitigations**: technical + operational; residual risk tracked; “break‑glass” procedures.

Deliverable: **`wire2/backend/docs/THREAT_MODEL.md`**.

---

## Parallel Agent Workstreams (to avoid collisions)

### Agent 0 — Coordinator / CTO (Owner: Product + Architecture)

**Mission:** coordinate milestones, define acceptance criteria, prevent breaking changes.

- **Progress (2026-01-14)**
  - **Status**: In progress (roadmap exists; agent workstreams active; baseline hardening underway)
  - **Shipped**
    - Bank‑grade roadmap structure with parallel agents and collision avoidance rules
    - Agent‑0 “source of truth” docs created:
      - `wire2/docs/bank_grade_acceptance_criteria.md`
      - `wire2/backend/docs/THREAT_MODEL.md`
      - `wire2/docs/RISK_REGISTER.md`
      - `wire2/backend/docs/API_CONTRACTS.md`
      - `wire2/docs/URL_CONTRACT.md`
    - Evidence/compliance “bank-grade” primitives now have verifiable export surfaces:
      - Org-level audit chain verify/list: `GET /api/wire/audit/events/verify`, `GET /api/wire/audit/events`
      - Compliance CSV exports (auditor-friendly):
        - `GET /api/wire/compliance/reports/security-history.csv`
        - `GET /api/wire/compliance/reports/approval-history.csv`
        - `GET /api/wire/compliance/reports/org-audit-events.csv`
  - **Next**
    - **P0 (decision + sign‑off)**
      - Finalize **numeric targets** (SLO/SLA/RPO/RTO/retention) in `wire2/docs/bank_grade_acceptance_criteria.md` and record explicit sign‑off owners + review cadence
      - Decide the **/wire alias policy** (redirect vs rewrite) and where it is enforced (edge/CDN vs app server); record in `wire2/docs/URL_CONTRACT.md`
    - **P1 (enforcement)**
      - Add CI gates for “do not break” contracts:
        - Frontend route regression: `wire2/frontend/scripts/route-regression-check.mjs` (`npm run check:routes`)
        - Frontend enum/label drift check: `wire2/frontend/scripts/enum-labels-check.mjs` (`npm run check:labels`)
        - Backend migration safety checks: `wire2/backend/docs/MIGRATION_SAFETY.md`
      - Require API contract hygiene in PRs (error taxonomy, idempotency, enum stability) via `wire2/backend/docs/API_CONTRACTS.md` (coordinate Agent 10)
    - **P2 (operational readiness)**
      - Publish `wire2/docs/RELEASE_GATES.md` + “override with risk sign‑off” process (coordinate Agent 10)
  - **Blockers**
    - Requires consensus on final “bank‑grade” numeric targets (SLOs, RTO/RPO, retention) and which environments enforce them

- **Owns**
  - Product scope + bank‑grade acceptance criteria
  - Threat model sign‑off + risk register
  - Milestone gates and release checklist
  - Cross‑agent API contracts and schema/versioning rules
- **Guardrails**
  - All changes behind feature flags where feasible
  - No schema changes without expand/contract plan + migration safety review (`wire2/backend/docs/MIGRATION_SAFETY.md`)
  - No UI changes that remove working flows without replacement

**Deliverables**
- `wire2/docs/bank_grade_acceptance_criteria.md`: SLO/SLA/RPO/RTO + measurement method + sign-off owners
- `wire2/backend/docs/THREAT_MODEL.md`: assets, trust boundaries, abuse cases, mitigations, residual risk
- `wire2/docs/RISK_REGISTER.md`: risks, severity, owner, mitigation, review cadence, “accepted risk” expiry
- `wire2/backend/docs/API_CONTRACTS.md`: versioning rules, breaking-change policy, canonical enums/error taxonomy pointers
- `wire2/docs/URL_CONTRACT.md`: `/wire/*` aliases vs `/v2/*` base, redirects/rewrites, caching/CDN notes

**Acceptance criteria (coordination)**
- Every milestone has a **gate** with measurable pass/fail checks (no “looks good” launches)
- Breaking changes require: contract update + migration plan + feature flag + rollback plan + release note
- “Do not break” rules are enforced via CI checks (route contract tests, API contract tests, migration safety checks)

**Milestone gates (recommended)**
- **M0: Baseline hardening** (stability + observability + correctness)
- **M1: True identity** (OIDC/SSO, sessions, MFA policy, break‑glass)
- **M2: Multi‑tenant invariants** (service + DB constraints + tests)
- **M3: Evidence/compliance exports** (immutable audit + viewer + retention/holds)
- **M4: Integrations** (API keys, signed webhooks, onboarding, docs)
- **M5: Payments connectors** (bank linking, execution state machine, reliability)

**Update from Agent 5 (Security Engineering Hardening)**
- Shipped **report-only CSP + reporting endpoint** and **Redis-backed rate limiting with per-org/per-user tiers** (with fallback if `REDIS_URL` is not configured). See Agent 5 section for code pointers and tests.

---

### Agent 1 — UX/PM “Don’t Break What Works” (Owner: UX acceptance criteria + flows)

**Mission:** ensure end‑to‑end user experience is coherent, fast, and trustworthy.

- **Progress (2026-01-14)**
  - **Status**: Complete — sign-off items delivered (top flows ACs + route regression check + canonical status labels)
  - **Sign-off**: Complete
  - **Shipped**
    - Acceptance criteria template: `wire2/docs/ux/ACCEPTANCE_CRITERIA_TEMPLATE.md`
    - Critical flows + route inventory: `wire2/docs/ux/CRITICAL_FLOWS_AND_ROUTES.md`
    - Canonical status labels (enum → UI copy): `wire2/docs/ux/STATE_MACHINE_LABELS.md`
    - Paper cuts backlog (P0/P1/P2): `wire2/docs/ux/PAPER_CUTS_BACKLOG.md`
    - Content guidelines: `wire2/docs/ux/CONTENT_GUIDELINES.md`
    - Top 5 flow ACs:
      - Authenticate: `wire2/docs/ux/flows/AUTHENTICATE.md`
      - Create intent: `wire2/docs/ux/flows/CREATE_INTENT.md`
      - Approve intent: `wire2/docs/ux/flows/APPROVE_INTENT.md`
      - Challenge/Proof: `wire2/docs/ux/flows/CHALLENGE_PROOF.md`
      - Execute intent: `wire2/docs/ux/flows/EXECUTE_INTENT.md`
    - Route regression check (router↔docs↔base consistency): `wire2/frontend/scripts/route-regression-check.mjs` (run via `npm run check:routes`)
    - Frontend canonical labels util: `wire2/frontend/src/wire/utils/statusLabels.ts` (used by `IntentStatusBadge`)
  - **Notes**
    - URL alias (`/wire/*`) remains an ops/deploy concern (redirect/rewrite), but regression checks now ensure the `/v2/*` router + documented routes stay aligned.

- **Next (ongoing, not blocking the completed sign-off)**
  - **P0**
    - Extend flow ACs to the next highest-risk flows:
      - Beneficiary create/change/lock
      - Evidence export + verify evidence
      - Webhook setup + test delivery + delivery logs
  - **P1**
    - Keep `wire2/docs/ux/PAPER_CUTS_BACKLOG.md` current and mark P0 paper-cuts as shipped or blocked with owners
  - **P2**
    - Align route alias `/wire/*` rollout messaging with `wire2/docs/URL_CONTRACT.md` once ops implements redirect/rewrite

- **Deliverables**
  - UX acceptance criteria per critical flow (signup, login, create intent, approve, execute, export evidence, recover)
  - UX “paper cuts” backlog with severity (P0/P1/P2)
  - UX content guidelines: calm language, neutral step‑ups, no “scary” fraud copy in‑flow
- **Must cover**
  - Empty states, loading states, error clarity, retries, idempotent UX patterns
  - Accessibility (keyboard nav, focus traps, contrast, readable error messages)
  - Consistent “state machine” language across UI and API (DRAFT → PENDING_PROOF → …)
- **Non‑breaking rules**
  - Preserve existing routes and navigation structure (customer-facing aliases may include `/wire/*`; frontend build base is `/v2/*`)
  - Any new flows added as additive routes; avoid renaming existing URLs

---

### Agent 2 — Frontend Polish + UX Reliability (Owner: `wire2/frontend/`)

**Mission:** improve UX polish and correctness while keeping the current UI stable.

- **Progress (2026-01-14)**
  - **Status**: Completed (Agent 2 scope shipped in `wire2/frontend/`)
  - **Completed (in-repo)**
    - **Correctness gating**: permission/state/cooldown checks with user-visible disable reasons on critical actions (approve/deny/execute), plus phone fallback when voice service is down
    - **Voice onboarding hardening**: mic denial/missing/in-use cases handled with calm messaging + an explicit “Test microphone” step
    - **A11y reliability for dialogs**: added a shared modal shell with focus trapping + Esc/backdrop-close, and migrated key wire modals to it
    - **Table performance**: added client-side pagination to high-traffic tables and avoided per-row motion when lists are large
  - **Notes**
    - Canonical backend error taxonomy exists and is now parsed/used by the frontend (`WireApiError` with `{code, details}`), eliminating the previous “taxonomy blocker”.

**Key tasks (UX polish that commonly gets missed)**
- **Correctness gating**
  - UI must reflect backend permissions/states exactly; remove placeholders that imply functionality
  - Disable actions with specific reasons (permission, policy, cooldown, missing bank link, degraded services)
- **Flow hardening**
  - Voice onboarding: retries, device edge cases, microphone failures, clean fallback to phone
  - Settings: connect API keys/webhooks/policies pages to real backend data with safe empty states
- **Performance**
  - Avoid UI “jank” on large tables; pagination + skeletons; consistent toasts
- **Accessibility**
  - Focus management on modals; ARIA labels; keyboard shortcuts; visible focus rings

**Guardrails**
- No breaking route changes
- Feature flag new UI surfaces until backend is ready

**Deliverables**
- `wire2/docs/ux/FRONTEND_FEATURE_FLAGS.md`: feature flags inventory + usage guidelines
- `wire2/docs/ux/ROUTE_CONTRACT_REGRESSION.md`: route contract regression check (`npm run check:routes`)
- `wire2/docs/ux/FRONTEND_ERROR_TAXONOMY.md`: frontend mapping of canonical backend error codes/messages
- `wire2/docs/ux/A11Y_CHECKLIST.md`: focused a11y regression list (modals, focus traps, keyboard-only)

**Acceptance criteria**
- No customer-facing route regressions (explicit tests; links/bookmarks continue to work)
- UI never displays success unless backend confirms; idempotent retries are safe and user-visible
- All primary pages have coherent empty/loading/error states and do not “jank” on large datasets

- **Next (maintenance / follow-ups)**
  - **P0**
    - Wire the route regression check into CI (Agent 10) and keep docs/routes in sync
  - **P1**
    - Expand correctness gating to high-risk actions (beneficiary lock, evidence export) using `WireApiError.code` (never message parsing) — **completed in repo**
  - **P2**
    - Add a minimal automated check for `WireModal` focus trap behavior (unit/integration) to prevent regressions

---

### Agent 3 — Identity, Sessions, and Enterprise IAM (Owner: AuthN/AuthZ end‑to‑end)

**Mission:** replace demo auth with enterprise‑grade identity and lifecycle management.

**Progress (2026-01-14)**
- **Status**: In progress — session substrate + revocation UX + OIDC rollout path are implemented; remaining work is enterprise IAM automation (RBAC mapping + SCIM) and full evidence-grade audit coverage across all sensitive actions
- **Shipped**
  - `wire2/backend/docs/AUTH_ARCHITECTURE.md`
  - `wire2/backend/docs/SESSION_MODEL.md`
  - `wire2/backend/docs/IAM_MAPPING.md`
  - `wire2/backend/docs/AUTH_EVENTS.md`
  - Session substrate (DB + cache hooks) + verifiable session inventory:
    - DB model: `wire2/backend/prisma/schema.prisma` (`Session`, `AuthAuditLog`)
    - Cache assist: `wire2/backend/src/modules/security/sessionCache.ts` (Redis if `REDIS_URL`, else in-memory)
    - Session service: `wire2/backend/src/modules/security/session.ts` (refresh rotation, revoke, revoke-all marker)
    - Verifiable endpoints: `POST /api/auth/logout_all` (supports `includeCurrent`), `GET /api/auth/sessions` (`wire2/backend/src/routes/auth.ts`)
    - UI wired to real APIs: `wire2/frontend/src/wire/pages/WireSettingsSecurityPage.tsx`
  - OIDC enablement behind flags (do not break password/demo flows):
    - Flags: `OIDC_ENABLED`, `SSO_ENFORCEMENT_ENABLED` (`wire2/backend/src/modules/security/config.ts`, `wire2/backend/ENV_VARIABLES.md`)
    - OIDC flow: `/api/auth/oidc/authorize` + `/api/auth/oidc/callback` with PKCE + discovery (`wire2/backend/src/modules/security/oidc.ts`, `wire2/backend/src/routes/auth.ts`)
    - Audit coverage for OIDC outcomes: `oidc_authorize`, `oidc_callback_succeeded`, `oidc_callback_failed` (`wire2/backend/src/modules/security/audit.ts`)
    - Frontend completion:
      - SSO button: `wire2/frontend/src/wire/pages/WireLoginPage.tsx`
      - Callback handler: `wire2/frontend/src/wire/pages/WireOidcCallbackPage.tsx`
- **Next**
  - **P0 (tighten + verify “bank-grade” semantics)**
    - Confirm OIDC org-binding strategy (orgId in authorize state vs domain inference) and document it as the canonical rule
    - Ensure “immediate revocation” is measurable across instances (Redis enabled in production; add synthetic check for logout_all → 401)
  - **P1 (enterprise IAM)**
    - Define + implement RBAC mapping (roles → permissions) so UI gating is strictly server-truth (no `["*"]` shortcuts)
    - Implement IdP identity binding model (issuer+subject table) instead of email-only lookup
  - **P2 (automation + lifecycle)**
    - SCIM v2 provisioning for Users/Groups with idempotency, deprovision semantics, and audit events (coordinate Agent 6)
    - Implement user suspend/deactivate hooks that revoke sessions and prevent refresh/login immediately (coordinate Agent 4)
- **Blockers**
  - Needs canonical **tenant/org model + user lifecycle invariants** alignment with Agent 4 (invite/accept/suspend/deactivate/delete)
  - Needs canonical **audit event schema** alignment with Agent 6 (actor/subject/tenant/request_id + event chain)

**Deliverables**
- `wire2/backend/docs/AUTH_ARCHITECTURE.md` (new): OIDC/SAML/SCIM/session decisions + diagrams + threat notes
- `wire2/backend/docs/SESSION_MODEL.md` (new): token types, rotation, cookies/headers, revocation, idle/absolute timeouts
- `wire2/backend/docs/IAM_MAPPING.md` (new): groups→roles mapping rules, SCIM behavior, drift handling, break-glass policy
- `wire2/backend/docs/AUTH_EVENTS.md` (new): audit events emitted by auth/admin flows and required fields

**Recommended architecture (bank-grade defaults)**
- **OIDC-first for SSO**
  - Support IdPs: Okta / Azure AD / Google Workspace / Auth0 via standard OIDC (Authorization Code + PKCE)
  - Support **SAML** either directly or via IdP “SAML→OIDC” bridge; keep Wire2’s internal contract OIDC-shaped
- **Session model**
  - **Access token**: short-lived (e.g., 10–15m), scoped, includes `tenant_id`, `user_id`, `session_id`, `amr`, `acr`
  - **Refresh token**: opaque + **rotating**; stored server-side with per-device binding; compromised-token detection
  - **Transport**: prefer `HttpOnly` secure cookies for refresh + header bearer for access (avoid storing refresh in JS)
  - **Revocation**: server-enforced via `session_id` and revocation store; must propagate to all services immediately
- **Authorization**
  - RBAC baseline (e.g., `ORG_ADMIN`, `FINANCE_ADMIN`, `APPROVER`, `VIEWER`) with room for ABAC later
  - Policy checks are server-side only; UI reflects server truth (Agent 2 depends on this)
- **Lifecycle automation**
  - SCIM v2: user create/update/deactivate; group sync; idempotency keys; retries; tombstone semantics for deprovision
  - Account linking: allow multiple IdP identities per user with strict conflict rules and audit events
- **Break-glass**
  - Local “break-glass” admins only for SSO outage; hardware-key (WebAuthn) preferred; strict IP allowlist + paging alert
  - Mandatory rotation + periodic access review; “two-person rule” to enable break-glass when feasible

**Tasks (end-to-end)**
- **SSO login**
  - Implement OIDC login (Auth Code + PKCE), callback, CSRF/state/nonce, error UX, account linking, logout semantics
  - Org policy: “SSO required”, allowed domains, allowed IdPs, enforced MFA/assurance requirements
- **SCIM provisioning**
  - Implement SCIM v2 `/Users` + `/Groups`: create/update/deactivate, group sync, role mapping, retries, idempotency
  - Drift handling: reconcile out-of-band changes safely; never re-activate suspended users without explicit policy
- **Sessions & device posture**
  - Idle timeout + absolute timeout; refresh rotation; per-device sessions; revoke by device; “log out everywhere”
  - Session inventory API for UI: list sessions (device, last_seen, IP/ASN, created_at), revoke
- **MFA / step-up**
  - Enforce MFA via IdP claims where possible; otherwise implement in-app **step-up** for high-risk actions
  - Recovery codes + lockout policy; secure recovery (support workflow must be approval-gated + audited)
- **Conditional access**
  - IP allowlists, geo rules, risky device signals; “impossible travel” hooks (start with telemetry + alerts)
  - Degraded modes: if risk engine down, fail closed for execution/beneficiary changes
- **Scanner/bot defenses**
  - Magic-link scanning defense (if magic links exist): require user-entered code + one-time token binding + short TTL
  - Throttling and challenge steps (align with Agent 5 rate limiting + WAF posture)
- **Password auth (only if retained)**
  - Strong policy + breached-password checks + reset limits + notifications; prefer disabling when SSO is required

**Acceptance criteria**
- **Revocation**
  - Session revocation is **immediate and verifiable** (API + UI) across all services
  - No “orphan sessions” after user suspend/deactivate/delete; SCIM deprovision kills sessions within seconds
- **Auditability**
  - Audit log includes all auth/admin actions with **actor + tenant + request IDs** and is compatible with Agent 6’s evidence chain
  - Auth events include: login success/failure, MFA/step-up, session create/refresh/revoke, role change, SCIM changes, break-glass usage
- **Tenant safety**
  - Every token/session is tenant-bound; cross-tenant token reuse is impossible; org switching requires re-auth or explicit selection
- **Reliability**
  - Login + refresh survive normal deploys; rotation prevents replay; compromised refresh triggers session kill + alert

**Guardrails**
- Preserve existing “demo” auth paths behind feature flags until SSO cutover is complete
- Never rely on frontend-only gating for permissions/policy
- Any auth/session change must update threat model boundaries (Agent 0/5) and emit audit events (Agent 6)

---

### Agent 4 — Multi‑Tenant Isolation + Data Model (Owner: DB constraints + service guardrails)

**Mission:** prove multi‑tenant isolation formally (reads/writes cannot cross org boundaries).

- **Progress (2026-01-14)**
  - **Status**: In progress — **DB constraints complete and validated**, formal isolation proof requires Agent 0 sign-off
  - **Shipped (in repo, validated)**
    - **DB constraints (Prisma + migrations, validated)**: composite org-scoped foreign keys for:
      - `Session(userId, orgId) → User(id, orgId)`
      - `Intent(createdByUserId, orgId) → User(id, orgId)`
      - `Intent(beneficiaryId, orgId) → Beneficiary(id, orgId)`
      - Full intent graph: `VoiceChallenge`, `VoiceProof`, `Decision`, `ApprovalToken`, `IntentEvent`, `AuditBundle`, `Approval`, `ExecutionLedger` all tenant-scoped with composite FKs
      - Org-scoped resources bound to `User(id, orgId)`: `ApiKey`, `Webhook`, `UserInvitation`, `LegalHold`, `EvidenceDownload`, `OrgAuditEvent`, `BankConnection`
      - Hierarchy: `FinancialAccount(legalEntityId, orgId) → LegalEntity(id, orgId)`, `BeneficiaryVersion(beneficiaryId, orgId) → Beneficiary(id, orgId)`
      - Migrations: `20260114010000_agent4_multitenant_constraints_legal_entities/`, `20260114020000_agent0_tenant_proof_intent_graph_orgid/`, `20260114030000_tenant_constraints_webhook_delivery_legal_hold/`, `20260114040000_tenant_constraints_beneficiary_version/`
      - **Validation**: `wire2/backend/src/scripts/validateTenantConstraints.ts` (validates all 29 composite FKs; `npm run validate:tenant-constraints`)
    - **Service-layer guardrails** (reduce cross-tenant existence leaks):
      - Org-scoped intent lookups in `validateIntentAccess`, `getIntent`, and maker-checker checks
      - Org-scoped bundle download lookup (`AuditBundle` must belong to an intent in the caller org)
      - Org-scoped member-management lookups in org-groups
      - Org-scoped lookups in `apiKeyService`, `beneficiaryService`, `bundleVerification`, `intentService`, `performance`, `invitationService`, `webhookService`, `expireIntent`
      - **Static guardrail**: `wire2/backend/src/scripts/checkTenantScoping.ts` (wired to `npm run guard:tenancy`)
    - **Hierarchy v0 (schema + APIs)**:
      - Added `LegalEntity` + `FinancialAccount` models + minimal routes under `/api/wire/legal-entities/*`
    - **Isolation tests**:
      - `wire2/backend/src/tests/multiTenantIsolation.test.ts` (cross-tenant Intent/Session attempts must fail)
      - `wire2/backend/src/tests/asyncTenantIsolation.test.ts` (cross-tenant webhook delivery fails closed)
  - **Required before we can claim “formal isolation proof”**
    - Implement delegated administration + access reviews + “admin change approvals” (coordinate Agents 3/6)
  - **Blockers**
    - None for the foundational constraint layer; deeper enforcement needs coordinated migration sequencing across services

- **Next (make “formal isolation proof” true)**
  - **P0** ✅ **COMPLETE**
    - ✅ Extended org-scoped DB constraints to all intent-adjacent tables (29 composite FKs validated)
    - ✅ Added static check preventing unscoped tenant reads (`npm run guard:tenancy`)
    - ✅ Expanded isolation tests to cover async/job handlers (`asyncTenantIsolation.test.ts`)
  - **P1** (coordinate with Agents 3/6)
    - Implement delegated administration + access reviews + “admin change approvals”
  - **P2**
    - Publish `TENANT_ISOLATION_INVARIANTS.md` + `SCHEMA_TENANCY_RULES.md` and make them required reading for new endpoints

**Tasks**
- Formalize isolation invariants: every read/write scoped by org/entity; guardrails in service layer
- Add DB‑level constraints where feasible: composite keys, unique constraints per org, foreign keys, check constraints
- Implement entity hierarchy: **org → legal entities → accounts** (schema, APIs, admin UI boundaries, reporting rollups)
- Implement delegated administration: admin scopes, approvals for admin changes, audit logs
- Implement complete user lifecycle: invite/accept/deactivate/suspend/delete/reinstate; revoke sessions correctly
- Implement robust access reviews: periodic attestations, exports, completion tracking, remediation enforcement

**Testing requirement**
- Automated tests attempting cross‑tenant access must fail (service + DB)

**Deliverables**
- `wire2/backend/docs/TENANT_ISOLATION_INVARIANTS.md` (new): invariants + examples + “known footguns”
- `wire2/backend/docs/SCHEMA_TENANCY_RULES.md` (new): required columns/keys/index patterns per table type
- Multi-tenant “attack test suite” (automated): tries to read/write across org boundaries in every service
- `wire2/backend/src/scripts/validateTenantConstraints.ts`: validates all 29 composite FK constraints exist in migrations (`npm run validate:tenant-constraints`)
- Admin/support access policy doc (what support can do, approvals, and audit requirements; coordinate Agents 6/10)

**Acceptance criteria**
- Cross-tenant access tests fail deterministically at service boundary (and where feasible at DB boundary)
- No endpoint performs an unscoped query (static checks or query builder guardrails)
- User deactivate/suspend/delete immediately revokes sessions and prevents re-auth unless policy allows (coordinate Agent 3)

---

### Agent 5 — Security Engineering Hardening (Owner: platform security controls)

**Mission:** harden the platform against common web + API attacks and operational abuse.

**Progress (evidence-based; shipped vs not shipped)**
- **Shipped in `wire2/backend`**
  - **Secure headers hook**: baseline security headers applied on every request via `registerAuthHooks()` → `applySecureHeaders()`  
    - Code: `wire2/backend/src/modules/security/auth.ts`
    - Test: `wire2/backend/src/tests/securityHeaders.test.ts`
  - **Report-only CSP + reporting endpoint** (tighten toward enforce mode safely)
    - Metrics: `wire2_csp_reports_total{disposition,directive}` (Prometheus)
    - Rollout doc: `wire2/backend/docs/CSP_ROLLOUT.md`
    - Headers: `wire2/backend/src/modules/security/auth.ts` (`CSP_MODE=report-only|enforce|off`)
    - Report endpoint: `POST /api/security/csp-report` in `wire2/backend/src/routes/securityReports.ts`
    - Parser: `wire2/backend/src/app.ts` (accepts `application/csp-report` and `application/reports+json`)
  - **CORS allowlist**: production-configurable CORS via `CORS_ORIGIN` (default deny when unset)  
    - Code: `wire2/backend/src/app.ts`
  - **Rate limiting (Redis-backed with fallback)**: multi-dimensional limits with post-auth **per-user + per-org** tiers  
    - Code: `wire2/backend/src/modules/security/rateLimit.ts`, `wire2/backend/src/modules/security/auth.ts`, `wire2/backend/src/routes/auth.ts`
    - Unit test: `wire2/backend/src/modules/security/__tests__/rateLimitRedis.test.ts`
    - Metrics: `wire2_rate_limit_events_total{limiter,scope,result}` (Prometheus)
    - Tier policy: `RATE_LIMIT_ORG_MULTIPLIERS` + `RATE_LIMIT_DEFAULT_ORG_MULTIPLIER` (see `wire2/backend/docs/RATE_LIMITING_AND_ABUSE_POLICY.md`)
  - **Webhook secret encryption** (envelope-ish secretbox) for stored webhook secrets when key is present  
    - Code: `wire2/backend/src/lib/secretBox.ts`, `wire2/backend/src/modules/webhooks/webhookService.ts`
  - **PII redaction mode for evidence bundles** (`full` vs `redacted`)  
    - Code: `wire2/backend/src/modules/evidence/bundleArchive.ts`
- **Shipped by Agent 5 (this change-set)**
  - **SSRF guardrails for webhooks**: block localhost/private/link-local/metadata targets; re-check on delivery; disable redirects  
    - Code: `wire2/backend/src/lib/outboundUrlSafety.ts`, `wire2/backend/src/modules/webhooks/webhookService.ts`, `wire2/backend/src/routes/webhooks.ts`
    - Tests: `wire2/backend/src/tests/outboundUrlSafety.test.ts`
- **Not shipped yet / gaps (explicit)**
  - **CSP** baseline still includes `'unsafe-inline'` initially (needs iterative tightening based on collected reports)
  - **HSTS** only enabled when `AUTH_MODE=oidc` (decide production semantics and enforce consistently)
  - **Rate limiting operationalization**: define dashboards/alerts + decide fail-open vs fail-closed per endpoint class in production incidents
  - **Comprehensive input validation** is partial (some routes use Zod; needs consistent “schemas everywhere” baseline)
  - **Secrets management** is still env-key-based (no KMS/Vault integration + rotation automation yet)
  - **Outbound egress allowlisting** is not yet centralized beyond webhook safety

**Scope + boundaries (to avoid collisions)**
- **Owns**: appsec/platform hardening controls (headers/CSP, validation, rate limits, SSRF, secrets, crypto hygiene, PII minimization, vulnerability mgmt policy).
- **Does not own**:
  - Identity/IAM flows (Agent 3), except **security review** of auth/session design.
  - Tamper‑evident audit/evidence chain (Agent 6), except **event redaction + secure logging guidance**.
  - CI/CD implementation details (Agent 10), except **defining** required security gates + SLAs.

**Tasks (bank‑grade minimum bar)**
- **Web edge hardening**
  - Security headers baseline: **HSTS**, clickjacking protection, MIME sniffing protection, referrer policy, permissions policy
  - **CSP**: start with report‑only, iterate to enforce; include a CSP reporting endpoint + dashboards
  - **CORS**: default deny; per‑environment explicit allowlist; no wildcard with credentials; preflight cache sane
  - Cookies: `Secure`, `HttpOnly`, `SameSite` defaults; session cookie scope rules documented
  - Request limits: body size caps, header size caps, timeouts; consistent 4xx responses
- **Input validation + canonicalization**
  - Strict schemas on every request/response (single shared validation layer); reject unknown fields where possible
  - Canonicalize identifiers (case/trim/Unicode normalization) to prevent “duplicate identity” and ACL bypasses
  - Central error taxonomy: predictable error codes, no sensitive details in errors, consistent correlation IDs
- **Abuse prevention (rate limits + quotas)**
  - Tiered rate limiting: per **IP / user / org / endpoint class** (auth, read, write, export, webhook)
  - Adaptive throttling + burst control; safe allowlisting for internal systems; “fail closed” on critical write paths
  - Tenant quotas: export generation caps, webhook fanout caps, API key usage caps (align with Agent 9)
- **SSRF + outbound network controls** (webhooks, integrations, URL fetches)
  - URL validation with allowlists for schemes/ports; block internal ranges (v4/v6), link‑local, metadata endpoints
  - DNS rebinding defenses (resolve + pin + re‑resolve strategy); redirect handling policy
  - Egress policy: outbound requests go through a single hardened client with audit + timeouts + circuit breakers
- **Secrets + key management**
  - Secrets out of `.env`/files: move to **KMS/Vault/managed secret store** with access policy + audit
  - Rotation: documented schedule + automation hooks; emergency revoke playbook
  - Secret scanning + “no secrets in logs” enforcement; least‑privilege credentials per service
- **Encryption + data protection**
  - Data classification (PII/sensitive tokens/financial metadata/voice artifacts) with explicit storage rules
  - Envelope encryption for designated sensitive fields; KMS‑backed keys; rotation strategy + versioning
  - Backups encryption verified; restricted restore access; restore events are audited
- **PII minimization + logging hygiene**
  - PII inventory; remove unnecessary fields; strict retention; safe exports with redaction modes (coordinate with Agent 6)
  - Redaction middleware: never log auth tokens, bank tokens, webhook secrets, raw voice artifacts
- **Vulnerability management + incident readiness**
  - Severity rubric + remediation SLAs; triage workflow; exception process with expiry + owner
  - “Security runbooks”: credential leak, suspected ATO, suspected SSRF, webhook abuse, DDoS, data export anomaly
  - Pre‑prod penetration test plan and recurring cadence (partner with Agent 10)

**Deliverables (docs + baselines)**
- `wire2/backend/docs/SECURITY_BASELINE.md` (headers/CSP, CORS, cookies, timeouts, request limits)
- `wire2/backend/docs/SSRF_GUARDRAILS.md` (validation rules + outbound client policy)
- `wire2/backend/docs/RATE_LIMITING_AND_ABUSE_POLICY.md` (tiers, quotas, allowlists, “fail closed” rules)
- `wire2/backend/docs/SECRETS_AND_KEY_MANAGEMENT.md` (storage, rotation, emergency revoke)
- `wire2/backend/docs/DATA_CLASSIFICATION_AND_PII.md` (what is sensitive, where it may live, retention, logging rules)
- `wire2/backend/docs/VULNERABILITY_MANAGEMENT.md` (SLAs, triage, exceptions, disclosure path)

**Testing requirements (must be automated)**
- Abuse tests: rate limits enforce per dimension (IP/user/org), with clear response codes and retry hints
- SSRF tests: internal IP ranges + metadata endpoints + DNS rebinding attempts are blocked
- Header/CSP tests: required security headers present; CSP report‑only produces reports; enforce mode passes smoke suite
- Log redaction tests: “known sensitive markers” never appear in logs (tokens/keys/secrets)

**Recommended rollout (aligns to Agent 0 milestone gates)**
- **M0: Baseline hardening**
  - Headers/CORS/cookies/request limits in place
  - Rate limiting + basic quotas on the highest‑risk endpoints
  - Redaction middleware + “no secrets in logs” checks
- **M1: True identity (security review + controls)**
  - CSRF/state/nonce correctness review for auth flows; cookie/session attributes confirmed
  - Abuse defenses for login/token endpoints (throttling, bot posture, lockouts)
- **M2: Multi‑tenant invariants**
  - Canonicalization rules applied to tenant/user identifiers; validation layer is consistent across services
  - Hard proof that tenant scoping cannot be bypassed via parsing/normalization edge cases
- **M3+: Compliance posture**
  - Secrets + key management centralized; encryption posture documented; vulnerability management SLAs enforced

**Acceptance criteria (measurable)**
- No critical/high findings in baseline SAST/SCA/DAST runs for “bank‑grade” release candidate (exceptions require written risk sign‑off + expiry)
- All external/outbound URL fetches are routed through the hardened outbound client and are SSRF‑safe by default
- Rate limiting/quota policy is documented, enforced, and visible in metrics (per endpoint class + tenant)
- PII inventory exists; logs are redacted; retention policies are defined and applied
- Secrets are centrally managed (KMS/Vault/secret store), least‑privileged, and rotatable without downtime

- **Next (close the explicit gaps)**
  - **P0**
    - CSP: add report-only CSP with a simple reporting endpoint + dashboard/logging; iterate to enforce (remove `'unsafe-inline'`)
    - Rate limiting: migrate from in-memory to Redis-backed limiter for production and add per-org quotas/tiers
  - **P1**
    - Centralize outbound egress into one hardened client (beyond webhooks) with timeouts + allowlists + audit
    - Standardize request validation (schemas everywhere) and reject unknown fields where safe
  - **P2**
    - Secrets: define and implement managed secret store integration + rotation automation (coordinate Agent 10 for CI checks)

---

### Agent 6 — Evidence, Audit, and Compliance Exports (Owner: “court‑ready” evidence)

**Mission:** make audit logs tamper‑evident, exportable, and verifiable with retention/legal hold.

**Progress (2026-01-14)**
- **Status**: **Shipped (end-to-end for intents + compliance exports)** — tamper‑evident intent event chain + signed evidence bundles + verification + exports + retention/holds + UI wiring
- **Shipped (backend)**
  - **Tamper‑evident intent event chain (append‑only)**:
    - `wire2/backend/src/modules/evidence/eventChain.ts` (`appendIntentEvent`, `verifyEventChain`)
    - API: `GET /api/wire/intents/:id/events` + `GET /api/wire/intents/:id/events/verify`
  - **Signed evidence bundles (ZIP) with redaction mode + chain linkage**:
    - Bundle format + canonical JSON (already documented): `wire2/backend/docs/BUNDLE_FORMAT.md`, `CANONICAL_JSON_SPEC.md`
    - Bundle generation: `wire2/backend/src/modules/intents/intentService.ts` (`generateAuditBundle`)
    - ZIP archive + redaction: `wire2/backend/src/modules/evidence/bundleArchive.ts`
    - Signature verification: `wire2/backend/src/modules/evidence/bundleVerification.ts`
    - API (RBAC: `intent:view_bundle`):
      - `POST /api/wire/intents/:id/bundle?mode=full|redacted`
      - `GET /api/wire/bundles/:id/verify` (returns `valid` + `revoked` flag)
      - `GET /api/wire/bundles/:id/download` (presigned URL)
  - **Download audit trail (court‑ready “who exported evidence”)**:
    - DB: `EvidenceDownload` + intent event `bundle.downloaded`
    - Implementation: `wire2/backend/src/modules/evidence/downloadAudit.ts`
  - **Compliance exports (CSV + minimal PDF + purge tooling)**:
    - Routes: `wire2/backend/src/routes/compliance.ts`
    - Endpoints:
      - `GET /api/wire/compliance/summary?days=…`
      - `GET /api/wire/compliance/reports/approval-history.csv?days=…&verify=1`
      - `GET /api/wire/compliance/reports/security-history.csv?days=…`
      - `GET /api/wire/compliance/reports/audit-trail.pdf?days=…&watermark=CONFIDENTIAL`
      - `GET /api/wire/compliance/retention` + `PUT /api/wire/compliance/retention`
      - `GET /api/wire/compliance/legal-holds` + `POST /api/wire/compliance/legal-holds` + `POST /api/wire/compliance/legal-holds/:id/release`
      - `GET /api/wire/compliance/purge/preview` + `POST /api/wire/compliance/purge/run`
    - Helpers: `wire2/backend/src/lib/csv.ts`, `wire2/backend/src/lib/pdf/simplePdf.ts`
  - **Key management improvements (rotation + revoke flags; still env‑backed)**:
    - `wire2/backend/src/lib/keyManagement.ts` supports `SIGNING_KEY_ID`, `SIGNING_PUBLIC_KEYS_JSON`, `SIGNING_REVOKED_KEY_IDS`
- **Shipped (DB)**
  - Prisma schema updates: `wire2/backend/prisma/schema.prisma`
  - Migration: `wire2/backend/prisma/migrations/20260114010000_agent6_compliance_exports_retention/`
- **Shipped (frontend)**
  - **Evidence page now hits real APIs** (no mock bundle): `wire2/frontend/src/wire/pages/WireEvidencePage.tsx` (`/evidence/:intentId`)
  - **Compliance page exports + retention/holds UI**: `wire2/frontend/src/wire/pages/WireCompliancePage.tsx` (`/compliance`)
  - **Security history viewer + CSV export**: `wire2/frontend/src/wire/pages/WireSettingsSecurityHistoryPage.tsx` (`/settings/security-history`)
- **Remaining gaps (intentional / future hardening)**
  - Move signing keys into KMS/HSM for production signing (currently env‑backed dev keys)
  - Expand canonical “event envelope” (actor/subject/request_id) across *all* sensitive actions (Agents 3/4/7/9)

**Tasks**
- ✅ Immutable audit log (intents): append‑only model + tamper‑evident chain + verification
- ✅ Audit log viewer UI: event chain + security history viewer + drill‑down
- ✅ Compliance exports: CSV/PDF + signed evidence bundles (ZIP) + redaction + watermarking + download audit trails
- ✅ Retention and legal hold: retention policy + legal holds + purge workflow (admin‑gated)
- ✅ Evidence bundle generation: canonical payloads + policy pack + signatures + chain verification linkage
- ✅ Verification tooling: UI + API for bundle signature + event chain (+ decision verify endpoint)
- ✅ Key management: key IDs + rotation mapping + emergency revoke flags (env‑backed)
- ⏳ Move signing keys into HSM/KMS (do not store on disk) — **remaining**

**Deliverables**
- Implemented APIs + UI above; primary “how-to” lives in code paths + the existing bundle/docs references.
- Shipped (docs; keep current as coverage expands):
  - `wire2/backend/docs/AUDIT_EVENT_SCHEMA.md`
  - `wire2/backend/docs/AUDIT_EVENT_COVERAGE.md`

**Acceptance criteria**
- Every sensitive action emits an auditable event with actor/tenant/request_id and is included in the tamper-evident chain
- Evidence bundles are verifiable offline (or via a public verification endpoint) with clear failure reasons
- Legal hold and retention rules are enforced and audited (holds prevent deletion; purges are recorded)

- **Next (expand beyond “intents-only”)**
  - **P0**
    - Keep `AUDIT_EVENT_SCHEMA.md` + `AUDIT_EVENT_COVERAGE.md` current as Agents 3/4/7/9 expand event emission
  - **P1**
    - Extend evidence/audit coverage to other sensitive domains (API keys, webhooks, beneficiary changes, policy changes) (coordinate Agents 4/9)
  - **P2**
    - Move signing keys into KMS/HSM for production signing; document rotation + revoke process (coordinate Agent 5)

References to align with existing docs:
- `wire2/backend/docs/BUNDLE_FORMAT.md`
- `wire2/backend/docs/CANONICAL_JSON_SPEC.md`
- `wire2/backend/docs/EVENT_CHAIN_VERIFICATION.md`
- `wire2/backend/docs/SIGNING_KEY_MANAGEMENT.md`

---

### Agent 7 — Payments + Bank Integrations (Owner: money movement + connectors)

**Mission:** build a **bank‑grade money movement platform**: resilient bank connectivity + deterministic payment execution with a **provable ledger**, **idempotent APIs**, and **reconciliation you can audit**.

**Progress (2026-01-14)**
- **Status**: In progress (contracts + provider-event substrate shipped; full Plaid connectivity + real execution + signed receipt remain)
- **Next**
  - **P0 (contracts first)**
    - Choose provider(s) and document rails + webhook semantics + sandbox fidelity + portability constraints
    - Define payment domain model + state machines + idempotency keys (coordinate Agents 6/8)
  - **P1 (execution substrate)**
    - Implement execution attempt model + normalized provider events + reconciliation identifiers + exception queue semantics
  - **P2 (UX + degraded modes)**
    - Bank account linking + connection health UX with explicit degraded modes (read-only vs fail-closed for execution) (coordinate Agent 2)
- **Blockers**
  - Requires a finalized permissions/policy model for maker-checker, cooldowns, and step-up enforcement (Agents 3/4)

**Tasks**
- **Non‑negotiable invariants (bank‑grade bar)**
  - Ledger‑first: no external money movement occurs without a ledger journal entry + immutable audit event
  - Deterministic state machines per rail (ACH/wire/instant): explicit terminal states; explicit reversible/irreversible boundaries
  - Idempotency everywhere: all mutations are replay‑safe; provider retries and webhook replays are deduped by stable keys
  - Reconciliation is first‑class: every provider event maps to a normalized provider event → state transition → ledger posting
- **Provider strategy + due diligence**
  - Provider selection: sponsor bank/processor/direct API; contractual SLAs; support model; incident comms; rate limits; sandbox fidelity
  - Compliance requirements mapping: KYC/KYB ownership signals available, OFAC/watchlist hooks, reporting/statement availability
  - Portability plan: what data is portable (beneficiaries/intents/ledger) vs provider-locked (tokens, trace IDs); switch plan documented
- **Bank connectivity (Plaid‑class connector quality)**
  - Bank account linking: link sessions, token exchange, refresh/revoke, consent scope/expiry visibility, clear error states
  - Token lifecycle: KMS-encrypted storage, rotation, revoke, least privilege scopes, “break glass” response plan
  - Connection health model: last success, staleness thresholds, institution outage modes, backoff/retry policy, user prompts
  - Bank account model: capabilities, rail eligibility, currencies, ownership, nicknames, masking/tokenization, verification state
- **Data sync (integrity > “freshness theatre”)**
  - Balances & transaction sync: scheduled pulls + webhooks, backfill windows, pagination safety, strong dedupe and stable identity strategy
  - Normalized provider events: store raw payload (redacted) + normalized envelope + provider trace IDs; out-of-order delivery tolerance
- **Payment domain modeling**
  - Separate: Payment Intent (user wants) vs Payment Execution (attempts) vs Ledger Postings (source of truth)
  - Money representation: integer minor units + ISO currency; explicit rounding rules; forbid float usage in money paths
  - Beneficiary verification + change control: approvals, alerts, lock/unlock, proof of change, cooldown policies (coordinate Agents 3/4)
- **Execution (rail-by-rail)**
  - Pre-execution validation: rail eligibility, cutoffs, limits, beneficiary lock state, policy gates, step-up triggers
  - Initiation (ACH + wire): validate, submit, status tracking, cutoffs, idempotency keys, provider retries/timeouts, correlation IDs
  - Returns/recalls/reversals: represent as events; reason codes; ensure ledger mirrors reversals; clear user messaging
  - Fees/quotes display: cutoffs/settlement expectations, reversibility explanations, fees/FX (if applicable) with policy versioning
  - Batch payments + templates: CSV upload, validation preview, partial failure handling, per-line traceability, approvals, audit
- **Reconciliation + exception operations**
  - Matching engine: execution ↔ provider events ↔ settlement/statement artifacts ↔ ledger postings
  - Exception queue: unmatched/late/contradictory events; operator actions; full audit trail; replay tooling
  - Drift detection: “ledger vs provider truth” metrics; alert thresholds; runbooks
- **Maker‑checker everywhere (keep)**
  - No self‑approval for intents/beneficiaries/policies/API keys/webhooks/domains/users

**Deliverables**
- `wire2/backend/docs/PAYMENTS_DOMAIN_MODEL.md` (new): Intent vs Execution vs Ledger; core IDs; money types; invariants
- `wire2/backend/docs/PAYMENTS_STATE_MACHINE.md` (new): per-rail states, transitions, invariants, terminal states, retries, out-of-order events
- `wire2/backend/docs/IDEMPOTENCY_POLICY.md` (new): keys, scopes (per-org), time windows, replay handling, provider/webhook dedupe strategy
- `wire2/backend/docs/BANK_CONNECTIVITY_MODEL.md` (new): tokens, refresh/revoke, consent scopes, connection health, degraded UX rules
- `wire2/backend/docs/RECONCILIATION_AND_EXCEPTIONS.md` (new): matching strategy, exception queue ops, drift detection, reporting artifacts
- “Receipt” and evidence event spec per transition (coordinate Agent 6): what we emit, how to verify, what’s shown to end users

**Acceptance criteria**
- **Idempotency**: 0 duplicate executions under forced retries (client retries + job retries + provider webhook replays)
- **Auditability**: every state transition emits an immutable event + evidence payload (actor/tenant/request_id/trace IDs) (coordinate Agent 6)
- **Reconciliation**: 100% of settled/returned items matched to a ledger event within SLA (e.g., 24h), with exceptions routed to a queue
- **Explainability**: any payment can be reconstructed end-to-end (intent → approvals → execution attempts → provider events → ledger postings)
- **Fail-closed execution**: degraded connectivity prevents execution (unless explicitly allowed by policy) and surfaces clear remediation steps in UI
- **Security**: tokens are KMS-encrypted; secrets rotate without downtime; no sensitive data in logs; webhook signatures validated + replay-safe

---

### Agent 7.1 — Plaid Execution + “POSE Signed Receipt” (Verification Token) (Owner: payments + trust layer)

**Mission:** convert the current “bank-grade scaffolding” into a **real Plaid-backed execution + verification product**:

- Real Plaid connectivity (Link/Auth/Identity) + optionally Plaid Transfer (ACH P0)
- A portable, cryptographically verifiable **POSE-signed receipt** (JWS) for any instruction we control (ACH/wire)
- A clean path to “POSE Wire Verification” as a product that can be adopted by any Plaid integrator (without implying Plaid endorsement)

**What’s already shipped (2026-01-14, honest)**
- ✅ Provider-event boundary: `ProviderEvent` model + dedupe + replay-safe processing + reconciliation exceptions
- ✅ Plaid webhook verification implemented (JWT in `Plaid-Verification`, JWK fetch `/webhook_verification_key/get`, `iat` + `request_body_sha256`)
- ✅ Public Plaid Transfer webhook endpoint: `/api/wire/provider-webhooks/plaid/transfer/:orgId`
- ✅ Transfer sync worker: `/transfer/event/sync` paging → normalized `ProviderEvent` → deterministic `ExecutionLedger` transitions
- ✅ Correlation contract documented: `ExecutionLedger.externalRef = transfer_id` (required invariant)
- ✅ Unit tests for Plaid webhook verification
- ✅ Deep partnership strategy doc: `wire2/docs/PLAID_PARTNERSHIP_POSE_WIRE_VERIFICATION.md`

**What is *not* done yet (the gaps this Agent closes)**
- ✅ Real Plaid Link/Auth/Identity integration (link tokens, token exchange, account verification fetch, secure storage lifecycle)
- ✅ Real Plaid Transfer execution connector (create transfer with provider idempotency; set `ExecutionLedger.externalRef` to `transfer_id` immediately on success)
- ✅ “POSE signed receipt” as a portable verification artifact (JWS/JWKS, key rotation, verifier UX)

---

## Agent 7.1 Tasks (Milestone-based, bank-grade)

### Milestone A — Signed Receipt (“POSE Verification Token”) v1 (P0, 2–5 days)

**Goal:** produce a **portable, cryptographically signed receipt** that any verifier can validate without database access.

- ✅ **A1: Define the signed receipt schema (JWS payload)**
  - Include: `schema_version`, `orgId`, `intentId`, `executionRef`, `bindingHash`, `rail`, `amount{currency,minor}`, `beneficiaryHash`, `policyVersion`, `occurredAt`
  - Include: `evidence_chain_head` (hash) + `bundleId` (if bundle exists) + `bundleHash` (if available)
  - Include: `provider_correlation` (optional): `{ provider, externalRef, externalStatus }`
  - Include: `request_id`, `trace_id` for forensics; no PII in the signed payload
  - Define canonical JSON normalization rule for payload before signing

- ✅ **A2: Key management for signing (v1 “bank-grade dev”, v2 “bank-grade prod”)**
  - v1: env-backed signing keys with `kid` + explicit rotation support (already used elsewhere)
  - v2: KMS/HSM-backed signing keys (deferred to Agent 5/0, but design now)
  - Define: key rotation rules, revoke rules, “not before” semantics, emergency invalidate

- ✅ **A3: Implement receipt issuance**
  - Add backend service: `issuePoseVerificationToken({ orgId, intentId, executionRef }) -> { jws, kid, payload }`
  - Trigger issuance on:
    - `execution.attempted` (optional “attempt receipt”)
    - `execution.completed` (required)
    - `settlement.reported` / “confirmed” (required where applicable)
  - Ensure idempotency: same (orgId, executionRef, receiptType) returns same JWS or a deterministically re-issued equivalent (same canonical payload)

- ✅ **A4: Publish verifier materials**
  - `GET /.well-known/pose-jwks.json` (or `/api/wire/keys/jwks`) — list public keys + `kid`
  - `POST /api/wire/verify/pose-receipt` — optional server-side verification (returns reason codes)
  - Document a verifier cookbook (banks/partners): “verify signature + verify bindingHash + optionally fetch bundle”

- ✅ **A5: Add tests**
  - Unit tests: JWS signature verify, key rotation, payload canonicalization stability
  - Integration tests: execute → receipt minted → verify endpoint succeeds (DB optional if possible)

**Deliverables**
- `wire2/backend/docs/POSE_SIGNED_RECEIPT_SPEC.md` (new): schema, signing, key rotation, verifier rules, examples
- `wire2/docs/dev/pose-verification.md` (new): integrator quickstart

**Acceptance criteria**
- A third party can verify a receipt offline using JWKS + deterministic payload rules
- Receipt contains enough info to correlate to the evidence chain and (if present) the evidence bundle
- No PII is embedded in the signed payload; leakage risk documented

---

### Milestone B — Plaid Connectivity (Link + Auth/Identity) (P0, 3–7 days)

**Goal:** real bank linking + verification signals in a way that’s compatible with bank security reviews.

- ✅ **B1: Link session + token exchange**
  - Backend endpoints (multi-tenant safe):
    - `POST /api/wire/banks/plaid/link_token/create`
    - `POST /api/wire/banks/plaid/public_token/exchange`
  - Store tokens encrypted at rest (KMS-ready interface); never send access tokens to frontend

- ✅ **B2: Account ingestion + verification snapshot**
  - Fetch accounts + Auth/Identity summaries; store normalized, minimized snapshots:
    - `ownershipJson`, `verificationJson`, `railsEligible`, `currency`
  - Explicit “verification freshness”: timestamped; do not imply “verified forever”

- ✅ **B3: Connection health model**
  - Status transitions: ACTIVE/DEGRADED/REVOKED
  - Backoff/retry and user prompts for re-auth
  - Ops tools: list connections, force refresh, revoke

- ✅ **B4: Security + audit**
  - Every token lifecycle action emits org audit events (Agent 6)
  - Redaction rules for logs and evidence bundles

**Deliverables**
- `wire2/backend/docs/PLAID_CONNECTIVITY_IMPLEMENTATION.md` (new): endpoints, token storage, consent scopes, degraded UX
- Minimal UI hook plan for linking + connection status surfaces (coordinate Agent 2)

**Acceptance criteria**
- Linking works end-to-end in sandbox; tokens never leak to client; revocation works
- Connection health is observable; degraded mode prevents execution when policy requires fail-closed

---

### Milestone C — Plaid Transfer execution connector (ACH P0) (P0/P1, 5–10 days)

**Goal:** real money movement (ACH) with deterministic ledger + reconciliation.

- ✅ **C1: Implement Plaid Transfer create/submit**
  - Provider module: `plaidTransfer.execute({ intent, idempotencyKey }) -> { transfer_id, status }`
  - Enforce idempotency:
    - Wire2 `X-Idempotency-Key` must be present for production execution routes
    - propagate to provider idempotency fields

- ✅ **C2: Set correlation invariant (critical)**
  - On successful create:
    - set `ExecutionLedger.provider="plaid"`
    - set `ExecutionLedger.externalRef=transfer_id` **immediately**
  - Store provider request_id + relevant trace ids in `metadataJson`

- ✅ **C3: Failure taxonomy + UX semantics**
  - Distinguish:
    - validation errors (fail fast)
    - provider timeouts (unknown state → rely on sync/backfill)
    - hard failures (FAILED)
  - Map to user-facing statuses and operator-visible exceptions

- ✅ **C4: Reconciliation closure**
  - Ensure transfer events (`pending/posted/settled/returned/failed/cancelled`) deterministically update ledger
  - Ensure out-of-order/terminal conflicts produce `ReconciliationException` (never silently mutate)
  - Add reconciliation lag metrics (time since last event, has_more loops, cursor drift)

**Deliverables**
- `wire2/backend/docs/PLAID_TRANSFER_EXECUTION.md` (new): create/submit flow, idempotency, errors, correlation invariants
- ✅ Updated “critical flow #3” to include receipt issuance (docs/tests language aligned)

**Acceptance criteria**
- Under forced retries/timeouts, no duplicate transfers are created (idempotency proven)
- Every transfer event can be correlated to an execution via `transfer_id`
- `/transfer/event/sync` backfill recovers from missed webhooks without manual intervention

---

### Milestone D — “POSE Wire Verification” product packaging (P1/P2, 5–14 days)

**Goal:** make this usable by external integrators without needing Plaid partnership permission.

- ✅ **D1: Publish integrator-facing docs + sample verifier**
  - Node verifier package or snippet: verify JWKS + validate receipt schema
  - Example: “AP automation tool verifying a beneficiary change + maker-checker”

- ✅ **D2: Partner-safe marketing language**
  - No implication of Plaid endorsement
  - Data minimization: only derived signals in receipts unless terms/consent permit raw data sharing

- ⏳ **D3: Optional: SDK wrapper** (deferred)
  - “Verification issuance SDK”: wraps intent creation, approvals, receipt retrieval, verification

**Deliverables**
- `wire2/docs/dev/pose-wire-verification.md` (new): product framing + technical contract + legal-safe language

**Acceptance criteria**
- Any integrator can verify a POSE receipt with JWKS and optionally download evidence bundle for audits
- Packaging is clear, defensible, and does not require Plaid partnership to ship

---

### Agent 8 — Reliability, Jobs, and Operational Excellence (Owner: platform runtime)

**Mission:** make async work reliable; add golden signals + tracing; ensure safe releases and DR.

**Progress (2026-01-14)**
- **Status**: ✅ P0 completed (DB-backed job queue + worker + webhook async delivery + DLQ replay + job metrics)
- **Shipped**
  - DB-backed job queue (`Job` table) with retries/backoff, DLQ (`DEAD`), visibility timeout reaper, concurrency controls
  - Dedicated worker process (`wire2/backend/src/worker.ts`) + `npm run worker`
  - Webhook delivery moved to async jobs (no inline `setTimeout` retries); retries rescheduled via `runAt`
  - Prometheus job counts (`wire2_jobs_total{type,status}`) on `/metrics`
  - Admin visibility + replay tooling: `GET /api/wire/admin/jobs`, `POST /api/wire/admin/jobs/:id/replay`
  - Request correlation returned to clients via `X-Request-Id`
- **Next (P1/P2)**
  - **P1**
    - ✅ Extend job substrate to notifications/exports:
      - Email notifications via jobs (opt-in: `EMAIL_ASYNC=true`)
      - Async evidence bundle generation (opt-in: `POST /api/wire/intents/:id/bundle?async=1`)
    - ✅ Add provider circuit breakers + per-tenant saturation controls (starting with webhook delivery)
  - **P2**
    - ✅ Trace propagation baseline: W3C `traceparent` + `X-Trace-Id` response headers; webhook outbound includes `traceparent`
    - ✅ Synthetic monitoring harness for the 6 critical flows (Agent 10 can wire into CI): `wire2/backend/src/synthetics/runSynthetics.ts`
- **Blockers**
  - SLO targets and alert thresholds require sign-off (Agent 0)

**Tasks**
- ✅ Idempotency on mutating routes (baseline via middleware; expand coverage and add proofs per endpoint class)
- ✅ Outbox pattern for webhooks (delivery records + queued job are the durable source of truth)
- ✅ Background job system: queue, retries/backoff, DLQ, visibility timeouts, concurrency controls
- ✅ Job observability: metrics + DLQ dashboards (admin) + replay tooling
- Provider circuit breakers: timeouts, retries, bulkheads, fallbacks, degraded modes + user messaging
- SLOs and golden signals: latency/error/saturation/traffic per route and tenant
- Distributed tracing end‑to‑end (frontend → gateway → services → DB/external); sampling; PII redaction
- Structured logging: correlation IDs, redaction, retention
- Alerting and on‑call readiness: actionable paging + runbooks + postmortems
- Synthetic monitoring: login, voice enrollment, create intent, approve, execute, evidence export
- Load testing: auth storms, approvals bursts, webhook storms, export generation, provider degradation
- Capacity planning: DB/Redis/queue sizing, CDN/caching strategy (avoid cross‑tenant bleed)
- DB performance hardening: indexes, pagination, connection pooling
- Zero‑downtime migrations, backups + PITR, restore drills, DR plan (RTO/RPO)

**Deliverables**
- ✅ `wire2/backend/docs/JOBS_AND_OUTBOX.md`: required patterns, retry/backoff, DLQ semantics, replay rules
- ✅ `wire2/backend/docs/OBSERVABILITY_STANDARD.md`: required metrics/log fields/trace propagation + redaction rules
- ✅ `wire2/backend/docs/DEGRADED_MODE_POLICY.md`: what fails closed vs read-only, and required UX messaging hooks
- ✅ `wire2/backend/src/synthetics/runSynthetics.ts`: synthetic runner (6 critical flows scaffold) + `npm run synthetics`

**Acceptance criteria**
- All async jobs are replay-safe and observable (DLQ has a defined owner + replay procedure)
- Every request has correlation IDs (`X-Request-Id`) and trace IDs (`traceparent` / `X-Trace-Id`) across frontend→backend and backend→external calls
- DR readiness: restore drills executed on schedule; measured RTO/RPO meets acceptance criteria (Agent 0)

References:
- `wire2/README_OPERATIONS.md`
- `wire2/backend/docs/DISASTER_RECOVERY.md`
- `wire2/backend/docs/MIGRATION_SAFETY.md`
- `wire2/backend/docs/SLOS_AND_ALERTING.md`

---

### Agent 9 — Developer Platform: API Keys, Webhooks, Docs, SDKs (Owner: integrations)

**Mission:** make Wire2 integrable like Stripe (keys, webhooks, docs, sandbox).

**Progress (2026-01-14)**
- **Status**: In progress (core primitives + delivery logs + dev docs exist; remaining is SDK parity + tighter “bank-grade” policy/quotas)
- **Shipped (in repo)**
  - **API keys**
    - Routes: `wire2/backend/src/routes/apiKeys.ts`
    - Auth middleware: `wire2/backend/src/middleware/apiKeyAuth.ts` (supports `Authorization: ApiKey …`, `Basic key:secret`, `X-API-KEY`)
    - Model doc: `wire2/backend/docs/API_KEYS_MODEL.md`
  - **Webhooks**
    - Routes: `wire2/backend/src/routes/webhooks.ts` (includes deliveries, test send, rotate-secret)
    - Service: `wire2/backend/src/modules/webhooks/webhookService.ts` (async delivery via jobs, SSRF guardrails, secret encryption)
    - Signing spec: `wire2/backend/docs/WEBHOOKS_SIGNING_SPEC.md`
  - **Developer docs**
    - `wire2/docs/dev/*` (quickstart/auth/webhooks/errors/idempotency/sandbox/pose verification)
- **Next**
  - **P0 (correctness)**
    - Tighten and “freeze” **canonical API key model** (permissions/scopes, expiry, rotation, auth formats) + ensure audit coverage (coordinate Agent 6)
    - Verify webhook signing implementation matches `WEBHOOKS_SIGNING_SPEC.md` and document replay-safe verifier guidance + rotation runbook (coordinate Agent 8)
  - **P1 (DX)**
    - Publish developer docs + examples under `wire2/docs/dev/` and align SDK parity (Node first)
    - Ensure Postman/OpenAPI reflect reality and sandbox behavior is deterministic (coordinate Agent 10)
  - **P2 (commercial hardening)**
    - Per-tenant quotas and abuse controls aligned to Agent 5 policy; dashboards for webhook fanout and API usage
- **Blockers**
  - Needs rate limit/quota policy alignment (Agent 5) and tenant model alignment (Agent 4)

**Tasks**
- **Milestone A (Security correctness, 1–2 days)**
  - API keys: define “key material” (key vs secret), required auth header formats, expiry defaults, rotation semantics
  - Webhooks: store signing secret encrypted at rest; rotate without downtime; eliminate “hash-as-secret” in v1 scheme
  - Threat model notes: key leakage, webhook replay, tenant isolation boundaries (coordinate Agent 5/6)
- **Milestone B (Supportability + reliability, 2–3 days)**
  - Webhook delivery logs: list deliveries, per-attempt status/latency, next retry time, terminal failure reason
  - Test delivery: “Send test event” per webhook + UI surface
  - Retry policy: exponential backoff + max attempts; document semantics; move retry to job substrate when Agent 8 hardens queues
- **Milestone C (Developer experience, 2–4 days)**
  - Developer docs under `wire2/docs/dev/`: quickstart, auth, webhooks, errors, idempotency, cookbook examples
  - SDKs: Node SDK parity with auth + webhook verification; Python SDK stub + examples
  - Postman collection: include API key auth (Basic + ApiKey); include webhook management endpoints
- **Milestone D (Commercial hardening, depends on Agents 4/5/8)**
  - Per‑tenant quotas: API usage limits, webhook fanout caps, export rate limits; abuse controls + dashboards
  - Signed request option (optional, higher assurance): request signing with nonce/timestamp, replay cache, per-client keys
  - Sandbox mode polish: deterministic seeded data; mock voice; deterministic webhook payloads; stable error taxonomy

**Deliverables**
- `wire2/backend/docs/API_KEYS_MODEL.md` (new): permissions/scopes, expiry/rotation, auth formats, storage, leak guidance, audit events
- `wire2/backend/docs/WEBHOOKS_SIGNING_SPEC.md` (new): v1 signature scheme, headers, tolerance, replay rules, legacy fallback
- `wire2/docs/dev/*` (new): quickstart, auth, webhooks, errors, idempotency (+ examples)
- Webhook delivery log endpoints + UI hooks: `/webhooks/:id/deliveries`, `/webhooks/:id/test`, `/webhooks/:id/rotate-secret`
- SDK parity: Node SDK auth headers + webhook verification helper aligned to spec

**Acceptance criteria**
- **Key safety**: API keys are scoped, expirable, revocable; “last used” tracked; leak guidance documented; (production) secret-based auth supported
- **Webhook safety**: signatures verify using raw request body; timestamp tolerance enforced; secret rotation supported; replay guidance is explicit
- **Supportability**: delivery logs show status, attempts, response, and retry scheduling; “test delivery” is available from UI
- **Determinism**: sandbox/test endpoints produce documented, stable behaviors for critical flows (no “it depends”)

---

### Agent 10 — QA / Release Engineering (Owner: “we can only improve” gating)

**Mission:** ensure no regressions; make releases safe and measurable.

**Progress (2026-01-14)**
- **Status**: In progress — P0 CI gates + release/test docs are shipped; remaining is staging-parity E2E discipline + deeper browser coverage
- **Shipped (P0)**
  - CI gates enforced via `.github/workflows/wire2-ci.yml` (frontend checks/tests/build; backend OpenAPI + tenancy + migration safety + tests; DB-backed CI job)
  - Release + test policy docs:
    - `wire2/docs/RELEASE_GATES.md`
    - `wire2/docs/TEST_STRATEGY.md`
- **Next**
  - **P0**
    - Keep CI gates fast + deterministic; expand API-level E2E coverage for the top 6 critical flows without introducing flakes
  - **P1**
    - Turn the top 6 critical flows into automated E2E tests in a staging-parity environment
    - Add explicit checks for `/wire/*` alias behavior (redirect/rewrite) once ops config exists (coordinate Agent 0)
  - **P2**
    - Define and enforce release gates for security scans (SAST/SCA/DAST), migration safety, and smoke tests; document overrides and required sign-off
- **Blockers**
  - Requires stable canonical enums/error taxonomy and auth/session behavior to avoid flaky E2E tests (Agents 3/6)

**Tasks**
- Comprehensive E2E test suite for critical flows + multi‑tenant isolation tests
- Staging parity: prod‑like config, seeded tenants, safe test data, release gates
- Release safety: canary/blue‑green, quick rollback, feature flags, config validation
- Secure CI/CD: signed builds, SBOM, dependency scanning, secret scanning, protected branches
- SAST/DAST, pen testing program, vulnerability triage SLAs
- WAF + DDoS protection; infra least privilege; admin/support tooling (audited)
- Incident response: severity definitions, comms templates, escalation paths, action tracking

**Deliverables**
- `wire2/docs/RELEASE_GATES.md` (new): what must pass (tests, security scans, migration checks), with owners and overrides
- `wire2/docs/TEST_STRATEGY.md` (new): E2E vs integration vs unit, anti-flake rules, seeded data strategy
- Staging parity checklist (new doc): config, providers, feature flags, seeded tenants, safe test data

**Acceptance criteria**
- Any release can be rolled back quickly without data loss and without breaking auth/session continuity
- Critical flows have automated regression coverage; failures block release unless explicitly waived with risk sign-off
- Security and migration safety checks are enforced as gates (not “best effort”)

---

## UX‑First Critical Flows (must be end‑to‑end perfect)

1. **Signup → org created → admin onboarded**
2. **Invite user → accept → enroll voice → role enforced**
3. **Create intent → risk preview → approvals → execute → receipt**
4. **Beneficiary create/change → approval → lock/unlock → audit**
5. **Evidence export → verify evidence → retention/legal hold**
6. **Webhook setup → test delivery → delivery logs → retries**

Each flow must have: clear states, retry strategy, idempotency UX, meaningful errors, and safe degraded behavior.

---

### Agent 11 — POSE On‑Chain Source of Truth (Owner: POSE ledger anchoring + verification)

**Mission:** make the POSE blockchain the **ultimate end‑to‑end source of truth** for every Wire transaction lifecycle: intent → approvals → proofs → execution → settlement/receipt. Wire2 becomes a reference application built on POSE.

**Progress (2026-01-14)**

- **Status**: Implemented in-repo (Wire2 → POSE Core endpoint → persisted `txHash`); deployment requires `EvidenceRegistry` + env wiring
- **Shipped (in repo)**
  - **Wire2: anchor jobs + persistence**
    - New job type: `pose.anchor_intent_event` (`wire2/backend/src/jobs/jobTypes.ts`)
    - Worker handler calls POSE Core and persists `poseAnchorTxHash` on `IntentEvent` (`wire2/backend/src/modules/pose/poseAnchoring.ts`, `wire2/backend/src/worker.ts`)
    - `IntentEvent` fields + migration:
      - Prisma: `poseAnchorTxHash`, `poseAnchoredAt`, `poseAnchorLastError` (`wire2/backend/prisma/schema.prisma`)
      - Migration: `wire2/backend/prisma/migrations/20260114095000_agent11_pose_anchor_intent_events/`
    - Enqueue anchors for key milestones:
      - `intent.created`, `proof.received`, `intent.approved`, `intent.executed` (`wire2/backend/src/modules/intents/intentService.ts`)
      - `settlement.reported` is now emitted + anchored when provider settlement arrives (`wire2/backend/src/modules/payments/providerEvents.ts`)
    - API visibility: `GET /api/wire/intents/:id/events` includes `poseAnchorTxHash`/`poseAnchoredAt`/`poseAnchorLastError` (`wire2/backend/src/routes/wire.ts`)
  - **POSE Core: tx submitter endpoint**
    - `POST /api/pose/anchors/intent-event` (real mode submits `EvidenceRegistry.anchorEvent`; `POSE_ANCHOR_MODE=mock` returns deterministic tx hash for local/E2E tests)
      - Implementation: `core/backend/api/routes_pose_anchors.ts` (mounted in `core/backend/api/main.ts`)
    - Durable idempotency log: `core/backend/api/pose_anchor_store.ts` (`POSE_ANCHOR_LOG_PATH`)
  - **Test (pipeline)**
    - `wire2/backend/src/tests/poseAnchoring.e2e.test.ts` (stubs POSE Core, processes job, asserts txHash persisted; DB required)
- **Remaining (deployment)**
  - ✅ **COMPLETE**: Deploy `EvidenceRegistry` on POSE testnet
    - Contract: `0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9`
    - Deploy tx: `0x30b54c1cd3294d99b68d30fe9061c688a1499b3bb05966562a5b84e56d626952`
    - Explorer: https://explorer.testnet.pose.xyz/address/0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9
  - ⏳ **NEXT**: Configure POSE Core and Wire2 for end-to-end anchoring
    - Set `POSE_EVIDENCE_REGISTRY_ADDRESS=0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9` in POSE Core backend `.env` and restart
    - Ensure POSE Core has `POSE_TESTNET_RPC_URL` + `POSE_TESTNET_PRIVATE_KEY` and `POSE_NETWORK_ENV=testnet`
    - Configure Wire2 with `POSE_ANCHORING_ENABLED=true`, `POSE_CORE_HEALTH_URL`, and `POSE_ANCHOR_API_URL`
    - Run Wire2 worker (`wire2/backend`: `npm run worker`) so jobs are processed continuously
    - **See**: `wire2/AGENT11_END_TO_END_SETUP.md` for complete configuration guide

**Deploy EvidenceRegistry (exact commands)**

- In repo: `core/l1-protocol/` now contains:
  - Contract: `core/l1-protocol/contracts/EvidenceRegistry.sol`
  - Deploy script: `core/l1-protocol/scripts/deploy_evidence_registry.ts`
  - NPM script: `core/l1-protocol/package.json` → `npm run deploy:evidence-registry`

On the deploy machine (droplet recommended), run:

```bash
cd core/l1-protocol

# install deps (once)
npm ci

# required env (use your POSE testnet RPC + funded deployer key)
export POSE_TESTNET_RPC_URL="..."
export POSE_TESTNET_CHAIN_ID="84532"                 # if different, set accordingly
export POSE_TESTNET_DEPLOYER_PRIVATE_KEY="0x..."     # OR set POSE_TESTNET_PRIVATE_KEY="0x..."

# deploy
npm run deploy:evidence-registry
```

**✅ DEPLOYMENT COMPLETE** (2026-01-14)

Contract address: `0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9`

**Configure POSE Core (run on droplet):**

```bash
# Set EvidenceRegistry address
echo "POSE_EVIDENCE_REGISTRY_ADDRESS=0x40Ad19eE5314fA8debbbC7610Ff51a6e38D6ffd9" >> /opt/pose-core/core/backend/.env

# Restart POSE Core backend
cd /opt/pose-core
docker compose restart pose-backend
```

Then validate the endpoint:

```bash
curl -fsS https://api.testnet.pose.xyz/health >/dev/null
curl -fsS -X POST https://api.testnet.pose.xyz/api/pose/anchors/intent-event \
  -H 'content-type: application/json' \
  -d '{"orgRef":"0x1111111111111111111111111111111111111111111111111111111111111111","intentRef":"0x2222222222222222222222222222222222222222222222222222222222222222","sequence":1,"eventHash":"0x3333333333333333333333333333333333333333333333333333333333333333","prevEventHash":"0x0000000000000000000000000000000000000000000000000000000000000000","source":"wire2"}'
```

Finally, confirm Blockscout visibility by opening:

- `explorer.testnet.pose.xyz/tx/<txHash>`

**POSE API (real dependency)**

- **Testnet health**: `https://api.testnet.pose.xyz/health`
  - Agent 11 work should treat this as the **authoritative liveness/readiness signal** for POSE anchoring + verification pipelines.

**Non‑goals (explicit)**

- Do **not** put PII or bank tokens on-chain.
- Do **not** re-implement money movement on-chain; we **anchor evidence** and provide verifiable timelines.
- Do **not** require end users to manage chain private keys directly unless explicitly opted-in (use delegated/org keys).

**Core idea**

Every critical step emits a **verifiable evidence record** (canonical JSON → hashed commitment → signed) and then anchors that commitment onto POSE:

- “proof added” (e.g., voice challenge proof, maker approval, checker approval)
- “execution attempted”
- “execution completed / failed”
- “settled / returned / reversed”

POSE chain becomes the immutable, globally ordered **audit anchor**, while Wire2 stores full evidence bundles off-chain (encrypted/object storage) that can be verified against the on-chain commitments.

#### What “on-chain” actually stores (privacy-safe)

- **Commitments only**: `hash = sha256(canonical_json(evidence_envelope))`
- **Chain head**: per-transaction Merkle root or hash-chain head to prevent evidence removal/reordering
- **Minimal metadata**: version, orgId hash, intentId hash, event type, timestamp source, signer key id

No names/emails/amounts/bank details go on chain. Amount/currency can be optionally committed (hashed) but not revealed.

---

## Architecture (high-level)

**Off-chain evidence** (Wire2):

- Evidence envelope (canonical JSON)
- Signature set (org signing keys, device keys, approver keys)
- Full payload (redacted/full variants as already supported)
- Storage pointer (content-addressed)

**On-chain anchor** (POSE):

- Smart contract “EvidenceRegistry” (or equivalent)
- Events for append-only anchors + optional finalization markers
- Replay protection + monotonic sequence per intent/transaction

---

## Evidence model (must be standardized)

**Evidence envelope fields (minimum):**

- `version`
- `intentRef` (stable id; typically a hash, not the raw intent id)
- `orgRef` (hash of org id or org DID)
- `eventType` (enum)
- `sequence` (monotonic integer per intent)
- `createdAt` (RFC3339)
- `actor` (role + key id; no PII)
- `payloadCommitment` (hash of payload)
- `prevEventHash` (hash-chain for ordering)
- `eventHash` (hash of this envelope)

**Signatures:**

- At least 1 org signing key signature over `eventHash`
- Optional device/user signatures for step-up proofs
- Key rotation and revocation must be supported (on-chain key registry or referenced revocation list anchored on-chain)

Docs (new):

- `wire2/docs/pose/POSE_ONCHAIN_EVIDENCE_MODEL.md`
- `wire2/docs/pose/ONCHAIN_CONTRACT_SPEC.md`
- `wire2/docs/pose/PROOF_LIFECYCLE_WIRE_ACH.md`
- `wire2/docs/pose/MASTER_PROOF_MATRIX.md` (single source of truth: event types × rails × fields × signatures × anchoring × verifier rules)

---

## Master Proof Matrix (inline)

Canonical version lives at: `wire2/docs/pose/MASTER_PROOF_MATRIX.md`

**Rails shorthand**: `W`=WIRE, `A`=ACH, `C`=CASH, `B`=BTC, `E`=ETH

| Event type | Rails | Minimum payload fields (committed; never raw PII) | Required signatures | Anchor policy | Verifier rules (must check) |
|---|---|---|---|---|---|
| `intent.created` | W,A,C,B,E | `rail`, `amountCommitment`, `currencyCommitment`, `beneficiaryCommitment`, `policyRef` | org | Immediate | on-chain anchor exists; envelope hash-chain starts at seq=0; policyRef present |
| `intent.updated` (if allowed) | W,A,C,B,E | `changedFieldsCommitment`, `bindingHash`, `policyRef` | org + (checker if policy says) | Batch | update does **not** bypass binding/approval rules; verifier confirms update preceded re-approval if required |
| `beneficiary.bound` | W,A,B,E | `beneficiaryCommitment`, `beneficiaryVersionCommitment` | org + maker | Batch | beneficiary commitment matches later execution receipt commitments |
| `beneficiary.changed` | W,A,B,E | `prevBeneficiaryCommitment`, `newBeneficiaryCommitment`, `bindingHash` | org + maker + checker | Immediate | invalidates prior approvals (verifier requires `approval.invalidated` or re-approval events before execution) |
| `beneficiary.locked` | W,A,B,E | `beneficiaryCommitment`, `lockReasonCode` | org + checker | Batch | lock event exists before execution for high-risk policies |
| `custody.policy_applied` | C | `custodyPolicyRef`, `dualControlRequired`, `cooldownPolicyRef` | org + checker | Batch | verifier confirms policy exists before handoff attestations |
| `cash.handoff_attested` | C | `handoffCommitment`, `coarseLocationCommitment`, optional `mediaCommitment` | org + **2 distinct human signers** | Immediate | verify two signer keyIds are distinct; timestamps monotonic; chain integrity |
| `cash.custody_checkpoint` | C | `checkpointCommitment` | org + custodian | Batch | optional unless policy requires; if required, verifier ensures cadence satisfied |
| `cash.deposit_receipt_attested` | C | `depositSlipCommitment`, `depositoryRefCommitment`, `discrepancyCommitment` | org + checker | Immediate | verifier checks discrepancy resolution if non-zero |
| `cash.discrepancy_reported` | C | `discrepancyCommitment`, `reasonCode` | org + checker | Immediate | verifier requires follow-up `cash.discrepancy_resolved` before `SETTLED` |
| `cash.discrepancy_resolved` | C | `resolutionCommitment`, `resolutionCode` | org + checker | Batch | verifier confirms settlement allowed post-resolution |
| `proof.requested` | W,A,C,B,E | `requiredChallengeLevel`, `proofTypeCommitment` | org | Batch | verifier ensures required level matches later `proof.verified` |
| `proof.submitted` | W,A,C,B,E | `proofArtifactCommitment`, `deviceAttestationCommitment` (if any) | org + user/device (if applicable) | Batch | verifier checks proof hash matches stored bundle; no raw voice on-chain |
| `proof.verified` | W,A,C,B,E | `resultCode`, `riskSignalsCommitment` | org | Immediate (for execution gating) | verifier checks verified exists before approvals/execution when policy requires |
| `approval.added` | W,A,C,B,E | `approvalRole` (maker/checker), `approvalOutcome`, `bindingHash` | org + human signer | Immediate for “final approval”, otherwise Batch | verifier checks maker-checker invariants (no self-approval for restricted actions) |
| `approval.invalidated` | W,A,B,E | `reasonCode`, `bindingHash` | org | Batch | verifier requires invalidation before new approvals when binding changes |
| `execution.token_issued` (if used) | W,A,B,E | `approvalTokenHash`, `expiresAtCommitment` | org | Batch | token issuance must occur after approvals; verifier checks token not reused |
| `execution.attempted` | W,A,C,B,E | `executionRefCommitment`, `idempotencyKeyHash`, `attemptNumber` | org | **Immediate** | must exist before any “completed”/“settled”; verifier checks idempotency + monotonic attempt numbers |
| `execution.acknowledged` | W,A | `providerAckCommitment` (trace id hash, etc.) | org | Batch | if ack exists, verifier checks provider artifact inclusion in bundle |
| `execution.completed` | W,A,C,B,E | `receiptCommitment` | org | **Immediate** | verifier checks receipt commitment exists and is consistent with rail-specific receipt rules below |
| `execution.failed` | W,A,C,B,E | `errorCode`, `errorDetailsCommitment` | org | Immediate | verifier confirms failure reason and that settlement did not proceed |
| `settlement.reported` | W,A,C,B,E | `settlementReceiptCommitment`, `finalityRuleRef` | org | Immediate | verifier applies rail-specific finality rules (bank settlement vs chain confirmations vs custody completion) |
| `return.reported` / `reversal.reported` | W,A | `returnReasonCode`, `providerArtifactCommitment` | org | Immediate | verifier checks it occurs after execute; marks final state override |
| `btc.confirmations_reached` | B | `txidCommitment`, `blockRefCommitment`, `confirmations` | org | Batch (except final) | verifier checks confirmations monotonically increase; reorg events if decrease |
| `btc.reorg_detected` | B | `txidCommitment`, `prevBlockRefCommitment`, `newBlockRefCommitment` | org | Immediate | verifier marks “finality lost” until restored |
| `eth.receipt_observed` | E | `txHashCommitment`, `blockRefCommitment`, `statusCommitment`, optional `logInclusionCommitment` | org | Batch | verifier checks receipt matches chain; token transfers require log proof |
| `reconciliation.completed` | W,A | `ledgerProviderMapCommitment`, `exceptionsCommitment` | org | Batch | verifier confirms 100% mapping or explicit exception queue events |
| `evidence.bundle_created` | W,A,C,B,E | `bundleRefCommitment`, `redactionMode`, `chainHeadHashCommitment` | org | Batch | verifier can download bundle (authz-gated) and recompute all hashes |
| `evidence.bundle_downloaded` | W,A,C,B,E | `downloadAuditCommitment` (no identity leakage) | org | Batch | verifier confirms audit trail exists for exports without revealing downloader publicly |

---

## Required event types (minimum)

- `intent.created`
- `intent.updated` (if mutable; otherwise remove mutability)
- `beneficiary.bound` / `beneficiary.changed` / `beneficiary.locked`
- `proof.requested` / `proof.submitted` / `proof.verified`
- `approval.added` (maker/checker)
- `execution.token_issued` (if applicable)
- `execution.attempted`
- `execution.completed` / `execution.failed`
- `settlement.reported` / `return.reported` / `reversal.reported`
- `evidence.bundle_created`
- `evidence.bundle_downloaded` (committed without exposing who downloaded)

---

## End-to-end flow (WIRE/ACH example; intent-centric)

1. **Create intent (Wire2)**  
   - Canonicalize intent summary → hash commitment
   - Create `intent.created` envelope
   - Store full record in DB + append event chain (already exists)
   - **Anchor commitment to POSE** (async job; must be idempotent)

2. **Add proof / approvals**  
   - Each approval/proof produces an envelope with `sequence++`
   - Anchor every step, or batch multiple steps into a Merkle root (see batching policy below)

3. **Execute**  
   - Create `execution.attempted` then `execution.completed/failed`
   - Include provider receipt commitment (hash of provider artifacts)

4. **Settle / return**  
   - Post-settlement evidence anchored (even if settlement arrives via provider event later)

5. **Public verification**  
   - Verifier fetches on-chain anchors → verifies hash-chain/merkle root  
   - Verifier downloads bundle (redacted/full) → recomputes hashes → validates signatures + matches on-chain commitments

---

## Batching policy (cost vs assurance)

Two modes:

- **Strict mode (highest assurance)**: anchor **every event** on-chain.
- **Batch mode (cost optimized)**: anchor **Merkle roots** per time window or per N events, with off-chain inclusion proofs.

Must decide:

- maximum batch window (e.g., 30s / 5m)
- maximum events per batch
- what events must always be immediate (execution attempted/completed)

---

## Threat model & failure modes (must be covered)

- **Reorgs / finality**: how many confirmations to consider “final”
- **Double-anchor**: idempotency keys for on-chain tx submission
- **Censorship/denial**: fallback queueing, alerting, degraded execution policy
- **Key compromise**: rotation + revoke + backfill anchors
- **Evidence withholding**: on-chain chain head prevents “silent removal”
- **Clock skew**: rely on chain timestamp + signed local timestamp; document rules
- **Privacy leakage**: never store raw identifiers or amounts; commit only

---

## Operational requirements

- Anchor submission is an **async job** with DLQ/replay (Agent 8 substrate)
- Full observability: per-org anchor lag, failed anchors, confirmation depth
- “Fail closed” policy for money movement if on-chain anchoring is required but unavailable (configurable)

---

## Agent 11 workflow — exact implementation + verification steps (Blockscout-visible)

Goal: when a **WIRE proof / approval / execution** event happens in Wire2, we should see an on-chain **transaction + emitted event** on Blockscout (e.g. `explorer.testnet.pose.xyz`), and we should be able to verify the on-chain anchor against Wire2’s off-chain event chain hash.

### 0) Prereqs / constants (do not start coding until these are set)

- **POSE Core API is healthy** (authoritative readiness for anchoring pipeline):
  - `curl -fsS https://api.testnet.pose.xyz/health >/dev/null`
- **POSE testnet RPC + signer are configured in POSE Core**
  - POSE Core already uses `ethers` (see `core/backend/api/main.ts`), so **the tx submitter lives in POSE Core**, not Wire2.
- **Blockscout base URL**:
  - `POSE_BLOCKSCOUT_BASE_URL=https://explorer.testnet.pose.xyz`

### 1) Deploy the on-chain contract (EvidenceRegistry)

Wire2 has **no Solidity project**; deploy this contract via POSE’s contract deployment flow (preferred) or any EVM deployment tool. Contract MUST implement the spec in `wire2/docs/pose/ONCHAIN_CONTRACT_SPEC.md` and MUST emit an event so Blockscout shows it.

Minimum required Solidity interface (copy/paste reference):

```solidity
// EvidenceRegistry (minimum strict anchoring)
// - sequence is 1-based to match Wire2 `IntentEvent.seq` (see `wire2/backend/src/modules/evidence/eventChain.ts`)
// - emits EventAnchored so Blockscout can index it
pragma solidity ^0.8.19;

contract EvidenceRegistry {
  event EventAnchored(bytes32 indexed intentRef, bytes32 indexed orgRef, uint64 sequence, bytes32 eventHash, bytes32 prevEventHash);

  mapping(bytes32 => uint64) public nextSequence;     // intentRef => next expected sequence (starts at 1)
  mapping(bytes32 => bytes32) public lastEventHash;   // intentRef => last anchored eventHash

  function anchorEvent(bytes32 intentRef, bytes32 orgRef, uint64 sequence, bytes32 eventHash, bytes32 prevEventHash) external {
    uint64 expected = nextSequence[intentRef];
    if (expected == 0) expected = 1;
    require(sequence == expected, "bad_sequence");

    bytes32 last = lastEventHash[intentRef];
    if (sequence == 1) require(prevEventHash == bytes32(0), "first_prev_must_be_zero");
    else require(prevEventHash == last, "bad_prev_hash");

    lastEventHash[intentRef] = eventHash;
    nextSequence[intentRef] = sequence + 1;
    emit EventAnchored(intentRef, orgRef, sequence, eventHash, prevEventHash);
  }
}
```

After deployment, record:

- `POSE_EVIDENCE_REGISTRY_ADDRESS=0x...` (contract address on POSE testnet)

**Verification (deployment):**

- Open Blockscout, search the **contract address**, confirm:
  - contract exists
  - `EventAnchored` event signature is visible in the ABI/events list (after verification/ABI upload if needed)

### 2) Add a POSE Core “anchoring” HTTP endpoint (tx submitter)

Wire2 should **not** sign chain txs. Wire2 calls POSE Core over HTTP; POSE Core uses its signer + RPC to call `EvidenceRegistry.anchorEvent(...)`.

Define an endpoint in POSE Core (path is up to you, but keep it explicit and stable). Recommended:

- `POST /api/pose/anchors/intent-event`

Request body (JSON):

- `orgRef` (0x-prefixed 32-byte hex string)
- `intentRef` (0x-prefixed 32-byte hex string)
- `sequence` (number; 1-based)
- `eventHash` (0x-prefixed 32-byte hex string)
- `prevEventHash` (0x-prefixed 32-byte hex string; for sequence==1 use all zeros)
- `source` (string; e.g. `"wire2"`)
- `requestId` / `traceId` (optional; for correlation)

Response body:

- `ok: true`
- `txHash: "0x..."`
- `contract: "0x..."` (registry address)

**Hard requirements:**

- **Idempotency**: if POSE Core receives the same `(intentRef, sequence, eventHash)` again, it must return the previously submitted `txHash` (or safely re-submit without creating inconsistent sequence on-chain).
- **Input validation**: reject malformed 32-byte hashes; never accept raw UUIDs.
- **Rate limiting**: protect endpoint from abuse (at least IP-based; ideally internal allowlist).

**Verification (POSE Core endpoint):**

1. Health:
   - `curl -fsS https://api.testnet.pose.xyz/health | head`
2. Anchor a known event (after Wire2 creates one; see step 4):
   - `curl -fsS -X POST https://api.testnet.pose.xyz/api/pose/anchors/intent-event -H 'content-type: application/json' -d '{"orgRef":"0x...","intentRef":"0x...","sequence":1,"eventHash":"0x...","prevEventHash":"0x000...000","source":"wire2"}'`
3. Confirm Blockscout shows the tx:
   - open `${POSE_BLOCKSCOUT_BASE_URL}/tx/0x...`

### 3) Add a Wire2 job type that calls POSE Core (never inline on the request path)

Wire2 already has a DB-backed job system + worker:

- queue: `wire2/backend/src/jobs/jobQueue.ts`
- job types: `wire2/backend/src/jobs/jobTypes.ts`
- worker: `wire2/backend/src/worker.ts`

Add a new job type (recommended name):

- `pose.anchor_intent_event`

Payload (JSON) MUST include:

- `orgId`, `intentId`
- `seq` (Wire2 `IntentEvent.seq`)
- `eventHash` (hex)
- `prevEventHash` (hex or null; convert null to 0x00..00 when calling POSE Core)
- `eventType` (string; optional but useful for debugging)
- `requestId`, `traceId` (optional)

Wire2 env vars (recommended):

- `POSE_ANCHORING_ENABLED=true|false` (default false in dev; true in staging/prod once endpoint is ready)
- `POSE_ANCHOR_API_URL=https://api.testnet.pose.xyz/api/pose/anchors/intent-event`
- `POSE_CORE_HEALTH_URL=https://api.testnet.pose.xyz/health` (readiness dependency)

Worker behavior (requirements):

- Before calling POSE Core, do a quick readiness check to `POSE_CORE_HEALTH_URL` (short timeout; fail → retry later).
- Call `POSE_ANCHOR_API_URL` with derived `orgRef`/`intentRef` (see step 5) + hashes.
- On success, log `txHash` (and persist it if you add storage).
- On failure, throw to trigger backoff/retry; on max attempts → DEAD with lastError.

### 4) Enqueue anchors at the right moments (wire proof visibility)

Wire2 already emits a tamper-evident intent event chain via:

- `wire2/backend/src/modules/evidence/eventChain.ts` → `appendIntentEvent(...)` (creates `seq`, `prevHash`, `eventHash`)

To get “proof happens → tx appears on Blockscout”, enqueue anchoring jobs for **at least**:

- `proof.verified`
- `approval.added` (maker/checker)
- `execution.attempted` (**Immediate**)
- `execution.completed` / `execution.failed` (**Immediate**)
- `settlement.reported` (**Immediate** where applicable)

Anchor policy guidance: use the matrix in `wire2/docs/pose/MASTER_PROOF_MATRIX.md` (Immediate vs Batch). For production pass, it’s fine to start with **Immediate for the critical events only** and batch later.

### 5) Deterministic hashing rules (no PII; no raw IDs)

Wire2 must never send raw IDs to POSE Core. Use deterministic refs:

- `orgRef = sha256("org:" + orgId)` as bytes32
- `intentRef = sha256("intent:" + orgId + ":" + intentId)` as bytes32

Then anchor the **Wire2 event-chain hash**:

- `eventHash` = Wire2 `IntentEvent.eventHash`
- `prevEventHash` = Wire2 `IntentEvent.prevHash` (or 0x00..00 for seq==1)

### 6) End-to-end verification (this is the “make sure it works” checklist)

Run these checks in order; do not declare done until all pass:

1. **Wire2 event chain exists and is valid**
   - Call Wire2: `GET /api/wire/intents/:id/events/verify` (implemented in `wire2/backend/src/routes/wire.ts`)
   - Ensure `valid=true` and capture the latest `chainHash` (head)
2. **Anchoring job enqueued**
   - Confirm a `pose.anchor_intent_event` job exists (DB `Job` table) or worker logs show it claimed.
3. **POSE Core returns txHash**
   - Worker logs must include returned `txHash` for the anchor.
4. **Blockscout shows the transaction**
   - Open `${POSE_BLOCKSCOUT_BASE_URL}/tx/<txHash>` and confirm:
     - tx success
     - `EventAnchored` emitted
     - `sequence` matches Wire2 `IntentEvent.seq`
     - `eventHash` matches Wire2 `IntentEvent.eventHash`
5. **No regressions / non-goals respected**
   - Confirm no PII is present in the tx input or emitted event (only refs/hashes).

---

## Acceptance criteria (Agent 11)

- For every completed transfer: verifier can reconstruct **intent → proofs/approvals → execution → receipt** with:
  - on-chain commitments
  - downloadable bundle that matches commitments
  - explicit failure reasons if mismatched
- No sensitive data is published on chain (auditable via schema review + automated checks)
- Anchoring is idempotent and replay-safe (no duplicate sequence numbers)
- Reorg handling documented and tested (simulated)

---

## Effort estimate (high level; do not implement here)

This is a **multi-quarter** program if done properly:

- **Phase 0 (1–2 weeks)**: finalize evidence envelope + event taxonomy + contract spec + privacy review
- **Phase 1 (2–4 weeks)**: implement on-chain registry + anchoring job + verifier tooling (devnet)
- **Phase 2 (4–8 weeks)**: production hardening (key mgmt, reorg/finality, batching, dashboards, SLOs)
- **Phase 3 (ongoing)**: expand beyond Wire/ACH into multi-asset (Agent 12) and broaden event coverage

---

### Agent 12 — Multi‑Asset Transfers & Verification (CASH + BTC + ETH) (Owner: rails expansion)

**Mission:** extend the same verification model so users can verify **WIRE, ACH, CASH, BTC, ETH** end-to-end with consistent evidence checkpoints and a unified verifier.

**Progress (2026-01-14)**

- **Status**: Not started (implementation); specs are authored and ready for execution once Agent 11 anchoring pipeline is live
- **Shipped (specs)**
  - `wire2/docs/pose/PROOF_LIFECYCLE_CASH.md`
  - `wire2/docs/pose/PROOF_LIFECYCLE_BTC.md`
  - `wire2/docs/pose/PROOF_LIFECYCLE_ETH.md`
  - `wire2/docs/pose/UNIFIED_VERIFIER_SPEC.md`
  - `wire2/docs/pose/MASTER_PROOF_MATRIX.md`
- **Next (start here)**
  - Decide custody model for BTC/ETH (non-custodial vs custodial) and document verifier trust assumptions
  - Implement the verifier plugins per rail (BTC confirmations/reorg rules; ETH receipt/log proof rules; CASH dual-control attestations)
  - Add end-to-end UX flows for “verify receipt” for each rail (public view vs authenticated bundle view)

**Scope**

- Define asset-specific “receipts” and verification methods
- Standardize states and proofs across rails
- Provide end-to-end documentation per rail (no gaps)

Docs (new):

- `wire2/docs/pose/PROOF_LIFECYCLE_CASH.md`
- `wire2/docs/pose/PROOF_LIFECYCLE_BTC.md`
- `wire2/docs/pose/PROOF_LIFECYCLE_ETH.md`
- `wire2/docs/pose/UNIFIED_VERIFIER_SPEC.md`

---

## Unified states (applies to all rails)

- `DRAFT`
- `PENDING_PROOF`
- `PENDING_APPROVALS`
- `READY_TO_EXECUTE`
- `EXECUTING`
- `EXECUTED` (attempt acknowledged)
- `SETTLED` (final)
- `RETURNED` / `REVERSED` / `FAILED`

Each state transition must emit:

- an off-chain evidence record (signed)
- an on-chain commitment anchor (Agent 11)

---

## WIRE / ACH (verification additions)

- Provider receipt artifacts committed (hashes of confirmations, trace IDs, settlement statements)
- Settlement/return events anchored when provider events arrive
- Reconciliation proof anchored: “ledger ↔ provider statement” mapping committed

---

## CASH (end-to-end verification)

**Reality:** cash is physical → verification relies on **attestations + controls**, not network receipts.

**Required proof checkpoints**

1. **Cash intent created**: amount/currency committed, but not revealed on chain
2. **Custody handoff proof**:
   - two-person control (maker + checker)
   - time/place attestation (coarse; no exact address if sensitive)
   - optional photo/video hash (stored off-chain; hash committed)
3. **Deposit/receipt proof**:
   - bank deposit slip hash (off-chain)
   - teller/branch attestation hash (off-chain)
4. **Completion proof**:
   - final settlement attestation (org signer)
   - discrepancy handling (short/over) as explicit events

**Anti-fraud controls**

- mandatory dual approval
- mandatory cooldown and re-check before completion
- anomaly detection hooks (Agent 5/8)

---

## BTC (end-to-end verification)

**Verification inputs**

- `txid`, `fromAddress`, `toAddress`, `amount_sats`, `network`, `blockHeight`, `confirmations`

**Required proof checkpoints**

1. **Intent created**: commit `(toAddress, amount_sats, network)` hashed
2. **Address ownership / payout policy proof**:
   - whitelist proof or beneficiary binding proof
3. **Broadcast proof**: `txid` committed
4. **Confirmation proofs**:
   - anchor “N confirmations reached” events (e.g., 1, 3, 6)
   - final “settled” at chosen threshold
5. **Reorg handling**:
   - if reorg drops confirmations: emit `settlement.reorg_detected` and re-evaluate

**Security constraints**

- never store private keys in Wire2
- if custody is involved: require KMS/HSM and key ceremony docs

---

## ETH (end-to-end verification)

**Verification inputs**

- `txHash`, `from`, `to`, `value_wei`, `chainId`, `blockNumber`, `confirmations`, `status`, optional ERC-20 token fields

**Required proof checkpoints**

1. **Intent created**: commit `(to, value_wei, chainId)` hashed
2. **Broadcast**: `txHash` committed
3. **Receipt proof**: include `status`, `gasUsed`, logs bloom hash (committed)
4. **Finality**: choose confirmation threshold per chain; anchor final settlement
5. **Smart contract transfers** (ERC-20):
   - commit token contract + transfer log inclusion proof (off-chain)

---

## Acceptance criteria (Agent 12)

- A user can verify any rail (WIRE/ACH/CASH/BTC/ETH) via a single verifier:
  - shows sequence of proofs
  - validates signatures
  - validates on-chain anchor commitments
  - explains failures clearly
- Rail-specific edge cases are explicitly documented:
  - partial fills, returns, reversals, reorgs, disputes, custody breaks

---

## Immediate “Do Not Break” Checklist (apply to every PR)

- **Backwards compatibility**: existing endpoints and UI routes remain valid
- **Feature flags**: for anything that changes behavior materially
- **Migration safety**: expand/contract; rollback plan; staged rollout
- **Observability**: metrics/logs/traces updated for new behaviors
- **Security**: threat model updated if trust boundaries change
- **UX**: empty/loading/error states included; no silent failures; no misleading success

---

## Suggested File Ownership / Collision Avoidance

- **Frontend**: `wire2/frontend/**` (Agent 2 owns; others PR via Agent 2 review)
- **Backend core**: `wire2/backend/src/**` (Agents 3–8 by area; avoid cross‑cutting refactors)
- **Backend docs**: `wire2/backend/docs/**` (Agents 0/5/6/8)
- **Top‑level product docs**: `wire2/*.md` (Agent 0/1)

