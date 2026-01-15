# State Machine Labels (Canonical UI Copy)

This document prevents “enum drift” between backend canonical statuses and what users see in the UI.

## Intent status (`IntentStatus`)

| Enum | UI label (recommended) |
|------|-------------------------|
| `DRAFT` | Draft |
| `PENDING_PROOF` | Verification required |
| `CHALLENGING` | Verifying |
| `PENDING_APPROVALS` | Awaiting approvals |
| `APPROVED` | Approved |
| `DENIED` | Denied |
| `EXECUTED` | Executed |
| `EXPIRED` | Expired |
| `CANCELED` | Canceled |

## Request status (`RequestStatus`)

| Enum | UI label (recommended) |
|------|-------------------------|
| `DRAFT` | Draft |
| `PENDING_VERIFICATION` | Verification required |
| `PENDING_APPROVAL` | Awaiting approval |
| `APPROVED` | Approved |
| `DENIED` | Denied |
| `PAID` | Paid |
| `EXPIRED` | Expired |

## Notes
- Use these labels consistently in badges, tables, filters, and detail headers.
- For “verification” UX, use the word **Verification** (not “fraud check”) per `CONTENT_GUIDELINES.md`.

