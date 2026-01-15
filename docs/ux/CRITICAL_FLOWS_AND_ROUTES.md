# Critical Flows + Route Inventory (WIRE2)

## Routing contract (do not break)
- **Frontend build base**: `/v2/` (see `wire2/frontend/vite-wire.config.ts`)
- **Router basename**: `/v2` (see `wire2/frontend/src/main-wire.tsx`)
- **Note**: Some docs/environments may expose a `/wire/*` alias via redirects/rewrites. Treat that alias as **customer-facing** until explicitly removed with a migration plan.

## Source of truth
- **Router definitions**: `wire2/frontend/src/main-wire.tsx`
- **Deployment base path**: `wire2/frontend/vite-wire.config.ts`

## URL contract decision (must be explicit)
Until we explicitly remove it, assume:
- **Canonical**: `/v2/<route>`
- **Alias (compat)**: `/wire/<route>` (if enabled by rewrites/redirects)

## Auth / entry flows
Routes below are relative to `/v2`.

- **Login**: `/login`
  - Failure modes: invalid credentials, locked account, rate limited
- **Signup**: `/signup`
- **Forgot password**: `/forgot-password`
- **Reset password**: `/reset-password`
- **Magic link**: `/magic`
- **Invite accept**: `/invite/:token`
- **Voice onboarding**: `/onboarding/voice`
- **Public intent create**: `/public/intents/new`
- **Public intent view**: `/public/intents/:id`

## Primary app shell (authenticated area)
All routes below render under the shell route: `/` (inside `WirePage`).

- **Home / Intents index**: `/`
- **Intents list**: `/intents`
- **Intent detail**: `/intents/:id`
  - Must cover: state machine rendering, challenge/approval/execution UX, evidence links
- **Approvals**: `/approvals`
- **Beneficiaries**: `/beneficiaries`
- **Beneficiary intelligence**: `/beneficiaries/:id`
- **Requests queue**: `/requests`
- **New request**: `/requests/new`
- **Compliance**: `/compliance`
- **Evidence**: `/evidence/:intentId`
- **Policies**: `/policies`
- **Admin**: `/admin`
- **Help**: `/help`
- **Dev**: `/dev` (should be gated/hidden in prod as required)

## Settings area
Settings routes render under `/settings`:

- **Settings shell**: `/settings`
- **Overview**: `/settings/overview`
- **Profile**: `/settings/profile`
- **Accounts**: `/settings/accounts`
- **Security**: `/settings/security`
- **Security history**: `/settings/security-history`
- **Notifications**: `/settings/notifications`
- **Policies**: `/settings/policies`
- **API keys**: `/settings/api-keys`
- **Webhooks**: `/settings/webhooks`
- **Domains**: `/settings/domains`
- **Org groups**: `/settings/org-groups`
- **SSO**: `/settings/sso`
- **Advanced**: `/settings/advanced`
- **Help redirect**: `/settings/help` → `/help`

## Critical flow list (first pass)
Use `ACCEPTANCE_CRITERIA_TEMPLATE.md` to define acceptance criteria for each (store filled docs in `flows/`):

1. **Authenticate** (login + session persistence + logout)
2. **Recover access** (forgot/reset + invite accept)
3. **Create intent** (requests/new → intent created)
4. **Approve / reject** (approvals + decision record)
5. **Challenge / proof** (voice onboarding + challenge modal)
6. **Execute** (execution token → execute → final state + **signed receipt issued**)
7. **Evidence export/view** (bundle generation + UI view)
8. **Beneficiary lifecycle** (create/edit + intelligence page)
9. **Settings** (accounts/security/api keys/webhooks/domains)

