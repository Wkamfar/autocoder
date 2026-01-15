## Tenant Isolation Invariants (Agent 4 / Agent 0 sign-off)

### Goal
Make cross-tenant reads/writes **impossible by construction**. The system must fail closed if `orgId` is missing or mismatched.

### Definitions
- **Tenant / Org**: `Organization` identified by `orgId`.
- **Tenant-scoped data**: any row that must not be visible across org boundaries.
- **Tenant anchor**: a value that proves tenancy for a request (`req.user.orgId`, `apiKey.orgId`, job payload `orgId`).

### Invariants (must hold everywhere)
- **I1 — Every tenant-scoped read is org-scoped**:
  - Any read that returns tenant data must include `orgId` in the query predicate (or use a compound unique key including `orgId`).
  - Forbidden pattern: `findUnique({ where: { id } })` for tenant-scoped models (unless the unique is unguessable and explicitly allowlisted).

- **I2 — Every tenant-scoped write is org-anchored**:
  - Any create/update must write an explicit `orgId` column where present.
  - Any relation between rows must be enforced such that **both sides share the same `orgId`**.

- **I3 — Cross-tenant association is blocked at the DB layer wherever feasible**:
  - Use composite foreign keys like `(child.intentId, child.orgId) -> (Intent.id, Intent.orgId)`.
  - Use composite references for users like `(child.userId, child.orgId) -> (User.id, User.orgId)`.

- **I4 — No existence leaks across tenants**:
  - Requests must not return different errors for “exists in another org” vs “does not exist”.
  - Prefer `findFirst({ where: { id, orgId } })` and return 404 for missing rows.

- **I5 — System actions must still be tenant-safe**:
  - Background jobs must include `orgId` in their payload and use org-scoped queries.
  - For system-generated audit events, `createdByUserId` may be null, but `orgId` must always be present.

### DB patterns (enforced in Wire2)
- **Composite uniqueness helpers**:
  - `@@unique([id, orgId])` for tenant-scoped models that need composite foreign keys.
- **Composite FK examples**:
  - `Intent(beneficiaryId, orgId) -> Beneficiary(id, orgId)`
  - `IntentEvent(intentId, orgId) -> Intent(id, orgId)`
  - `VoiceProof(challengeId, orgId) -> VoiceChallenge(id, orgId)`
  - `Decision(createdByUserId, orgId) -> User(id, orgId)`

### Guardrails (to prevent regressions)
- **Static check**: `npm run guard:tenancy`
  - Fails if tenant-scoped models are loaded via `findUnique({ where: { id } })` without org scoping.
- **Attack tests**: cross-tenant write attempts must fail deterministically (service + DB).

### Known footguns
- **Caching without org in the cache key**: must key caches by `orgId:intentId`.
- **Async / jobs**: job payloads that omit `orgId` force unscoped queries later.
- **Global singletons**: must be explicitly documented and allowlisted (e.g., service health).

