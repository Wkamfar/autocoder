# Flow: Execute Intent (Send Payment)

Uses: `../ACCEPTANCE_CRITERIA_TEMPLATE.md`

## Metadata
- **Flow name**: Execute Intent
- **Owner**: UX/PM
- **Last updated**: 2026-01-14
- **Primary user roles**: Treasury Initiator (and any role allowed to execute)
- **Entry points**:
  - Intent detail: `/v2/intents/:id`
- **Related docs**:
  - `../CRITICAL_FLOWS_AND_ROUTES.md`
  - `../CONTENT_GUIDELINES.md`

## Preconditions
- User authenticated? **Y**
- Required permissions/roles: `intent:execute`
- Required org/tenant state:
  - intent exists
  - approvals complete (if required)
  - verification complete (if required)
  - cooldown not active (if policy requires)
- Required integrations: bank link present and healthy (or equivalent execution provider)

## UX contract (non-breaking)
- Existing routes preserved? **Y**
- Existing terminology preserved? **Y**
- Any new UI behind feature flag? **NA**

## Happy path (step-by-step)
1. User opens `/v2/intents/:id` and sees intent is ready to execute.
2. User clicks “Execute”.
3. UI confirms (if required), then requests an execution token and performs execute call.
4. UI shows execution progress, then transitions to final state `EXECUTED`.
5. Backend returns a **POSE signed receipt** (portable JWS) for the execution; UI can surface “Receipt issued” and link to verification guidance.
6. Evidence link is available (if applicable) and execution result summary is visible.

## Success criteria (must be true)
- **Correctness**
  - Execute is disabled unless prerequisites satisfied; disabled state includes explicit reason.
  - Execute is idempotent (retry does not double-send).
  - After execution, UI reflects backend canonical status and immutable event log.
- **Receipt issuance**
  - On successful execute, backend returns a signed receipt (`poseReceipt`) and it can be verified via JWKS / server-side verifier.
  - Receipt verification guidance is clear (see `wire2/backend/docs/POSE_SIGNED_RECEIPT_SPEC.md`).
- **UX clarity**
  - User sees a clear “ready” checklist (approvals/verification/bank link) before execute.
  - Progress state is visible; no ambiguous “hung” UI.
- **Performance**
  - Execution action provides immediate feedback; long operations show progress.
- **Accessibility**
  - Execute button + confirmation are keyboard accessible; progress updates are announced where appropriate.
- **Security + trust**
  - UI does not expose execution tokens.
  - Hard failures show request ID for support.

## Failure modes (expected + handling)
- **Not ready (precondition fails)**
  - UI: disable execute; show which prerequisite is missing (approval, verification, bank link, cooldown).
- **Permission denied (403)**
  - UI: “You don’t have access” + guidance to request permission.
- **Conflict / already executed (409)**
  - UI: treat as success; refresh state; show “Already executed”.
- **Execution provider down**
  - UI: show “Service temporarily unavailable” + retry guidance; preserve intent state.
- **Backend degraded / timeout**
  - UI: show non-destructive error; allow refresh; show request ID.

## State machine + UX mapping
- `APPROVED` → execute → `EXECUTED`
- `APPROVED` → `EXPIRED`/`CANCELED` (policy/system-driven)
- UI labels must map 1:1 to canonical statuses (see `../STATE_MACHINE_LABELS.md` once present).

## Telemetry + audit expectations
- **Client events**: `execute_click`, `execute_confirm`, `execute_success`, `execute_error`
- **Audit log**: execution requested + execution completed/failed, with correlation/request IDs

## Copy review checklist
- Calm/neutral language per `../CONTENT_GUIDELINES.md`
- Errors include next step
- No secrets/tokens displayed

## Test checklist (manual + automated)
- [ ] Execute happy path
- [ ] Execute disabled reasons correct
- [ ] Retry/refresh does not double-execute
- [ ] Already executed handling
- [ ] Receipt is issued on successful execute and verifies (JWKS / server-side verifier)
- [ ] Keyboard-only
- [ ] Screen reader pass

