# Wire2 Release Gates (Agent 10)

## P0 Gates (must pass to merge/ship)

These are enforced in CI via:

- `.github/workflows/wire2-ci.yml` (tests + contract/guard rails)
- `.github/workflows/security.yml` (dependency/secret scanning, SAST, SBOM)
- `.github/workflows/wire2-synthetics.yml` (optional: runs against configured deployment)
- `.github/workflows/wire2-dast.yml` (optional: baseline DAST against staging)

### Frontend

- `wire2/frontend`:
  - `npm ci`
  - `npm run check:routes` (router ↔ docs ↔ base consistency)
  - `npm test`
  - `npm run build`

### Backend

- `wire2/backend`:
  - `npm ci`
  - `npm run openapi:validate`
  - `npm run guard:tenancy`
  - `npm run guard:migrations`
  - `npm test` (includes baseline security headers + SSRF guardrails + multi-tenant + critical flows E2E)

### Staging gates (must pass before prod deploy)

- Apply migrations in staging first (no surprises)
- Run smoke tests against staging (at minimum: top 6 critical flows API-level E2E)
- Confirm rollback plan is valid for this release (see “Release safety”)
- Staging must meet the parity bar in `wire2/docs/STAGING_PARITY_CHECKLIST.md`

### Security gates (must pass; no “best effort”)

- Dependency review (PR)
- Secret scanning (repo history)
- SAST (CodeQL)
- SBOM generated and stored as a build artifact (CycloneDX)
- CI/CD baseline expectations (branch protections, signing): `wire2/docs/SECURE_CICD_BASELINE.md`
- Pen test program: `wire2/docs/PEN_TEST_PROGRAM.md`

## Agent 7.1 — Release Gate Checklist (Plaid + Signed Receipt)

This checklist is required for any release that includes:
- Plaid webhook ingestion/verification
- Plaid `/transfer/event/sync` backfill worker
- Plaid Transfer execution connector (when added)
- POSE Signed Receipt (“verification token”) issuance + JWKS

### A) Plaid webhook verification (must fail-closed)

- **Signature verification**: `Plaid-Verification` JWT is verified (alg **ES256**), JWK fetched via `/webhook_verification_key/get`
- **Integrity**: `request_body_sha256` matches the **raw request body** (whitespace-sensitive)
- **Replay window**: `iat` tolerance enforced (configurable), out-of-window requests rejected
- **No secrets in logs**: Plaid JWT not logged; only redacted hashes allowed
- **Public route safety**: webhook endpoints are unauthenticated by user session but authenticated by Plaid verification (no “admin preHandler” on public webhook routes)

**Evidence to attach (PR / release notes)**
- Unit tests covering positive/negative verification cases (ES256/JWK/body-hash/iat)
- A short “how to rotate Plaid verification keys” note (operational)

### B) ProviderEvent + idempotency + reconciliation (must be deterministic)

- **Idempotency**:
  - Provider webhook replays and sync replays do not create duplicate `ProviderEvent` rows (dedupeKey unique)
  - Processing is exactly-once *effectively* (claimed by `processedAt`; retries safe)
- **Unknown events**: unmapped event types create `ReconciliationException` (never silently “ok”)
- **Out-of-order events**: do not rewind terminal states; create `ReconciliationException` (`out_of_order_event` / `state_conflict`)
- **Tenant safety**: all ProviderEvents and reconciliations are scoped by `orgId`; cross-tenant correlation is impossible

**Evidence to attach**
- Screenshot/log or test output showing duplicate webhook deliveries deduped (same payload twice)
- A sample `ReconciliationException` payload for an unmapped event type

### C) Transfer sync/backfill worker (must recover from missed webhooks)

- **Sync correctness**:
  - `/transfer/event/sync` paging uses `after_id` and respects `has_more`
  - Cursor strategy is monotonic and safe (no infinite loops; bounded per job tick)
- **Correlation invariant**:
  - For Plaid Transfer executions, `ExecutionLedger.externalRef = transfer_id` (required for correlation)
  - If correlation fails (no ledger match), the system raises an exception (no silent drop)
- **Ops visibility**:
  - Job type is observable; failures go to DLQ; replay procedure documented (Agent 8)

**Evidence to attach**
- A short runbook section: “Webhook lost → sync recovers → ledger updates”

### D) Signed Receipt (“POSE Verification Token”) gates (when introduced)

- **Cryptographic verifiability**:
  - Receipt is issued as a signed token (JWS) with stable canonical payload rules
  - JWKS endpoint is published and includes `kid` + active keys
  - Key rotation rules documented; revoked keys handled
- **Privacy**:
  - No PII in signed payload
  - Receipt links to evidence bundle/chain by hash/ids only
- **Idempotency**:
  - Same (orgId, executionRef, receiptType) yields deterministic token issuance

**Evidence to attach**
- Unit tests proving JWS verify succeeds with JWKS
- Example receipt payload (redacted) + verification steps

## Override / Waiver Policy

Overrides are allowed only when:

- The failing gate is **non-security** and **non-tenancy** related, AND
- A rollback plan exists, AND
- The risk is documented in the PR description.

### Required sign-off for overrides

- **Agent 0 (owner)**: required for any override
- **Security-sensitive gates** (headers/SSRF/tenant isolation/auth): **no override without Agent 5 + Agent 0**

## Release safety (how we ship)

### Deployment strategy

- Prefer **canary** or **blue/green** over “big bang”
- Use **feature flags** for behavior changes; be able to disable without redeploying
- Keep “expand/contract” patterns for schema changes; never break rollback

### Rollback requirements

- A release must be rollbackable quickly **without data loss** and **without breaking auth/session continuity**
- Rollback procedure must be documented for the environment (staging/prod)
- If rollback isn’t possible, the release must be gated behind flags and have explicit sign-off from Agent 0 + Agent 5

## P1/P2 Gates (should pass; may be staged)

- Load + chaos tests for job/webhook storms
- Additional browser E2E (Playwright) if/when introduced
- SAST/SCA/secret scanning (CI)
- DAST (staging) for the public surface area, when an ops environment exists
- Periodic pen testing + documented triage and remediation plan (`wire2/docs/VULNERABILITY_TRIAGE_SLAS.md`)

