# Flow: Evidence Export + Verify (Audit Chain)

Uses: `../ACCEPTANCE_CRITERIA_TEMPLATE.md`

## Metadata
- **Flow name**: Evidence export/verify
- **Owner**: UX/PM
- **Last updated**: 2026-01-14
- **Primary user roles**: Auditor, Compliance, Admin
- **Entry points**:
  - `/v2/evidence/:intentId`
  - Any “Verify evidence” CTA surfaced on evidence page or compliance tools
- **Related docs**:
  - `EVIDENCE_EXPORT_VIEW.md`
  - `../CONTENT_GUIDELINES.md`

## Preconditions
- User authenticated? **Y**
- Required permissions/roles:
  - View: `evidence:view`
  - Export: `evidence:export_full` / `evidence:export_redacted`
- Required org/tenant state: intent belongs to org
- Required integrations: storage available (exports), backend verify endpoints reachable

## Happy path (export then verify)
1. User opens `/v2/evidence/:intentId` and confirms bundle exists.
2. User exports **Full** or **Redacted** based on permission.
3. User runs verification (UI button or external tool):
   - Intent-level bundle verification status is shown in UI.
   - Org-level audit chain verify/list endpoints are available for auditors.

## Success criteria (must be true)
- **Correctness**
  - UI distinguishes:
    - **Bundle integrity** (manifest hash/signature)
    - **Audit chain integrity** (event log chain verification)
  - Verification results are deterministic and reproducible.
- **UX clarity**
  - “Verified” state explains *what* was verified (bundle vs chain) and *when*.
  - Failures include actionable next steps (refresh, retry, contact admin).
- **Security + trust**
  - Signed URLs expire and are not logged.
  - Hard failures show request ID for support.

## Failure modes (expected + handling)
- **Verification fails**
  - UI: “Verification failed” with plain-language explanation (tampering detected / missing segments / signature invalid).
  - UI: provide “Download verification report” (if supported) or copyable details.
- **Verify endpoints unavailable**
  - UI: degrade gracefully; allow retry; do not show false “Verified”.
- **Permission denied**
  - UI: do not show verify/export controls; explain required permission.

## API surface expectations (for auditors)
These are referenced for acceptance criteria and should remain stable:
- Org audit chain verify: `GET /api/wire/audit/events/verify`
- Org audit chain list: `GET /api/wire/audit/events`
- (Optional) Intent event verify: `GET /api/wire/intents/:id/events/verify` (if present)

## Telemetry + audit expectations
- **Client events**: `evidence_verify_click`, `evidence_verify_success`, `evidence_verify_error`
- **Audit log**: evidence export actions recorded (actor + mode + request ID)

## Test checklist (manual + automated)
- [ ] Export full vs redacted permission gating
- [ ] Verified state shows scope (bundle vs chain) and timestamp
- [ ] Failure path is actionable (no scary copy)
- [ ] Keyboard-only
- [ ] Screen reader pass

