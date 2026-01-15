# URL Contract (Wire2)

**Owner:** Agent 0 (Coordinator/CTO) + Agent 1 (UX/PM) + Agent 2 (Frontend)  
**Last updated:** 2026-01-14  
**Status:** Active (treat as a breaking-change surface)

This document defines the **public URL contract** for Wire2 and how we prevent accidental breakage.

## Canonical base paths

- **Frontend app base**: **`/v2`**
  - Implemented in frontend router as `BrowserRouter basename="/v2"` (`wire2/frontend/src/main-wire.tsx`).
- **Backend API base**: **`/api/wire`**
  - Frontend client calls `/api/wire/*` endpoints.

## Supported customer-facing aliases

We may support **`/wire/*` as an alias** for customer-facing compatibility.

**Rule:** `/wire/*` must map to `/v2/*` (path preserved).

Examples:

- `/wire` → `/v2/`
- `/wire/login` → `/v2/login`
- `/wire/intents/123` → `/v2/intents/123`
- `/wire/public/intents/new` → `/v2/public/intents/new`

## Redirect vs rewrite

**Preferred behavior (SEO + clarity):**

- Use **301/308 redirects** from `/wire/*` → `/v2/*` in production.

**Repo-controlled implementation (frontend container):**

- The Wire2 frontend Docker image implements `/wire/*` → `/v2/*` redirects in Nginx config (`wire2/frontend/Dockerfile`).

**Acceptable behavior (platform-dependent):**

- Use **rewrites** if redirects are not possible, but ensure canonical URL is discoverable.

## Non-breaking rules

- Do not rename/remove existing routes without:
  - adding a redirect for the old path
  - updating UX flow docs
  - adding regression coverage (see below)
- Do not change the frontend base (`/v2`) without treating it as a breaking change and coordinating a full migration.

## Regression coverage (required)

At minimum, CI should assert:

- App loads at `/v2/` and key routes render
- Alias paths redirect (or rewrite) correctly:
  - `/wire` → `/v2/`
  - `/wire/login` → `/v2/login`
  - `/wire/public/intents/new` → `/v2/public/intents/new`
- No accidental change to router `basename`

## Where routes are documented

- Critical routes + flows:
  - `wire2/docs/ux/CRITICAL_FLOWS_AND_ROUTES.md`
  - `wire2/docs/ux/flows/*`

