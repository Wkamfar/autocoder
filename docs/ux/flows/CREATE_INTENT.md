# Flow: Create Intent (Treasury Initiator)

Uses: `../ACCEPTANCE_CRITERIA_TEMPLATE.md`

## Metadata
- **Flow name**: Create Intent
- **Owner**: UX/PM
- **Last updated**: 2026-01-14
- **Primary user roles**: Treasury Initiator
- **Entry points**:
  - `/v2/requests/new` (create request → intent)
  - Any “Create Intent” CTA from `/v2/intents` empty state
- **Related docs**:
  - `../CRITICAL_FLOWS_AND_ROUTES.md`
  - `../CONTENT_GUIDELINES.md`

## Preconditions
- User authenticated? **Y**
- Required permissions/roles: `intent:create`
- Required org/tenant state: user belongs to org; org policies loaded
- Required integrations: beneficiary exists OR user can create beneficiary

## UX contract (non-breaking)
- Existing routes preserved? **Y**
- Existing terminology preserved? **Y** (Intent, Beneficiary, Approval, Verification)
- Any new UI behind feature flag? **NA**

## Happy path (step-by-step)
1. User opens “Create intent” from `/v2/intents` or navigates to `/v2/requests/new`.
2. User selects rails (ACH/WIRE), beneficiary, enters amount + purpose.
3. User reviews summary and submits.
4. UI shows created intent in an initial state (typically `DRAFT` → `PENDING_PROOF`/`PENDING_APPROVALS` depending on policy).
5. User can navigate to `/v2/intents/:id` and see the intent details.

## Success criteria (must be true)
- **Correctness**
  - Submit is idempotent (refresh/retry does not create duplicate intents).
  - Post-create page reflects backend canonical status and required next action.
- **UX clarity**
  - Form validation is inline and specific (amount, rails, beneficiary).
  - After submit, the user is told exactly what happens next (“Verify”, “Waiting for approvals”, etc.).
- **Performance**
  - Submit provides immediate feedback; long-running operations show progress.
- **Accessibility**
  - Form is keyboard navigable; errors are announced and tied to fields.
- **Security + trust**
  - No sensitive bank details exposed beyond intended last4/masked fields.

## Failure modes (expected + handling)
- **Validation error (400)**
  - UI: field-level errors; keep user input; focus first invalid field.
- **Permission denied (403)**
  - UI: “You don’t have access” + guidance to request permission.
- **Conflict / idempotency replay (409)**
  - UI: treat as success if intent already created; navigate to existing intent.
- **Backend degraded / timeout**
  - UI: non-destructive error; allow retry; show request ID when available.

## State machine + UX mapping
- Typical transitions (policy-dependent):
  - `DRAFT` → `PENDING_PROOF` (verification required)
  - `DRAFT` → `PENDING_APPROVALS` (approval required)
  - `DRAFT` → `PENDING_PROOF` → `PENDING_APPROVALS`
- UI must always show:
  - current state label
  - primary CTA (if any)
  - why CTA is disabled (permissions, cooldown, missing bank link, etc.)

## Telemetry + audit expectations
- **Client events**: `intent_create_view`, `intent_create_submit`, `intent_create_success`, `intent_create_error`
- **Correlation**: show request ID for support on hard failures
- **Audit log**: intent created event includes actor + org + request ID

## Copy review checklist
- Calm/neutral language per `../CONTENT_GUIDELINES.md`
- Errors include next step
- No secrets/PII in toasts or URLs

## Test checklist (manual + automated)
- [ ] Create intent happy path
- [ ] Validation errors (missing beneficiary, invalid amount)
- [ ] Retry submit does not duplicate
- [ ] Refresh after submit preserves state
- [ ] Keyboard-only
- [ ] Screen reader pass

