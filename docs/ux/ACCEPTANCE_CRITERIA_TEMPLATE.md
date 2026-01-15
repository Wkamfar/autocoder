# UX Acceptance Criteria Template (WIRE2)

Use this template to define UX acceptance criteria for each critical flow. Keep criteria testable (observable in UI + network + logs) and include failure modes.

## Quick links
- Route inventory: `CRITICAL_FLOWS_AND_ROUTES.md`
- Copy rules: `CONTENT_GUIDELINES.md`
- Known issues: `PAPER_CUTS_BACKLOG.md`

## Metadata
- **Flow name**:
- **Owner**:
- **Last updated**:
- **Primary user roles**: (e.g. Initiator, Approver, Admin, Compliance)
- **Entry points**: (routes, deep links, buttons)
- **Environments**: (dev/stage/prod differences)
 - **Related docs**: (links)

## Preconditions
- User authenticated? (Y/N)
- Required permissions/roles:
- Required org/tenant state:
- Required integrations: (bank linked, webhooks configured, SSO enabled, etc.)

## UX contract (non-breaking)
- Existing routes preserved? (Y/N)
- Existing terminology preserved? (Y/N)
- Any new UI behind feature flag? (Y/N/NA)

## Happy path (step-by-step)
1.
2.
3.

## Success criteria (must be true)
- **Correctness**
  - UI state matches backend canonical state machine exactly (no “optimistic lies”).
  - Idempotent actions are safe to retry (button, refresh, back/forward).
- **UX clarity**
  - Clear next action; no dead ends.
  - Empty states include primary CTA + explanation.
- **Performance**
  - First meaningful render within acceptable threshold (define target per page).
  - Long operations show progress + can be safely resumed.
- **Accessibility**
  - Keyboard navigation works end-to-end; focus is visible and managed.
  - Errors are announced (ARIA) and tied to fields.
- **Security + trust**
  - No sensitive data in URLs/toasts.
  - Step-up/challenges use calm language; avoid panic/scare copy.

## Failure modes (expected + handling)
For each failure mode, specify UI behavior, retry, and message copy.

- **Network offline / timeout**
- **403/permission denied**
- **Validation error**
- **Conflict/idempotency replay**
- **Backend degraded (partial outage)**

## State machine + UX mapping
- **Backend states**: (list)
- **UI labels**: (what the user sees)
- **Allowed transitions**: (what actions are enabled)

## Telemetry + audit expectations
- **Client events**: (page_view, click, submit, retry, error_shown)
- **Correlation**: request ID shown in error UI (copy/pasteable)
- **Audit log**: which actions must land in immutable audit

## Copy review checklist
- Uses calm/neutral language per `CONTENT_GUIDELINES.md`
- Errors include a next step
- No secrets/PII in toasts or URLs

## Test checklist (manual + automated)
- [ ] Happy path
- [ ] Refresh during each major step
- [ ] Back/forward behavior
- [ ] Mobile layout sanity
- [ ] Keyboard-only
- [ ] Screen reader pass

