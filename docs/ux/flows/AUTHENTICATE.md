# Flow: Authenticate (Login + Session Persistence + Logout)

Uses: `../ACCEPTANCE_CRITERIA_TEMPLATE.md`

## Metadata
- **Flow name**: Authenticate
- **Owner**: UX/PM
- **Last updated**: 2026-01-14
- **Primary user roles**: Initiator, Approver, Admin, Compliance
- **Entry points**:
  - `/v2/login`
  - Deep links to authenticated routes (should redirect to login then return)
- **Related docs**:
  - `../CRITICAL_FLOWS_AND_ROUTES.md`
  - `../CONTENT_GUIDELINES.md`

## Preconditions
- User authenticated? **N** (start state)
- Required permissions/roles: **N/A** (auth gate precedes RBAC)
- Required org/tenant state: org exists for user OR valid invite token
- Required integrations: **None**

## UX contract (non-breaking)
- Existing routes preserved? **Y**
- Existing terminology preserved? **Y**
- Any new UI behind feature flag? **NA**

## Happy path (step-by-step)
1. User navigates to `/v2/login`.
2. User enters valid credentials and submits.
3. App shows loading state (no double-submit) and transitions into authenticated shell.
4. User refreshes the page; session persists and the user remains authenticated.
5. User logs out (or session is revoked) and is returned to `/v2/login`.

## Success criteria (must be true)
- **Correctness**
  - A logged-out user cannot access authenticated routes; attempts redirect to `/v2/login` and preserve return path.
  - A logged-in user does not see login/signup routes unless explicitly logging out.
- **UX clarity**
  - Login errors are specific and actionable (invalid credentials vs locked vs rate limited), per `../CONTENT_GUIDELINES.md`.
  - Loading state is visible and prevents repeated submissions.
- **Performance**
  - Login submit provides feedback immediately (spinner/disabled button).
  - Authenticated shell loads without blank screen (skeleton or layout frame appears quickly).
- **Accessibility**
  - Initial focus is on the first input; error messages are tied to fields and announced.
  - Keyboard-only login is fully functional (tab order, enter-to-submit).
- **Security + trust**
  - No secrets in URL or toast messages.
  - Session persistence is clear to the user (no surprise logouts without explanation).

## Failure modes (expected + handling)
- **Invalid credentials**
  - UI: Inline error near password + short summary at top (optional).
  - Copy: Calm, no blame; includes next step (“Try again or reset password.”)
- **Rate limited**
  - UI: Error with cooldown indication (if available) + disable rapid retries.
  - Copy: Explains wait time and suggests password reset if needed.
- **Backend unavailable / timeout**
  - UI: Non-destructive error; allow retry; show request ID if present.
  - Copy: “Service temporarily unavailable. Try again in a few minutes.”
- **Already authenticated**
  - UI: Redirect to `/v2/` (or last visited page).

## State machine + UX mapping
- **Backend states**: unauthenticated → authenticated(session) → revoked/expired → unauthenticated
- **UI labels**: “Log in”, “Logging in…”, “Logged out”
- **Allowed transitions**:
  - unauthenticated: submit login, navigate to reset, accept invite
  - authenticated: logout, navigate app

## Telemetry + audit expectations
- **Client events**
  - `auth_login_view`
  - `auth_login_submit`
  - `auth_login_success`
  - `auth_login_error` (include normalized reason)
  - `auth_logout`
- **Correlation**
  - On hard failure, show a request ID (if backend supplies) for support.
- **Audit log**
  - Logins/logouts should be auditable (actor, org/tenant, request ID), especially for admin accounts.

## Copy review checklist
- Uses calm/neutral language per `../CONTENT_GUIDELINES.md`
- Errors include a next step
- No secrets/PII in toasts or URLs

## Test checklist (manual + automated)
- [ ] Login success
- [ ] Invalid password error
- [ ] Rate limit behavior
- [ ] Refresh persists session
- [ ] Deep-link redirect to login then return
- [ ] Logout clears session and redirects to login
- [ ] Keyboard-only pass
- [ ] Screen reader pass

