# WIRE API Contract Documentation

**Owner:** Agent A  
**Last Updated:** 2025-12-31  
**Status:** ✅ Complete

## Overview

This document provides comprehensive documentation of the `/api/wire/*` API contract, including:
- All endpoint specifications
- Request/response schemas
- Error handling
- Type compatibility with frontend
- Validation rules

## Base URL

All endpoints are prefixed with `/api/wire`.

## Authentication

**Current (Demo Mode):**
- Uses `X-USER-ID` header
- User context is extracted from header

**Future (Production):**
- OIDC/SAML authentication
- JWT bearer tokens
- Session management

## Error Response Format

All errors follow this standardized format:

```typescript
{
  error: string;        // Human-readable error message
  code?: string;        // Machine-parseable error code
  details?: object;     // Additional error context
}
```

### Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Invalid request body or parameters |
| `MISSING_APPROVAL_TOKEN` | 400 | Missing X-POSE-APPROVAL header |
| `INTENT_NOT_FOUND` | 404 | Intent not found |
| `BENEFICIARY_NOT_FOUND` | 404 | Beneficiary not found |
| `POLICY_NOT_CONFIGURED` | 404 | No policy configured |
| `PERMISSION_DENIED` | 403 | Insufficient permissions |
| `INTENT_INVALID_STATUS` | 400 | Intent not in required status |
| `INTENT_IN_COOLDOWN` | 400 | Intent is in cooldown period |
| `APPROVAL_TOKEN_INVALID` | 400 | Invalid approval token |
| `APPROVAL_TOKEN_EXPIRED` | 400 | Approval token expired |
| `APPROVAL_TOKEN_CONSUMED` | 400 | Approval token already consumed |
| `INTERNAL_ERROR` | 500 | Internal server error |

## Endpoints

### Health

#### GET /health

Get service health status.

**Response:** `200 OK`
```json
{
  "voiceService": "healthy" | "degraded" | "down",
  "phoneService": "healthy" | "degraded" | "down",
  "storageService": "healthy" | "degraded" | "down"
}
```

---

### Intents

#### GET /intents

List all transfer intents for the authenticated user's organization.

**Response:** `200 OK`
```json
[
  {
    "id": "string",
    "orgId": "string",
    "createdByUserId": "string",
    "railsType": "ACH" | "WIRE",
    "amountMinor": "string",
    "currency": "string",
    "beneficiaryId": "string",
    "beneficiaryVersion": 1,
    "purpose": "string",
    "status": "DRAFT" | "PENDING_PROOF" | "CHALLENGING" | "PENDING_APPROVALS" | "APPROVED" | "DENIED" | "EXECUTED" | "EXPIRED" | "CANCELED",
    "riskScore": 0-100,
    "riskRationaleJson": {
      "factors": ["string"],
      "details": {},
      "scoreBreakdown": {
        "base": 0,
        "amount": 0,
        "beneficiary": 0,
        "rails": 0,
        "international": 0,
        "timing": 0,
        "total": 0
      }
    },
    "requiredApprovals": 1,
    "requiredChallengeLevel": "L1" | "L2" | "L3",
    "bindingHash": "string",
    "cooldownUntil": "2025-01-01T00:00:00Z" | null,
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
]
```

**Ordering:** Newest first (by `createdAt`)

---

#### GET /intents/:id

Get a specific transfer intent by ID.

**Parameters:**
- `id` (path, required): Transfer intent ID

**Response:** `200 OK`
```json
{
  // Same as TransferIntent in list response
}
```

**Errors:**
- `404`: Intent not found (`INTENT_NOT_FOUND`)

---

#### POST /intents

Create a new transfer intent.

**Permissions:** `intent:create`

**Request Body:**
```json
{
  "railsType": "ACH" | "WIRE",
  "amountMinor": "string",  // Must match /^\d+$/
  "currency": "string",     // Default: "USD", must be 3 characters
  "beneficiaryId": "string",
  "purpose": "string"       // Min length: 1
}
```

**Response:** `201 Created`
```json
{
  // TransferIntent object
}
```

