# Audit Event Schema (Canonical Envelope)

**Version:** 1.0  
**Last Updated:** 2026-01-14  
**Owner:** Agent 6 (Evidence / Audit / Compliance)

## Goal

Define a single, canonical audit event envelope that is:

- **Deterministic** (stable canonical JSON for hashing/signing)
- **Portable** (exportable without internal context)
- **Court‑ready** (actor/tenant/request context, clear outcome, safe redactions)

This schema is used in two places:

- **Intent-scoped event chain** (`IntentEvent`): tamper‑evident chain per transfer intent
- **Org-scoped audit event chain** (`OrgAuditEvent`): tamper‑evident chain for non‑intent sensitive domains (API keys, webhooks, beneficiary + policy changes, etc.)

## Canonicalization

All envelope objects MUST be serialized via canonical JSON:

- Spec: `wire2/backend/docs/CANONICAL_JSON_SPEC.md`
- Impl: `wire2/backend/src/lib/canonicalJson.ts` (`canonicalJsonStringify`)

The canonical JSON string is stored in DB as `payloadCanonicalJson` and included in the event hash computation.

## Envelope Fields

### Top-level shape

```json
{
  "schemaVersion": "1.0",
  "eventType": "string",
  "occurredAt": "2026-01-14T00:00:00.000Z",
  "tenant": { "orgId": "org_..." },
  "actor": {
    "type": "user",
    "userId": "user_...",
    "role": "ADMIN",
    "email": "admin@acme.com"
  },
  "subject": { "type": "api_key", "id": "apikey_..." },
  "request": {
    "requestId": "string|null",
    "correlationId": "string|null",
    "method": "POST",
    "path": "/api/wire/api-keys",
    "ipAddress": "string|null",
    "userAgent": "string|null",
    "authType": "bearer_or_basic|null"
  },
  "outcome": {
    "success": true,
    "code": "string|null",
    "error": "string|null"
  },
  "payload": {}
}
```

### Required / Optional rules

- **Required**
  - `schemaVersion`
  - `eventType` (stable name; see naming rules below)
  - `occurredAt` (ISO string)
  - `tenant.orgId`
  - `request.method`, `request.path` (or null if unavailable)
  - `outcome.success`
  - `payload` (may be `{}`)
- **Optional**
  - `actor` may be `{ "type": "system" }` when no user exists
  - `subject` may be `null` for truly unscoped events, but should be avoided
  - `request.requestId`, `request.correlationId`, `request.ipAddress`, `request.userAgent`, `request.authType`

## Event naming rules

- **Format**: lower snake/camel is allowed, but must be consistent per domain.
- **Recommended**: dot-separated domain prefix:
  - `api_key.created`, `api_key.revoked`, `api_key.deleted`
  - `webhook.created`, `webhook.updated`, `webhook.deleted`, `webhook.secret_rotated`, `webhook.test_sent`
  - `beneficiary.created`, `beneficiary.updated`, `beneficiary.locked`
  - `policy.version_created`

## Redaction rules (non-negotiable)

Never log secrets or raw credentials in `payload`, including:

- API key **secret**, webhook signing **secret**
- full bank account/routing numbers
- full voice audio blobs or embeddings

Use one of:

- omit the field entirely
- store a **prefix** (e.g., `keyPrefix`)
- store a **hash** that can be recomputed when needed

## Integrity linkage

### Intent event chain

- Spec: `wire2/backend/docs/EVENT_CHAIN_VERIFICATION.md`
- Implementation: `wire2/backend/src/modules/evidence/eventChain.ts`

### Org audit event chain

- Implementation: `wire2/backend/src/modules/evidence/orgEventChain.ts`
- API: `GET /api/wire/audit/events/verify` (RBAC: `audit:read`)

## Implementation reference (emitter)

- Canonical emitter used by non‑intent sensitive domains:
  - `wire2/backend/src/modules/audit/auditEvents.ts` (`emitOrgAuditEvent`)

