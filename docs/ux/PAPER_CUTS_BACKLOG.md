# UX “Paper Cuts” Backlog (WIRE2)

This is a living backlog of UX issues that degrade trust, clarity, or speed. Keep each item crisp and testable.

## Severity rubric
- **P0 (Blocking / trust-breaking)**: user cannot complete a core flow, or UI creates high-risk confusion (wrong account/amount/beneficiary), or security posture is unclear.
- **P1 (Material friction)**: core flow works but requires workarounds, repeated retries, unclear errors, or inconsistent state.
- **P2 (Polish / consistency)**: visual/wording inconsistencies, minor layout issues, nice-to-haves.

## Backlog

### P0
- **Routing alias mismatch (`/wire/*` vs `/v2/*`)**
  - **Problem**: codebase builds for `/v2/` but some docs/test references use `/wire/*`; risk of breaking customer-facing URLs during hardening.
  - **Fix**: document and enforce canonical public routes + add explicit redirects/rewrites tests in deploy config.
  - **Owner**: UX/PM + Ops
  - **References**: `wire2/docs/ux/CRITICAL_FLOWS_AND_ROUTES.md`, `wire2/frontend/src/main-wire.tsx`, `wire2/frontend/vite-wire.config.ts`

### P1
- **Error copy consistency**
  - **Problem**: error states differ by page; some show generic “Something went wrong” without actionable next step.
  - **Fix**: standard error taxonomy + page-level “what you can do now” guidance + request ID display.
  - **Owner**: UX/PM + FE

- **State machine labeling consistency**
  - **Problem**: backend states vs UI labels can drift (e.g. “Pending proof” vs “Awaiting verification”).
  - **Fix**: single mapping table + shared enums in UI + copy guidelines.
  - **Owner**: UX/PM + FE + BE

### P2
- **Empty state CTA consistency**
  - **Problem**: empty states vary in CTA placement and wording across Intents/Approvals/Beneficiaries/Requests.
  - **Fix**: standard empty state component pattern + copy rules.
  - **Owner**: UX/PM + FE

## How to add items
Add new items as:
- **Title**
  - **Problem**:
  - **Repro**:
  - **Expected**:
  - **Fix sketch**:
  - **Owner**:
  - **Severity**: P0/P1/P2

