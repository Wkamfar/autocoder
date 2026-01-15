# UX / PM Artifacts (WIRE2)

This folder contains the “don’t break what works” UX artifacts referenced in `WIRE2_BANK_GRADE_ROADMAP.md`.

## What’s here
- `ACCEPTANCE_CRITERIA_TEMPLATE.md`: reusable acceptance criteria template per critical flow
- `CRITICAL_FLOWS_AND_ROUTES.md`: route inventory + critical flow list (and routing contract)
- `STATE_MACHINE_LABELS.md`: canonical enum → UI label mapping (prevents copy drift)
- `PAPER_CUTS_BACKLOG.md`: severity-tagged UX backlog
- `CONTENT_GUIDELINES.md`: copy guidelines (calm, neutral, consistent)
- `flows/`: filled-out acceptance criteria docs for specific flows (start here when executing)

## How to use (weekly cadence)
1. Pick 1–2 **critical flows** from `CRITICAL_FLOWS_AND_ROUTES.md`.
2. Create/update a doc in `flows/` using `ACCEPTANCE_CRITERIA_TEMPLATE.md`.
3. Add new UX issues to `PAPER_CUTS_BACKLOG.md` with severity + owner.
4. Run a quick copy review against `CONTENT_GUIDELINES.md` before shipping UX changes.

## Starting point (recommended)
- `flows/AUTHENTICATE.md`: “gold standard” example of a filled-out flow doc.

## Top flows (sign-off set)
- `flows/AUTHENTICATE.md`
- `flows/CREATE_INTENT.md`
- `flows/APPROVE_INTENT.md`
- `flows/CHALLENGE_PROOF.md`
- `flows/EXECUTE_INTENT.md`

## Next flow docs to maintain
- `flows/RECOVER_ACCESS.md`
- `flows/EVIDENCE_EXPORT_VIEW.md`
- `flows/BENEFICIARY_LIFECYCLE.md`
- `flows/SETTINGS_INTEGRATIONS.md`

