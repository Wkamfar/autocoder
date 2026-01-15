# Wire2 IAM Mapping (SCIM Groups → Roles + Account Linking)

**Objective:** deterministic, auditable role assignment and safe user lifecycle via SCIM and SSO.

---

## Role model (baseline)

Example baseline roles (names are illustrative; canonical set should be in the backend):

- `ORG_ADMIN`
- `FINANCE_ADMIN`
- `APPROVER`
- `VIEWER`

**Rules**

- Authorization decisions are server-side only.
- UI may display capabilities but must reflect server truth.
- Role assignment must be explainable (“why does this user have this role?”) and auditable.

---

## SCIM as source of truth

### SCIM Users

- Create/update user profile fields.
- Deactivate users via `active=false`.
- **Deactivation semantics**: immediate session revocation + deny refresh + deny new sessions.

### SCIM Groups

- Group membership drives role assignment.
- Group rename behavior must be defined (either stable external IDs or name-based mapping).

**Idempotency**

- All SCIM writes must be idempotent (provider retries are common).
- Use stable SCIM `id` (or externalId) as primary identity key.

---

## Mapping strategy (recommended)

### Approach A: explicit mapping table (preferred)

Maintain per-tenant mapping:

`scim_group_id` → `role` (and optionally `scope`, if roles are scoped to legal entity/account)

Benefits:

- Stable across group name changes
- Easy to audit and export

### Approach B: naming convention mapping (acceptable, riskier)

E.g. group names like `wire2:approver`, `wire2:org_admin`.

Risks:

- Renames break access
- Harder to explain in audits

---

## Account linking rules (OIDC identities → user)

Key identifiers:

- `issuer` (`iss`)
- `subject` (`sub`)
- `email` (only if verified and allowed by policy)

**Linking policy**

- Default: `iss+sub` is the primary identity key.
- Email-based linking must require `email_verified=true` and must be tenant-policy controlled.
- Conflicts must fail safe (no silent merges); require admin approval and emit audit events.

---

## Break-glass policy (summary)

- Break-glass users are local to Wire2 (not IdP).
- Must be extremely limited:
  - strict IP allowlist
  - hardware key (WebAuthn) preferred
  - alerts on every use
  - periodic access review + forced rotation

---

## Required audit events

All IAM changes must emit events described in `wire2/backend/docs/AUTH_EVENTS.md`:

- SCIM user created/updated/deactivated
- SCIM group created/updated/deleted
- Group membership change
- Role assignment change (effective role set changed)
- Identity linked/unlinked
- Break-glass enabled/used/disabled

