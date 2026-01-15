# Flow: Beneficiary Lifecycle (Create / Update / Lock)

Uses: `../ACCEPTANCE_CRITERIA_TEMPLATE.md`

## Metadata
- **Flow name**: Beneficiary lifecycle
- **Owner**: UX/PM
- **Last updated**: 2026-01-14
- **Primary user roles**: Treasury Initiator, Admin, Auditor (read-only)
- **Entry points**:
  - `/v2/beneficiaries`
  - `/v2/beneficiaries/:id`
- **Related docs**:
  - `../CRITICAL_FLOWS_AND_ROUTES.md`
  - `../CONTENT_GUIDELINES.md`

## Preconditions
- User authenticated? **Y**
- Required permissions/roles:
  - Create: `beneficiary:create`
  - Lock: `beneficiary:lock`
- Required org/tenant state: org exists
- Required integrations: bank tokenization (if used) must be available

## Happy path (create)
1. User navigates to `/v2/beneficiaries` and clicks “Add Beneficiary”.
2. User enters beneficiary identity and rails-allowed details.
3. UI validates and saves; beneficiary appears as `ACTIVE` or `PENDING_VERIFICATION` depending on policy.

## Happy path (update)
1. User opens `/v2/beneficiaries/:id`.
2. User updates allowed fields; UI shows version bump and change history.

## Happy path (lock)
1. Admin locks a beneficiary.
2. UI confirms impact: future intents cannot target this beneficiary.

## Success criteria (must be true)
- **Correctness**
  - Beneficiary changes create a new version when required; UI shows which version an intent references.
  - Locking prevents execution and/or creation as per backend enforcement.
- **UX clarity**
  - Clear rails allowed and any verification requirements.
  - Change history is visible for audit (who/when/what changed).
- **Accessibility**
  - Forms keyboard navigable; errors announced and field-bound.
- **Security + trust**
  - Bank data is masked; only last4 shown.

## Failure modes (expected + handling)
- **Permission denied**
  - UI: disable/deny with reason and guidance.
- **Conflict (version mismatch)**
  - UI: refresh prompt; explain someone else updated.
- **Provider down**
  - UI: “temporarily unavailable” + retry guidance + request ID.

## Telemetry + audit expectations
- **Client events**: `beneficiary_create`, `beneficiary_update`, `beneficiary_lock`
- **Audit log**: all beneficiary mutations recorded with actor + org + request ID

## Test checklist (manual + automated)
- [ ] Create beneficiary happy path
- [ ] Update beneficiary versioning visible
- [ ] Lock beneficiary blocks relevant actions
- [ ] Conflict handling
- [ ] Keyboard-only
- [ ] Screen reader pass

