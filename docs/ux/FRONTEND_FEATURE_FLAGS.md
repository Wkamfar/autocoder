# Frontend Feature Flags (Wire2)

**Owner:** Agent 2 (Frontend) + Agent 0 (Coordination)  
**Last updated:** 2026-01-14

This document inventories feature flags and defines how to add new ones safely.

## Current inventory

As of 2026-01-14: **no runtime feature flags are in active use** in `wire2/frontend/`.

## Policy (how to add a new feature flag)

- **Prefer “ship dark”**: land code behind a flag, then enable per environment.
- **Flags must be removable**: every flag includes a delete-by date or milestone.
- **Flags must be testable**: add at least one deterministic check for both enabled/disabled behavior (unit or route/regression check).

## Recommended implementation approach

For frontend-only behavior:

- Use `import.meta.env` with explicit `VITE_`-prefixed env vars (e.g., `VITE_FEATURE_NEW_APPROVAL_UI=1`)
- Provide a single `FeatureFlags` module (one place to read env and compute booleans)
- Avoid sprinkling env reads throughout components

For cross-stack behavior:

- Prefer **backend-driven flags** (capabilities) returned from `/api/wire/me` or a capabilities endpoint,
  so UI reflects server truth and avoids “UI says yes, server says no”.

## Guardrails

- Never hide security requirements behind flags (authz must always be enforced server-side).
- Never change or remove routes behind a flag without adding redirects/route checks.
- If a flag changes API request/response behavior, treat it as an **API contract change**:
  - see `wire2/backend/docs/API_CONTRACTS.md`

