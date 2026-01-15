# Flow: Evidence View + Export (Audit Bundle)

Uses: `../ACCEPTANCE_CRITERIA_TEMPLATE.md`

## Metadata
- **Flow name**: Evidence view/export
- **Owner**: UX/PM
- **Last updated**: 2026-01-14
- **Primary user roles**: Auditor, Compliance, Admin (and any role granted evidence permissions)
- **Entry points**:
  - `/v2/evidence/:intentId`
  - Deep link from intent detail `/v2/intents/:id`
- **Related docs**:
  - `../CRITICAL_FLOWS_AND_ROUTES.md`
  - `../CONTENT_GUIDELINES.md`

## Preconditions
- User authenticated? **Y**
- Required permissions/roles:
  - View: `evidence:view`
  - Export full: `evidence:export_full`
  - Export redacted: `evidence:export_redacted`
- Required org/tenant state: intent exists and belongs to org
- Required integrations: storage available (bundle retrieval)

## Happy path (view)
1. User opens `/v2/evidence/:intentId`.
2. UI loads the bundle metadata, manifest, and verification status.
3. User can view key sections (intent summary, approvals, verification/proof, event log).

## Happy path (export)
1. User clicks **Export** and chooses **Full** or **Redacted** based on permission.
2. UI downloads file or opens a signed URL.
3. UI confirms export action (with timestamp) and remains on the evidence page.

## Success criteria (must be true)
- **Correctness**
  - Bundle shown matches the intent; hash/signature verification status is clearly displayed.
  - Export mode respects permissions (full vs redacted).
- **UX clarity**
  - Page explains what evidence is and how to validate it (calm, specific).
  - Redaction rules are visible (what’s removed) when using redacted export.
- **Performance**
  - Large sections use progressive rendering; no frozen UI.
- **Accessibility**
  - Structured headings; keyboard navigation; copyable hashes.
- **Security + trust**
  - Signed URLs are time-bounded; no secrets shown in UI.
  - Hard failures show request ID for support.

## Failure modes (expected + handling)
- **Permission denied (403)**
  - UI: show “You don’t have access” + guidance to request permission.
- **Bundle not ready**
  - UI: show state + refresh CTA; don’t imply data loss.
- **Storage down**
  - UI: “Service temporarily unavailable” + retry guidance.

## Telemetry + audit expectations
- **Client events**: `evidence_view`, `evidence_export_click`, `evidence_export_success`, `evidence_export_error`
- **Audit log**: evidence export action recorded with actor + mode + request ID

## Test checklist (manual + automated)
- [ ] Evidence page loads for valid intent
- [ ] Permission-gated exports work
- [ ] Storage error state is actionable
- [ ] Keyboard-only
- [ ] Screen reader pass

