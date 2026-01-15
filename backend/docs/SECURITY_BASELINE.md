## Security Baseline (Agent 5)

**Purpose:** define the minimum “bank-grade” application security configuration for Wire2 backend services.

### Shipped today (code pointers)

- **Secure response headers** are applied in a global hook:
  - `wire2/backend/src/modules/security/auth.ts` (`applySecureHeaders`)
- **CORS** is controlled via `CORS_ORIGIN`:
  - `wire2/backend/src/app.ts`
- **CSP reporting (report-only by default)** + reporting endpoint:
  - Headers: `wire2/backend/src/modules/security/auth.ts`
  - Endpoint: `wire2/backend/src/routes/securityReports.ts` (`POST /api/security/csp-report`)
- **Rate limiting** is **Redis-backed** when `REDIS_URL` is configured (with safe in-memory fallback):
  - `wire2/backend/src/modules/security/rateLimit.ts`

### Required headers (minimum)

These headers MUST be present on all API responses:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

Production-only (or “enterprise auth mode”) defaults:

- `Strict-Transport-Security` (HSTS) on HTTPS deployments
- `Content-Security-Policy` (CSP) for any server-served web assets (or for embedded docs like Swagger/Redoc)

### CSP policy (current and target)

**Current (shipped):** CSP is **report-only by default** (`CSP_MODE=report-only`) and includes `'unsafe-inline'` as an initial compatibility posture.

**Target:** start with **report-only**, iterate to remove `'unsafe-inline'`, use nonces/hashes where needed.

### Request hardening defaults

- **Timeouts** on all outbound calls (already present in webhook delivery)
- **Request size caps** for payload-heavy endpoints (file uploads / evidence export)
- **Consistent error taxonomy**: return `{ code, error }` without leaking internals; always include `X-Request-Id`

### Tests

- `wire2/backend/src/tests/securityHeaders.test.ts` validates baseline headers and CSP report-only/enforce behavior.

