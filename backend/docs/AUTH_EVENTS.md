# Wire2 Auth & IAM Audit Events

**Objective:** ensure all identity/session/IAM actions are auditable, tenant-scoped, and compatible with evidence chaining.

This doc defines **what events must exist** for Agent 3 scope. For event envelope and chaining, align with:
- `wire2/backend/docs/EVENT_CHAIN_VERIFICATION.md`
- `wire2/backend/docs/SIGNING_KEY_MANAGEMENT.md`

---

## Event envelope (minimum required fields)

Every auth/IAM event must contain:

- `event_id` (unique)
- `event_type`
- `occurred_at` (trusted time source; document clock assumptions)
- `tenant_id`
- `request_id` / `trace_id`
- **actor** (who initiated):
  - `actor_type` (user/service)
  - `actor_user_id` (if user)
  - `actor_session_id` (if user)
  - `actor_ip` / `actor_asn` / `actor_user_agent` (where applicable)
- **subject** (what changed):
  - `subject_type` (user/session/identity/group/role_mapping)
  - `subject_id`
- `outcome` (success/failure)
- `failure_code` (if failure; from canonical error taxonomy)
- `metadata` (structured; must be redaction-safe)

---

## Required event types (minimum set)

### Authentication

- `auth.login.succeeded`
- `auth.login.failed`
- `auth.logout` (current session)
- `auth.logout_all`
- `auth.refresh.succeeded`
- `auth.refresh.failed`

### Sessions

- `session.created`
- `session.revoked`
- `session.revoked_all`
- `session.token_reuse_detected` (refresh replay → session kill)
- `session.assurance_changed` (step-up/MFA level changed)

### MFA / Step-up

- `mfa.challenge.started`
- `mfa.challenge.succeeded`
- `mfa.challenge.failed`
- `mfa.recovery_code.used` (if supported)

### Identity linking

- `identity.linked`
- `identity.unlinked`
- `identity.link_failed` (conflict/policy)

### SCIM provisioning

- `scim.user.created`
- `scim.user.updated`
- `scim.user.deactivated`
- `scim.group.created`
- `scim.group.updated`
- `scim.group.deleted`
- `scim.group_membership.changed`
- `iam.role_mapping.changed` (group→role mapping)

### Break-glass

- `break_glass.enabled`
- `break_glass.disabled`
- `break_glass.used`

---

## Redaction rules

Never include in event payloads:

- access tokens, refresh tokens, API keys, webhook secrets, bank tokens
- raw voice artifacts or biometric templates
- full PII beyond what is strictly required for audit (prefer stable internal IDs)

If email must be included, include only in controlled fields and ensure log redaction middleware is applied (see Agent 5).

