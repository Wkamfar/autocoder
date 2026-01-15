## Schema Tenancy Rules (DB constraints for tenant safety)

### Purpose
Define the minimum schema rules that make tenant isolation provable and hard to regress.

### Rule 1 — Tenant-scoped tables must have `orgId`
Any table representing customer/tenant data must include:
- `orgId TEXT NOT NULL`
- An index on `orgId` (and on `(orgId, <hot key>)` where relevant)

Examples:
- `Intent`, `Beneficiary`, `Webhook`, `ApiKey`, `UserInvitation`
- Intent-adjacent graph: `VoiceChallenge`, `VoiceProof`, `Decision`, `Approval`, `ApprovalToken`, `IntentEvent`, `AuditBundle`, `ExecutionLedger`

### Rule 2 — Enforce same-org relations using composite foreign keys
For any relation where a child points at a tenant-scoped parent, the FK should include `orgId`:

- **Child points to Intent**: use `(intentId, orgId) -> Intent(id, orgId)`
  - Applies to: `VoiceChallenge`, `VoiceProof`, `Decision`, `ApprovalToken`, `IntentEvent`, `AuditBundle`, `Approval`, `ExecutionLedger`

- **Child points to User**: use `(userId, orgId) -> User(id, orgId)`
  - Applies to: `Session`, `Decision(createdByUserId, orgId)`, `Approval(approverUserId, orgId)`, `ExecutionLedger(executedByUserId, orgId)`

- **Child points to other tenant-scoped parent**:
  - Example: `VoiceProof(challengeId, orgId) -> VoiceChallenge(id, orgId)`

### Rule 3 — Provide composite unique helpers where needed
Because Prisma/SQL composite FKs require the referenced columns to be unique, tenant-scoped tables should typically include:
- `@@unique([id, orgId])`

### Rule 4 — Prefer tenant-scoped unique constraints over global uniques
When a value is only required to be unique within an org, make it composite:
- `@@unique([orgId, domain])` (custom/email domains)
- `@@unique([orgId, name])` (legal entities)

Avoid global uniques unless the identifier is **unguessable** and intended to be global (e.g., token hashes).

### Rule 5 — System/audit rows still require `orgId`
Even if a row is created by a system process:
- `orgId` remains **required**
- Actor fields may be nullable (`createdByUserId NULL`) if no user exists

### Rule 6 — Indexing guidance (baseline)
- **Always** index `orgId` for tenant-scoped tables.
- For common access patterns:
  - `@@index([orgId, createdAt])` for time-ordered lists
  - `@@index([orgId, intentId])` for intent-adjacent lookups
  - For job/queue tables: `@@index([status, runAt])` (and include tenant if multi-tenant workers exist)

### Rule 7 — “Global” tables must be explicitly documented
If a table truly is global (no org):
- It must be explicitly documented as global and why it is safe
- Code must treat it as global intentionally (avoid mixing global + tenant contexts)

