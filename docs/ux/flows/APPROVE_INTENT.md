# Flow: Approve / Deny Intent (Approver)

Uses: `../ACCEPTANCE_CRITERIA_TEMPLATE.md`

## Metadata
- **Flow name**: Approve / Deny Intent
- **Owner**: UX/PM
- **Last updated**: 2026-01-14
- **Primary user roles**: Approver
- **Entry points**:
  - `/v2/approvals`
  - Deep link: `/v2/intents/:id` (if user has approval permission)
- **Related docs**:
  - `../CRITICAL_FLOWS_AND_ROUTES.md`
  - `../CONTENT_GUIDELINES.md`

## Preconditions
- User authenticated? **Y**
- Required permissions/roles: `intent:approve`
- Required org/tenant state: intent exists; approval is required; user is eligible approver
- Required integrations: none

## UX contract (non-breaking)
- Existing routes preserved? **Y**
- Existing terminology preserved? **Y**
- Any new UI behind feature flag? **NA**

## Happy path (step-by-step)
1. Approver visits `/v2/approvals` and sees intents requiring attention.
2. Approver opens an intent (detail view) and reviews amount, beneficiary, rails, risk rationale, and evidence (if available).
3. Approver selects **Approve** (or **Deny**) with an optional reason code/comment.
4. UI confirms action, updates approval status counters, and reflects updated intent status.

## Success criteria (must be true)
- **Correctness**
  - Approver can only approve/deny if eligible; otherwise action is disabled with a specific reason.
  - Decision submission is idempotent (double click / refresh cannot create contradictory decisions).
  - After decision, UI reflects backend canonical status immediately on refresh.
- **UX clarity**
  - Approver sees exactly what they are approving: amount, beneficiary identity, rails, and risk context.
  - Deny flow explains impact (“This intent will not execute unless recreated.”) in calm language.
- **Performance**
  - Decisions feel instantaneous; loading state prevents repeated submissions.
- **Accessibility**
  - Buttons reachable by keyboard; confirmation/toast is announced.
- **Security + trust**
  - UI shows request ID on hard errors.

## Failure modes (expected + handling)
- **Permission denied (403) / not eligible**
  - UI: disable actions; show “You don’t have access” + guidance.
- **Already decided / stale state (409)**
  - UI: refresh state and show “This intent was already decided.”
- **Backend degraded / timeout**
  - UI: non-destructive error; allow retry; show request ID.

## State machine + UX mapping
- `PENDING_APPROVALS` → `APPROVED` (once required approvals met)
- `PENDING_APPROVALS` → `DENIED`
- If step-up required: approval decision may trigger a transition back to verification/challenge states (policy-dependent).

## Telemetry + audit expectations
- **Client events**: `approval_queue_view`, `approval_open_intent`, `approval_submit`, `approval_success`, `approval_error`
- **Audit log**: decision recorded with actor + policy version + signature metadata (if applicable)

## Copy review checklist
- Calm/neutral language per `../CONTENT_GUIDELINES.md`
- Deny reasons are structured (reason codes) where possible
- No sensitive data leaked in toasts

## Test checklist (manual + automated)
- [ ] Approve happy path
- [ ] Deny happy path
- [ ] Double-submit protection
- [ ] Stale state handling (already decided)
- [ ] Keyboard-only
- [ ] Screen reader pass

