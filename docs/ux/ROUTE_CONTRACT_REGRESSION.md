# Route Contract Regression Check (Wire2 Frontend)

**Owner:** Agent 2 (Frontend) + Agent 0 (Coordination)  
**Last updated:** 2026-01-14

This check prevents accidental route drift and base-path regressions for Wire2.

## What it enforces

- No duplicate routes in `wire2/frontend/src/main-wire.tsx`
- All routes referenced in `wire2/docs/ux/CRITICAL_FLOWS_AND_ROUTES.md` exist in the router
- Frontend base path consistency:
  - `BrowserRouter basename="..."` matches `vite-wire.config.ts` `base: '...'`

## Where it lives

- Script: `wire2/frontend/scripts/route-regression-check.mjs`
- NPM script: `npm run check:routes` (from `wire2/frontend/`)

## How to run

From `wire2/frontend/`:

```bash
npm run check:routes
```

Expected output:

- `[route-regression-check] OK`