**Errors:**
- `400`: Invalid request body (`INVALID_REQUEST`)
- `404`: Beneficiary not found or policy not configured

**Notes:**
- Automatically calculates risk score and required approvals based on policy
- Sets initial status to `DRAFT` or `PENDING_PROOF` based on risk
- Computes binding hash from critical fields

---

#### PATCH /intents/:id

Update a transfer intent.

**Permissions:** `intent:create`

**Parameters:**
- `id` (path, required): Transfer intent ID

**Request Body:** (at least one field required)
```json
{
  "beneficiaryId": "string",    // Optional
  "purpose": "string",           // Optional, min length: 1
  "amountMinor": "string",       // Optional, must match /^\d+$/
  "railsType": "ACH" | "WIRE"    // Optional
}
```

**Response:** `200 OK`
```json
{
  // Updated TransferIntent object
}
```

**Errors:**
- `400`: Invalid request body or empty patch (`INVALID_REQUEST`)
- `404`: Intent not found (`INTENT_NOT_FOUND`)

**Notes:**
- Updates to `amountMinor`, `beneficiaryId`, `railsType`, or `purpose` will:
  - Recalculate binding hash
  - Invalidate existing approvals
  - Invalidate approval tokens
  - Invalidate challenges
- Cannot update intents in status: `EXECUTED`, `DENIED`, `CANCELED`, `EXPIRED`

---

### Challenges

#### POST /intents/:id/challenge

Create a voice challenge for a transfer intent.

**Parameters:**
- `id` (path, required): Transfer intent ID

**Request Body:** (optional)
```json
{
  "language": "EN" | "ES"  // Default: "EN"
}
```

