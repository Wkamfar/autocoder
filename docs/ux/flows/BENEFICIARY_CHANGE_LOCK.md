# Flow: Beneficiary Change + Lock (High-Risk Control Surface)

Uses: `../ACCEPTANCE_CRITERIA_TEMPLATE.md`

## Metadata
- **Flow name**: Beneficiary change/lock
- **Owner**: UX/PM
- **Last updated**: 2026-01-14
- **Primary user roles**: Admin, Treasury Initiator (change where allowed), Auditor (view)
- **Entry points**:
  - `/v2/beneficiaries/:id` (detail)
  - Inline “Lock beneficiary” actions (where present)
- **Related docs**:
  - `BENEFICIARY_LIFECYCLE.md`
  - `../CONTENT_GUIDELINES.md`
  - `../STATE_MACHINE_LABELS.md`

## Preconditions
- User authenticated? **Y**
- Required permissions/roles:
  - Change: `beneficiary:create` (or a dedicated edit permission if introduced)
  - Lock: `beneficiary:lock`
- Required org/tenant state: beneficiary belongs to org

## Happy path (change)
1. User opens `/v2/beneficiaries/:id`.
2. User edits allowed fields (display name, rails allowed, masked identifiers, etc.).
3. UI shows a “Review changes” summary with **before/after** diff.
4. User confirms; UI saves and shows a **new version** number and “Changed by / Changed at”.

## Happy path (lock)
1. Admin clicks “Lock beneficiary”.
2. UI shows a confirmation explaining impact:
   - new intents cannot target this beneficiary
   - existing intents referencing this beneficiary may be blocked per policy (must reflect backend truth)
3. Admin confirms; beneficiary status becomes `LOCKED`.

## Success criteria (must be true)
- **Correctness**
  - Versioning: changes result in a new `version` where required; existing intents show which beneficiary version they reference.
  - Locking is enforced by backend (no “cosmetic lock”); UI reflects server-side truth on refresh.
- **UX clarity**
  - Users are warned that beneficiary edits are high-risk and may trigger verification/approval requirements (policy-driven).
  - Locking confirmation clearly states what will and will not be blocked.
- **Accessibility**
  - Change diff is readable and navigable; confirmation modal manages focus.
- **Security + trust**
  - No full bank details displayed; only masked/last4.
  - Hard failures include request ID.

## Failure modes (expected + handling)
- **Permission denied (403)**
  - UI: disable edit/lock with reason; guidance to request access.
- **Conflict / version mismatch (409)**
  - UI: show “This beneficiary was updated by someone else” + refresh CTA; preserve user edits if possible.
- **Policy requires step-up**
  - UI: “Verification required” path is explicit (do not silently fail).
- **Backend degraded / timeout**
  - UI: non-destructive error; allow retry; show request ID.

## Telemetry + audit expectations
- **Client events**: `beneficiary_change_view`, `beneficiary_change_submit`, `beneficiary_lock_click`, `beneficiary_lock_confirm`
- **Audit log**:
  - beneficiary updated (fields, previous hash/version, new hash/version)
  - beneficiary locked/unlocked (if supported)
  - actor + org + request ID

## Test checklist (manual + automated)
- [ ] Change produces new version and shows diff
- [ ] Lock blocks relevant actions (create intent/execution) per backend
- [ ] Conflict handling preserves user intent
- [ ] Keyboard-only
- [ ] Screen reader pass

