# Audit Event Coverage Matrix (P0)

**Version:** 1.0  
**Last Updated:** 2026-01-14  
**Owner:** Agent 6 (Evidence / Audit / Compliance)

## Purpose

This doc defines the **minimum required audit event coverage** for “sensitive domains” outside the intent lifecycle, using the canonical envelope in:

- `wire2/backend/docs/AUDIT_EVENT_SCHEMA.md`

The guiding rule:

> Every sensitive mutation MUST emit a canonical audit event into a tamper‑evident chain, with actor + tenant + request context and safe redactions.

## Where events land

- **Non-intent domains**: `OrgAuditEvent` chain (`wire2/backend/src/modules/evidence/orgEventChain.ts`)
  - Emission via `wire2/backend/src/modules/audit/auditEvents.ts` (`emitOrgAuditEvent`)
  - API verification: `GET /api/wire/audit/events/verify`
- **Intent lifecycle**: `IntentEvent` chain (`wire2/backend/src/modules/evidence/eventChain.ts`)

## Coverage Table (P0)

### API keys

| Action | Required eventType | Subject | Must include payload keys | Must NOT include |
|---|---|---|---|---|
| Create API key | `api_key.created` | `api_key:{apiKeyId}` | `name`, `keyPrefix`, `permissions`, `expiresAt` | `secret`, `keyHash`, `secretHash` |
| Revoke API key | `api_key.revoked` | `api_key:{apiKeyId}` | (empty ok) | (n/a) |
| Delete API key | `api_key.deleted` | `api_key:{apiKeyId}` | (empty ok) | (n/a) |

**Implementation**: `wire2/backend/src/routes/apiKeys.ts`

### Webhooks

| Action | Required eventType | Subject | Must include payload keys | Must NOT include |
|---|---|---|---|---|
| Create webhook | `webhook.created` | `webhook:{webhookId}` | `name`, `url`, `events`, `active` | `secretHash`, raw secret |
| Update webhook | `webhook.updated` | `webhook:{webhookId}` | `name?`, `url?`, `events?`, `active?` (patch) | raw secret |
| Delete webhook | `webhook.deleted` | `webhook:{webhookId}` | (empty ok) | (n/a) |
| Rotate secret | `webhook.secret_rotated` | `webhook:{webhookId}` | (empty ok) | new secret |
| Send test | `webhook.test_sent` | `webhook:{webhookId}` | `deliveryId` | (n/a) |

**Implementation**: `wire2/backend/src/routes/webhooks.ts`

### Beneficiaries

| Action | Required eventType | Subject | Must include payload keys | Must NOT include |
|---|---|---|---|---|
| Create beneficiary | `beneficiary.created` | `beneficiary:{beneficiaryId}` | `displayName`, `country`, `railsAllowed`, `bankLast4`, `status`, `version` | `bankTokenHash`, full account/routing |
| Update beneficiary | `beneficiary.updated` | `beneficiary:{beneficiaryId}` | `patch`, `resulting.status`, `resulting.version` | `bankTokenHash` |
| Lock beneficiary | `beneficiary.locked` (or `beneficiary.updated` with status) | `beneficiary:{beneficiaryId}` | status transition info | `bankTokenHash` |

**Implementation**: `wire2/backend/src/routes/wire.ts` (beneficiary endpoints)

### Policies

| Action | Required eventType | Subject | Must include payload keys | Must NOT include |
|---|---|---|---|---|
| Create policy version | `policy.version_created` | `policy:{policyId}` | `policyId`, `version`, `thresholds`, `rules` | secrets |

**Implementation**: `wire2/backend/src/routes/wire.ts` (`POST /policies`)

### User lifecycle (invites + provisioning + deprovision + session revocation)

| Action | Required eventType | Subject | Must include payload keys | Must NOT include |
|---|---|---|---|---|
| Create user | `user.created` | `user:{userId}` | `email`, `name`, `role`, `permissions` | password, passwordHash |
| Update user | `user.updated` | `user:{userId}` | `patch`, `previous`, `resulting` | password, passwordHash |
| Change role | `user.role_changed` | `user:{userId}` | `previous.role`, `resulting.role` | password, passwordHash |
| Soft delete user | `user.deleted_soft` | `user:{userId}` | `previousRole`, `previousPermissionsCount` | (n/a) |
| Create invitation | `invitation.created` | `invitation:{invitationId}` | `email`, `role`, `expiresAt` | invitation token, tokenHash |
| Revoke invitation | `invitation.revoked` | `invitation:{invitationId}` | (empty ok) | invitation token, tokenHash |
| Accept invitation (public) | `invitation.accepted` | `invitation:{invitationId}` | `userId`, `email`, `role` | password |
| Logout current session | `session.logout` | `session:{sessionId}` | `sessionId` | tokens |
| Logout all sessions | `session.logout_all` | `user:{userId}` | `revoked`, `includeCurrent` | tokens |
| Revoke all sessions (admin) | `session.revoked_all` | `user:{userId}` | `revoked` | tokens |

**Implementation**:
- `wire2/backend/src/routes/users.ts`
- `wire2/backend/src/routes/invitations.ts`
- `wire2/backend/src/routes/auth.ts`

## Audit event verification (P0)

- **Verify org chain**: `GET /api/wire/audit/events/verify`
- **List events**: `GET /api/wire/audit/events?days=…&limit=…`

## Notes / Follow-ups

- Expand coverage to **bank connectors** (`bank:*`), **provider events**, **SSO/SCIM**, and **org/user admin** once those domains stabilize.
- If/when external auditors need offline verification, add an export bundle for org audit chain similar to intent bundles.

