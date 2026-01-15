# Flow: Recover Access (Forgot Password + Reset + Invite Accept)

Uses: `../ACCEPTANCE_CRITERIA_TEMPLATE.md`

## Metadata
- **Flow name**: Recover Access
- **Owner**: UX/PM
- **Last updated**: 2026-01-14
- **Primary user roles**: All
- **Entry points**:
  - `/v2/forgot-password`
  - `/v2/reset-password`
  - `/v2/invite/:token`
  - Deep link to any authenticated route (should redirect to login and preserve return)
- **Related docs**:
  - `../CRITICAL_FLOWS_AND_ROUTES.md`
  - `../CONTENT_GUIDELINES.md`

## Preconditions
- User authenticated? **N**
- Required permissions/roles: **N/A**
- Required org/tenant state: user exists OR invite token is valid
- Required integrations: email delivery (forgot/reset); optional IdP/SSO (if enabled)

## UX contract (non-breaking)
- Existing routes preserved? **Y**
- Existing terminology preserved? **Y**
- Any new UI behind feature flag? **NA**

## Happy path (forgot + reset)
1. User visits `/v2/forgot-password` and enters email.
2. UI confirms submission without leaking whether the email exists.
3. User receives email and opens reset link.
4. User sets a new password; UI confirms success and routes to login (or auto-login per policy).

## Happy path (invite accept)
1. User opens `/v2/invite/:token`.
2. UI validates token; user sets name/password (or links SSO) and joins org.
3. User lands in app shell.

## Success criteria (must be true)
- **Correctness**
  - Reset tokens are single-use and expire; UI handles expired/used tokens clearly.
  - Invite tokens cannot be replayed to change membership once accepted.
- **UX clarity**
  - Copy is calm and does not reveal account existence.
  - Clear next steps on token failure (request new invite, restart reset).
- **Accessibility**
  - Forms are keyboard navigable; errors are announced and field-bound.
- **Security + trust**
  - No tokens in logs/toasts; URLs are handled safely.

## Failure modes (expected + handling)
- **Unknown email**
  - UI: same confirmation as known email (“If an account exists…”)
- **Expired/used reset token**
  - UI: “This link expired” + CTA to restart reset
- **Expired/invalid invite**
  - UI: “Invite expired” + CTA to contact admin for a new invite
- **Rate limited**
  - UI: cooldown guidance

## Telemetry + audit expectations
- **Client events**: `recover_view`, `recover_submit`, `recover_success`, `recover_error`, `invite_accept_view`, `invite_accept_success`
- **Audit log**: password reset request + password reset completed + invite accepted

## Test checklist (manual + automated)
- [ ] Forgot password submits and shows neutral confirmation
- [ ] Reset with valid token succeeds
- [ ] Reset with expired token shows CTA to restart
- [ ] Invite accept valid token works
- [ ] Invite accept invalid token messaging
- [ ] Keyboard-only
- [ ] Screen reader pass

