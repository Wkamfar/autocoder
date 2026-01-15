# Flow: Settings — Integrations (API Keys / Webhooks / Domains)

Uses: `../ACCEPTANCE_CRITERIA_TEMPLATE.md`

## Metadata
- **Flow name**: Settings integrations
- **Owner**: UX/PM
- **Last updated**: 2026-01-14
- **Primary user roles**: Admin (create/rotate), Developer (view/copy), Auditor (view)
- **Entry points**:
  - `/v2/settings/api-keys`
  - `/v2/settings/webhooks`
  - `/v2/settings/domains`
- **Related docs**:
  - `../CRITICAL_FLOWS_AND_ROUTES.md`
  - `../CONTENT_GUIDELINES.md`

## Preconditions
- User authenticated? **Y**
- Required permissions/roles:
  - API keys: admin-level (policy-defined)
  - Webhooks: admin-level (policy-defined)
  - Domains: admin-level (policy-defined)
- Required org/tenant state: org exists; integrations enabled
- Required integrations: outbound URL safety for webhooks; DNS checks for domains

## Happy path (API keys)
1. Admin visits `/v2/settings/api-keys`.
2. Admin creates a key; UI shows the secret **once** with clear warning to store it safely.
3. Admin can revoke/rotate keys; audit trail is visible.

## Happy path (webhooks)
1. Admin visits `/v2/settings/webhooks`.
2. Admin creates webhook with HTTPS URL; UI validates URL safety constraints.
3. Admin receives signing secret (once) and sees delivery status + retries.

## Happy path (domains)
1. Admin visits `/v2/settings/domains`.
2. Admin adds a domain; UI shows DNS instructions and verification status.
3. Admin can re-check verification and remove a domain.

## Success criteria (must be true)
- **Correctness**
  - Secrets are shown once and never re-displayed.
  - Revoked keys/secrets stop working immediately (observable in UI/API).
  - Webhook URLs are validated against SSRF guardrails.
- **UX clarity**
  - Clear instructions for DNS verification and webhook setup.
  - Empty states include primary CTA + explanation.
- **Accessibility**
  - Tables and forms are keyboard navigable; modals manage focus.
- **Security + trust**
  - No secrets in toasts/logs; copy emphasizes safe handling.
  - Hard failures show request ID for support.

## Failure modes (expected + handling)
- **Permission denied**
  - UI: disable actions with reason and guidance.
- **Invalid/unsafe webhook URL**
  - UI: inline validation message; link to SSRF guidance.
- **DNS verification fails**
  - UI: show status, common causes, re-check CTA.
- **Backend degraded**
  - UI: non-destructive error; allow retry; show request ID.

## Telemetry + audit expectations
- **Client events**: `api_key_create`, `api_key_revoke`, `webhook_create`, `webhook_delete`, `domain_add`, `domain_verify`
- **Audit log**: all integration mutations recorded with actor + org + request ID

## Test checklist (manual + automated)
- [ ] API key created and secret shown once
- [ ] Webhook URL safety validation
- [ ] Domain verification workflow clarity
- [ ] Keyboard-only
- [ ] Screen reader pass