**Response:** `200 OK`
```json
{
  "id": "string",
  "intentId": "string",
  "language": "EN" | "ES",
  "level": "L1" | "L2" | "L3",
  "grammarVersion": "string",
  "challengeNonce": "string",
  "challengeText": "string",
  "expectedSlotsJson": {
    "slots": [
      {
        "name": "string",
        "type": "amount" | "digits" | "words",
        "value": "string",
        "spoken": ["string"],
        "position": 0
      }
    ],
    "prosody_modifier": {
      "type": "speed" | "whisper",
      "target": "string",
      "instruction": "string"
    }
  },
  "expiresAt": "2025-01-01T00:00:00Z",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

**Errors:**
- `404`: Intent not found (`INTENT_NOT_FOUND`)
- `400`: Intent in invalid status or in cooldown

**Notes:**
- Challenge level is determined by intent's `requiredChallengeLevel`
- Challenge expires 10 minutes after creation
- Updates intent status to `CHALLENGING`

---

#### POST /challenges/:challengeId/proof

Submit a voice proof for a challenge.

**Parameters:**
- `challengeId` (path, required): Voice challenge ID

**Request Body:**
```json
{
  "channel": "BROWSER" | "PHONE",        // Default: "BROWSER"
  "transcript": "string",                // Required, min length: 1
  "transcriptLanguage": "string" | null, // Optional
  "deviceMetadataJson": {}               // Optional object
}
```

**Response:** `200 OK`
```json
{
  "id": "string",
  "intentId": "string",
  "challengeId": "string",
  "userId": "string",
  "channel": "BROWSER" | "PHONE",
  "transcript": "string",
  "transcriptLanguage": "string" | null,
  "scoresJson": {
    "identity_confidence": 0-100,
    "liveness_score": 0-100,
    "spoof_risk_score": 0-100,
    "drift_score": 0-100,
    "coercion_risk_score": 0-100,
    "challenge_match_score": 0-100
  },
  "deviceMetadataJson": {
    "ip": "string",
    "userAgent": "string",
    "browser": "string",
    "os": "string",
    "callSessionId": "string",
    "callStartedAt": "2025-01-01T00:00:00Z",
    "callDurationSeconds": 0,
    "phoneNumber": "string"
  },
  "audioEncryptedRef": "string",  // Optional
  "audioHash": "string",          // Optional
  "modelVersion": "string",       // Optional
  "createdAt": "2025-01-01T00:00:00Z"
}
```

**Errors:**
- `400`: Invalid request body (`INVALID_REQUEST`)

**Notes:**
- Currently uses deterministic scoring (demo mode)
- Updates intent status based on proof results
- If proof passes, intent moves to `PENDING_APPROVALS`

---

### Decisions

#### POST /intents/:id/decision

Create an approval decision for a transfer intent.

**Permissions:** `intent:approve`

**Parameters:**
- `id` (path, required): Transfer intent ID

**Request Body:**
```json
{
  "action": "APPROVE" | "DENY" | "STEP_UP",
  "proofId": "string",                    // Required
  "reasonCodesJson": ["string"]            // Optional
}
```

**Response:** `200 OK`
```json
{
  "id": "string",
  "intentId": "string",
  "decisionType": "APPROVE" | "DENY" | "STEP_UP",
  "reasonCodesJson": ["string"],
  "approvalTokenHash": "string" | null,
  "expiresAt": "2025-01-01T00:00:00Z" | null,
  "signerKeyId": "string",
  "decisionPayloadCanonicalJson": "string",
  "decisionHash": "string",
  "signature": "string",
  "policyId": "string",                    // Optional
  "policyVersion": 1,                      // Optional
  "riskEngineVersion": "string",            // Optional
  "createdByUserId": "string",
  "createdAt": "2025-01-01T00:00:00Z",
  "approvalToken": "string"                // Only present if APPROVE and threshold met, returned exactly once
}
```

**Errors:**
- `400`: Invalid request body (`INVALID_REQUEST`)
- `404`: Intent not found (`INTENT_NOT_FOUND`)
- `400`: Intent not in `PENDING_APPROVALS` status

**Notes:**
- Maker-checker: Cannot approve own intent
- If `APPROVE` and approval threshold is met:
  - Returns plaintext `approvalToken` (exactly once)
  - Updates intent status to `APPROVED`
  - Subsequent calls return Decision without token
- Token is hashed and stored; plaintext is never persisted
- Decision is cryptographically signed

---

### Execution

#### POST /intents/:id/execute

Execute a transfer intent using an approval token.

**Permissions:** `intent:execute`

**Parameters:**
- `id` (path, required): Transfer intent ID

**Headers:**
- `X-POSE-APPROVAL` (required): Approval token

**Response:** `200 OK`
```json
{
  "status": "EXECUTED",
  "executionRef": "string"
}
```

**Errors:**
- `400`: Missing X-POSE-APPROVAL header (`MISSING_APPROVAL_TOKEN`)
- `404`: Intent not found (`INTENT_NOT_FOUND`)
- `400`: Intent not in `APPROVED` status
- `400`: Invalid, expired, or consumed approval token

**Notes:**
- Token is consumed atomically (cannot be reused)
- Updates intent status to `EXECUTED`
- Creates execution event in event chain
- Future: Will integrate with payment rails

---

### Events

#### GET /intents/:id/events

List all events for a transfer intent.

**Parameters:**
- `id` (path, required): Transfer intent ID

**Response:** `200 OK`
```json
[
  {
    "id": "string",
    "intentId": "string",
    "seq": 0,
    "eventType": "string",
    "payloadCanonicalJson": "string",
    "prevHash": "string" | null,
    "eventHash": "string",
    "correlationId": "string",      // Optional
    "requestId": "string",         // Optional
    "createdByUserId": "string",
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

**Errors:**
- `404`: Intent not found (`INTENT_NOT_FOUND`)

**Notes:**
- Events are ordered by sequence number (`seq`)
- Event chain is tamper-evident via hash chaining
- First event has `prevHash: null`

---

### Bundles

#### POST /intents/:id/bundle

Generate an audit bundle for a transfer intent.

**Permissions:** `intent:view_bundle`

**Parameters:**
- `id` (path, required): Transfer intent ID

**Response:** `200 OK`
```json
{
  "id": "string",
  "intentId": "string",
  "bundleHash": "string",
  "manifestCanonicalJson": "string",
  "manifestSignature": "string",
  "signerKeyId": "string",
  "storageRef": "string",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

**Errors:**
- `404`: Intent not found (`INTENT_NOT_FOUND`)

**Notes:**
- Bundle includes:
  - Intent data
  - All events
  - All challenges
  - All proofs
  - All decisions
- Manifest is cryptographically signed
- Currently signature is placeholder (Agent C work)
- Storage reference points to object store (future)

---

### Beneficiaries

#### GET /beneficiaries

List all beneficiaries for the authenticated user's organization.

**Response:** `200 OK`
```json
[
  {
    "id": "string",
    "orgId": "string",
    "displayName": "string",
    "country": "string",              // ISO 3166-1 alpha-2 (2 chars)
    "railsAllowed": ["ACH" | "WIRE"],
    "bankLast4": "string",            // 4 digits
    "bankTokenHash": "string",
    "version": 1,
    "status": "ACTIVE" | "LOCKED" | "PENDING_VERIFICATION",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z",
    "lastChangedAt": "2025-01-01T00:00:00Z",
    "lastChangedBy": "string"
  }
]
```

---

#### POST /beneficiaries

Create a new beneficiary.

**Permissions:** `beneficiary:create`

**Request Body:**
```json
{
  "displayName": "string",           // Min length: 1
  "country": "string",                // 2 characters (ISO 3166-1 alpha-2)
  "railsAllowed": ["ACH" | "WIRE"],  // Min 1 item
  "bankLast4": "string",              // Exactly 4 characters
  "bankTokenHash": "string"           // Min length: 1
}
```

**Response:** `201 Created`
```json
{
  // Beneficiary object
}
```

**Errors:**
- `400`: Invalid request body (`INVALID_REQUEST`)

---

#### PATCH /beneficiaries/:id

Update a beneficiary.

**Permissions:** `beneficiary:create`

**Parameters:**
- `id` (path, required): Beneficiary ID

**Request Body:** (at least one field required)
```json
{
  "displayName": "string",           // Optional
  "country": "string",                // Optional, 2 characters
  "railsAllowed": ["ACH" | "WIRE"],  // Optional, min 1 item
  "bankLast4": "string",             // Optional, exactly 4 characters
  "bankTokenHash": "string",          // Optional, min length: 1
  "status": "ACTIVE" | "LOCKED" | "PENDING_VERIFICATION"  // Optional
}
```

**Response:** `200 OK`
```json
{
  // Updated Beneficiary object
}
```

**Errors:**
- `400`: Invalid request body (`INVALID_REQUEST`)
- `404`: Beneficiary not found (`BENEFICIARY_NOT_FOUND`)

**Notes:**
- Updates increment version number
- Tracks `lastChangedAt` and `lastChangedBy`

---

### Policies

#### GET /policies

Get the active policy version for the authenticated user's organization.

**Response:** `200 OK`
```json
{
  "policyId": "string",
  "version": 1,
  "effectiveAt": "2025-01-01T00:00:00Z",
  "thresholds": {
    "amountStepUpMinor": "string",        // Must match /^\d+$/
    "dualApprovalRiskScore": 0-100,
    "criticalRiskScore": 0-100,
    "newBeneficiaryDays": 0,
    "outOfHoursStartHourLocal": 0-23,
    "outOfHoursEndHourLocal": 0-23
  },
  "rules": {
    "requireDualApprovalForInternationalWire": true,
    "requirePhoneForL3IfMicDenied": true,
    "cooldownMinutesForHighRisk": 0,
    "lockoutAfterFailedAttempts": 1
  }
}
```

**Errors:**
- `404`: No policy configured (`POLICY_NOT_CONFIGURED`)

---

#### POST /policies

Create a new policy version.

**Permissions:** `policy:edit`

**Request Body:**
```json
{
  "policyId": "string",              // Default: "policy_acme_v1"
  "thresholds": {
    "amountStepUpMinor": "string",    // Must match /^\d+$/
    "dualApprovalRiskScore": 0-100,
    "criticalRiskScore": 0-100,
    "newBeneficiaryDays": 0,
    "outOfHoursStartHourLocal": 0-23,
    "outOfHoursEndHourLocal": 0-23
  },
  "rules": {
    "requireDualApprovalForInternationalWire": true,
    "requirePhoneForL3IfMicDenied": true,
    "cooldownMinutesForHighRisk": 0,
    "lockoutAfterFailedAttempts": 1
  }
}
```

**Response:** `201 Created`
```json
{
  // PolicyVersion object
}
```

**Errors:**
- `400`: Invalid request body (`INVALID_REQUEST`)

**Notes:**
- Creates new version and marks it as active
- Previous versions remain for audit

---

#### POST /policies/simulate

Simulate risk scoring without creating an intent.

**Request Body:**
```json
{
  "railsType": "ACH" | "WIRE",
  "amountMinor": "string",           // Must match /^\d+$/
  "beneficiaryId": "string"
}
```

**Response:** `200 OK`
```json
{
  "riskScore": 0-100,
  "riskRationaleJson": {
    // RiskRationale object
  },
  "requiredApprovals": 1,
  "requiredChallengeLevel": "L1" | "L2" | "L3",
  "policyId": "string",
  "policyVersion": 1,
  "riskEngineVersion": "string",
  "requestCanonicalJson": "string"
}
```

**Errors:**
- `400`: Invalid request body (`INVALID_REQUEST`)
- `404`: Beneficiary not found or no policy configured

**Notes:**
- Uses same risk engine as intent creation
- Returns canonical JSON of request for audit

---

## Type Compatibility

All response types match exactly with frontend types defined in:
- `wire2/frontend/src/wire/types/wire.ts`

See `RESPONSE_SHAPE_VERIFICATION.md` for detailed verification.

---

## Validation Rules

### Amounts
- `amountMinor`: String matching `/^\d+$/` (digits only)
- Represents amount in minor units (e.g., cents for USD)

### Currency
- Must be exactly 3 characters
- ISO 4217 format (e.g., "USD", "EUR")

### Country Codes
- Must be exactly 2 characters
- ISO 3166-1 alpha-2 format (e.g., "US", "GB")

### Bank Last4
- Must be exactly 4 characters
- Digits only

### Timestamps
- All timestamps are ISO 8601 format
- UTC timezone
- Example: `"2025-01-01T00:00:00Z"`

---

## Idempotency

**Current Status:** Not implemented

**Future:** Mutating endpoints will support idempotency keys:
- `Idempotency-Key` header
- Stored per intent + key
- Returns same response for duplicate requests

---

## Rate Limiting

**Current Status:** Not implemented

**Future:** Will implement per-user and per-org rate limits.

---

## Versioning

**Current:** No versioning

**Future:** API versioning via:
- URL path: `/api/v1/wire/*`
- Header: `API-Version: 1`

---

## OpenAPI Specification

Full OpenAPI 3.0.3 specification available at:
- `wire2/backend/src/openapi/wire.openapi.json`

This specification can be used to:
- Generate client SDKs
- Validate requests/responses
- Generate API documentation
- Test API contracts

---

## Testing

### Manual Testing
Use the OpenAPI spec with tools like:
- Swagger UI
- Postman
- Insomnia

### Automated Testing
- Integration tests: `wire2/backend/src/tests/demoFlow.test.ts`
- Contract tests: Validate against OpenAPI spec (future)

---

## Changelog

### 2025-12-31
- ✅ Created comprehensive OpenAPI specification
- ✅ Documented all endpoints with request/response schemas
- ✅ Verified response shapes match frontend types
- ✅ Standardized error response format
- ✅ Created error response helper library

---

## Future Work

1. **Error Response Standardization** (In Progress)
   - Update all routes to use standardized error format
   - Add error codes to all error responses

2. **Idempotency** (Agent D)
   - Add idempotency key support
   - Implement idempotency middleware

3. **Rate Limiting** (Agent B)
   - Implement per-user rate limits
   - Implement per-org rate limits

4. **API Versioning** (Future)
   - Add versioning strategy
   - Document migration path

5. **OpenAPI Generation** (Future)
   - Auto-generate from code annotations
   - CI validation of spec vs implementation
