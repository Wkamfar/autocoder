# Frontend Error Taxonomy Mapping (Wire2)

**Owner:** Agent 2 (Frontend) + Agent 10 (Backend)  
**Last updated:** 2026-01-14

This document describes how the frontend interprets backend errors so UX gating and messaging match server truth.

## Canonical frontend type: `WireApiError`

The frontend parses error responses into `WireApiError`:

- Source: `wire2/frontend/src/wire/api/errors.ts`
- Used by the API client: `wire2/frontend/src/wire/api/client.ts`

## Expected backend error payload

Frontend expects JSON shaped like:

- `code`: stable machine-readable string
- `error`: optional human-readable message (used as fallback)
- `details`: optional structured object
- `correlationId`: request correlation ID for support/debugging

If JSON is missing or invalid, the frontend falls back to `Response.statusText`.

## Error codes (current)

These codes are explicitly mapped to user-facing messages in `CODE_TO_MESSAGE`:

- `AUTH_REQUIRED`
- `PERMISSION_DENIED`
- `INVALID_REQUEST`
- `NOT_FOUND`
- `INTERNAL_ERROR`
- `INTENT_NOT_FOUND`
- `INTENT_INVALID_STATUS`
- `INTENT_IN_COOLDOWN`
- `CHALLENGE_NOT_FOUND`
- `BENEFICIARY_NOT_FOUND`
- `POLICY_NOT_CONFIGURED`
- `MISSING_APPROVAL_TOKEN`
- `APPROVAL_TOKEN_INVALID`
- `APPROVAL_TOKEN_EXPIRED`
- `APPROVAL_TOKEN_CONSUMED`
- `BINDING_HASH_MISMATCH`

**Forward compatibility:** unknown codes are tolerated (they render the backend `error` string if present; otherwise a generic fallback).

## How to add a new error code safely

- **Backend**
  - Return `{ code: "NEW_CODE", error?: "...", details?: {...}, correlationId?: "..." }`
  - Ensure the error is stable and documented (avoid silent renames)
- **Frontend**
  - Add `"NEW_CODE"` to the `WireErrorCode` union (optional but recommended)
  - Add `NEW_CODE` to `CODE_TO_MESSAGE` if it needs a specific UX string
  - Add/adjust UI gating to use `err.code` (never parse message text)

## Relationship to bank-grade contracts

- API contract / breaking-change policy: `wire2/backend/docs/API_CONTRACTS.md`
- “Bank-grade” measurable gates: `wire2/docs/bank_grade_acceptance_criteria.md`

