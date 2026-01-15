# Wire2 Session Model (Access + Refresh + Revocation)

**Objective:** bank-grade sessions with immediate revocation, per-device visibility, safe rotation, and complete audit coverage.

---

## Token types

### Access token (JWT)

- **TTL**: short-lived (target 10–15 minutes).
- **Audience**: Wire2 APIs/services.
- **Required claims**:
  - `tenant_id`
  - `user_id`
  - `session_id`
  - `iat`, `exp`
  - `amr` / `acr` (assurance + MFA posture when available)
- **Use**: sent as `Authorization: Bearer <token>` by the frontend.

### Refresh token (opaque, rotating)

- **TTL**: longer (target days/weeks; must be policy-controlled).
- **Storage**: server-side only (hashed), bound to `session_id`.
- **Transport**: `HttpOnly` cookie preferred (avoid JS access).
- **Rotation**:
  - on every refresh, issue a new refresh token and invalidate the old one
  - detect reuse of an invalidated refresh token → revoke the entire session (and optionally all sessions)

---

## Session store requirements

Each session record must include:

- `session_id`, `tenant_id`, `user_id`
- `created_at`, `last_seen_at`
- `revoked_at` (nullable)
- `device_fingerprint` (best-effort, privacy-safe), `user_agent`, `ip`, `asn` (as available)
- `refresh_token_hash_current` (or token family mechanism)
- `mfa_level` / `assurance_level` snapshot (for step-up)

**Revocation propagation**

- Revocation must be enforced across all services within seconds.
- Recommended mechanism: central session store + cache (e.g., Redis) with:
  - fast `is_session_active(session_id)` checks
  - pub/sub or versioning to invalidate local caches safely

---

## Endpoints (conceptual)

- `POST /auth/login` (password login; org SSO policy enforcement may apply)
- `GET /auth/oidc/authorize` (OIDC start; behind feature flag)
- `GET /auth/oidc/callback` (OIDC callback; behind feature flag)
- `POST /auth/refresh` (rotate refresh token, issue new access token)
- `POST /auth/logout` (revoke current session)
- `POST /auth/logout_all` (revoke all sessions for user in tenant; verifiable via sessions list)
- `GET /auth/sessions` (list sessions for current user; device inventory + revocation verification)

All endpoints must emit events defined in `wire2/backend/docs/AUTH_EVENTS.md`.

---

## Timeouts & policy

- **Idle timeout**: user must re-auth after inactivity window (policy-controlled).
- **Absolute session lifetime**: cap total lifetime even with continuous refresh (policy-controlled).
- **Step-up**: sensitive actions require recent high assurance (e.g., MFA within N minutes).

---

## Testing requirements (must pass before “bank-grade” claim)

- Revocation is immediate (API + UI verification).
- Refresh rotation detects replay and kills sessions.
- Deactivated/suspended users cannot refresh or create new sessions.
- Tenant binding cannot be bypassed (cross-tenant token/session misuse fails).

