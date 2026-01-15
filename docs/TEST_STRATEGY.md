# Wire2 Test Strategy (Agent 10)

## Goals

- Catch regressions early (fast CI gates)
- Prove tenant isolation + security defaults
- Keep tests deterministic (anti-flake rules)
- Cover the **top 6 UX-first critical flows** end-to-end

## What runs in CI

- `wire2-ci` workflow (`.github/workflows/wire2-ci.yml`)
  - Frontend: route regression + unit tests + build
  - Backend (fast): OpenAPI validate + tenancy + migration safety + Vitest
  - Backend (DB): Postgres-backed run so E2E tests actually execute
- `security-gates` workflow (`.github/workflows/security.yml`)
  - dependency review, secret scanning, CodeQL SAST, SBOM artifact

## Test Pyramid

- **Unit tests (fast, deterministic)**: pure functions (hashing, canonical JSON, policy logic)
- **Integration tests (DB-backed)**: Prisma constraints, tenancy guardrails, job queue semantics
- **E2E tests (API-level, DB-backed)**: critical flows using `buildApp()` + `app.inject()`

## Anti-flake Rules (must-follow)

- **No sleeps for correctness**: use polling with timeouts or deterministic triggers (e.g., call worker functions directly)
- **No dependency on external networks**: avoid real HTTP calls; mock outbound requests (e.g., `axios.post`)
- **Seed or create test data explicitly**: tests must not rely on manual state
- **Unique identifiers**: use timestamp/random prefixes to avoid collisions
- **Hermetic environment toggles**: when SSRF/DNS checks would require network, allow opting out via env for tests (never default-off in prod)
- **Deterministic time**: prefer fixed clocks for logic tests; avoid real-time edge cases unless explicitly tested

## Critical Flows Coverage

The following must have E2E coverage (API-level is acceptable for P0):

1. Signup → org created → admin onboarded
2. Invite user → accept → enroll voice → role enforced
3. Create intent → approvals → execute → receipt (bundle + chain verify)
4. Beneficiary create/change → lock/unlock → auditability
5. Evidence export → verify → download link issued
6. Webhook setup → test delivery → delivery logs → retries

## Where the tests live

- Backend:
  - `wire2/backend/src/tests/securityHeaders.test.ts`
  - `wire2/backend/src/tests/outboundUrlSafety.test.ts`
  - `wire2/backend/src/tests/criticalFlows.e2e.test.ts`
  - Multi-tenant isolation:
    - `wire2/backend/src/tests/multiTenantIsolation.test.ts`
    - `wire2/backend/src/tests/asyncTenantIsolation.test.ts`
- Frontend:
  - Route regression: `wire2/frontend/scripts/route-regression-check.mjs` (`npm run check:routes`)

