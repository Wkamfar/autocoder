# API Contracts (Wire2 Backend)

**Owner:** Agent 0 (Coordinator/CTO) + Agent 10 (Backend)  
**Last updated:** 2026-01-14  
**Status:** Draft (adopt in CI)

This document defines **how we avoid breaking changes** between `wire2/frontend/` and `wire2/backend/`.

## Scope

- Applies to all endpoints under **`/api/wire/*`**.
- Applies to request/response shapes, enums, error taxonomy, pagination, idempotency, auth.

## Versioning & breaking changes

- **Default policy**: additive, backwards compatible changes only.
- **Breaking changes** require:
  - contract update in this doc (or OpenAPI if/when canonicalized)
  - expand/contract plan if DB involved
  - feature flag (when feasible)
  - rollback plan
  - release note

## URL & routing contract

Frontend base routing is defined in `wire2/docs/URL_CONTRACT.md`.  
Backend must not assume the frontend base path; backend paths remain stable under `/api/wire/*`.

## Error response contract

**Goal:** predictable machine‑readable errors + safe human message.

All non‑2xx responses should include:

- `error.code` (stable string)
- `error.message` (safe to display)
- `error.requestId` (for support)
- optional `error.details` (structured)

**Note:** If existing implementation differs, this doc is the target; align incrementally.

## Enums / state machines

- Enums returned by the backend are **canonical** and must be:
  - documented (name + meaning)
  - stable (no silent renames)
  - forward compatible (frontend must handle unknown values safely)

## Idempotency

Any endpoint that can trigger execution or durable side effects must support idempotency:

- Client sends `Idempotency-Key` (or equivalent)
- Server enforces idempotent semantics and returns same result for same key + principal + payload hash

See also:

- `wire2/backend/docs/MIGRATION_SAFETY.md`

## Authn / authz

- Authentication mechanisms and token semantics must be documented in backend README/docs.
- Authorization must be consistently enforced via org scoping rules (no “best effort”).

## Canonical JSON & signing

Evidence and signatures must follow canonical JSON rules:

- `wire2/backend/docs/CANONICAL_JSON_SPEC.md`
- `wire2/backend/docs/BUNDLE_FORMAT.md`
- `wire2/backend/docs/SIGNING_KEY_MANAGEMENT.md`

## Contract checks (CI gates)

**Minimum recommended gates**

- Route smoke: `/api/wire/health` is reachable and validates required fields
- Contract tests: critical endpoints and error codes
- OpenAPI diff (if/when OpenAPI becomes canonical for Wire2)

