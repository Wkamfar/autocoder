# Wire2 Auth Architecture (OIDC/SSO + Sessions + IAM)

**Goal:** Provide an enterprise-grade identity layer for Wire2 without breaking existing working UX.  
**Non‑negotiables:** multi‑tenant by construction, fail‑closed for money movement, immediate session revocation, complete auditability.

---

## Summary (what we are building)

- **SSO**: OIDC Authorization Code + PKCE (primary).  
- **SAML**: supported either directly or via IdP “SAML → OIDC” bridge; **internal** contract remains OIDC-shaped.
- **Session model**: short-lived access token + rotating refresh token with server-side session store and immediate revocation.
- **Provisioning**: SCIM v2 `/Users` and `/Groups` with idempotency + retries.
- **Authorization**: RBAC baseline mapped from SCIM groups (plus optional local overrides under strict policy).
- **Break-glass**: local admin access only for IdP outage, heavily constrained + audited.

Related docs:
- `wire2/backend/docs/SESSION_MODEL.md`
- `wire2/backend/docs/IAM_MAPPING.md`
- `wire2/backend/docs/AUTH_EVENTS.md`
- `wire2/backend/docs/THREAT_MODEL.md`

---

## Core entities (conceptual)

- **Tenant/Org**: top-level isolation boundary.
- **User**: belongs to exactly one org (or has explicit org membership records, but auth tokens must always bind to a single org).
- **Identity**: external IdP subject (`iss`, `sub`) bound to a user; supports account linking rules.
- **Session**: per-device login session; can be revoked independently or “log out everywhere”.
- **Role**: RBAC role; assignment derived from SCIM groups and/or explicit admin policy.

---

## OIDC SSO flow (high-level)

1. **Start**: browser hits `/auth/login` (org-aware; org selected or inferred by domain).
2. **Redirect**: to IdP authorization endpoint with PKCE, `state`, `nonce`, requested scopes.
3. **Callback**: validate `state`/`nonce`, exchange code for tokens at IdP.
4. **Claims validation**:
   - validate signature + issuer + audience + `exp`
   - extract `sub`, `email`, `amr`/`acr`, optional group claims (or group lookup via SCIM)
5. **User resolution**:
   - find or create/link identity per rules in `IAM_MAPPING.md`
6. **Create session**:
   - issue access token + refresh token per `SESSION_MODEL.md`
7. **Post-login**:
   - redirect back to app; ensure org context is explicit and stable

---

## Logout semantics

- **App logout**: revoke session server-side; delete refresh cookie; access token expires naturally (short TTL).
- **Global logout** (“log out everywhere”): revoke all sessions for user in org.
- **IdP logout**: optional best-effort (front-channel/back-channel where supported); Wire2 must remain safe even if IdP logout fails.

---

## Rollout policy (recommended)

**Default stance:** SSO enforcement should be **opt-in** (per environment + per org) to avoid accidental lockouts.

Recommended rollout sequence:

1. **Enable OIDC endpoints** behind flags without changing existing login flows:
   - Set `OIDC_ENABLED=true` (keep `AUTH_MODE=demo|password` during pilot if desired).
2. **Configure and test** OIDC end-to-end for a pilot org (authorize → callback → session minted).
3. **Mark the org as SSO-enforced**:
   - Set `OrgSsoConfig.enforced=true` for that org.
4. **Turn on enforcement** in the target environment:
   - Set `SSO_ENFORCEMENT_ENABLED=true` so password login is denied for enforced orgs.
5. **Full cutover (optional)**:
   - Switch `AUTH_MODE=oidc` once you want OIDC to be the default assumption for the deployment.

This aligns with the “do not break what works” principle and lets you progressively harden.

---

## Threats & mitigations (minimum)

- **Token replay**: rotating refresh tokens + reuse detection + session kill + alert.
- **Session fixation**: new session identifiers per login; rotate on privilege change/step-up.
- **Cross-tenant access**: tokens include tenant binding; services enforce tenant scope (see Agent 4 invariants).
- **Phishing/scanners**: avoid magic links for privileged access; rate limit login/refresh endpoints; anomaly signals to risk engine.

---

## Open decisions (must be explicitly chosen)

- **Single-org vs multi-org users**: if multi-org membership exists, tokens must bind to one org at a time; switching requires explicit selection.
- **Cookie vs header for refresh**: default recommendation is refresh in `HttpOnly` cookie; access token in header.
- **Group source of truth**: group claims in OIDC vs SCIM groups; prefer SCIM for consistency.

