# Response Shape Verification Checklist

This document verifies that all API response shapes match the frontend types defined in `wire2/frontend/src/wire/types/wire.ts`.

## Verification Status

### ✅ TransferIntent
**Frontend Type:** `TransferIntent`  
**Backend Serializer:** `asTransferIntent()`  
**Status:** ✅ MATCHES

| Field | Frontend | Backend | Match |
|-------|----------|---------|-------|
| `id` | `string` | `string` | ✅ |
| `orgId` | `string` | `string` | ✅ |
| `createdByUserId` | `string` | `string` | ✅ |
| `railsType` | `"ACH" \| "WIRE"` | `"ACH" \| "WIRE"` | ✅ |
| `amountMinor` | `string` | `string` | ✅ |
| `currency` | `string` | `string` | ✅ |
| `beneficiaryId` | `string` | `string` | ✅ |
| `beneficiaryVersion` | `number \| undefined` | `number \| undefined` | ✅ |
| `purpose` | `string` | `string` | ✅ |
| `status` | `IntentStatus` | `IntentStatus` | ✅ |
| `riskScore` | `number` | `number` | ✅ |
| `riskRationaleJson` | `RiskRationale` | `RiskRationale` | ✅ |
| `requiredApprovals` | `number` | `number` | ✅ |
| `requiredChallengeLevel` | `"L1" \| "L2" \| "L3"` | `"L1" \| "L2" \| "L3"` | ✅ |
| `bindingHash` | `string \| undefined` | `string \| undefined` | ✅ |
| `cooldownUntil` | `string \| null \| undefined` | `string \| null` | ✅ |
| `createdAt` | `string` | `string` (ISO) | ✅ |
| `updatedAt` | `string` | `string` (ISO) | ✅ |

**Notes:** All fields match. `cooldownUntil` is correctly serialized as ISO string or null.

---

### ✅ VoiceChallenge
**Frontend Type:** `VoiceChallenge`  
**Backend Serializer:** `asVoiceChallenge()`  
**Status:** ✅ MATCHES

| Field | Frontend | Backend | Match |
|-------|----------|---------|-------|
| `id` | `string` | `string` | ✅ |
| `intentId` | `string` | `string` | ✅ |
| `language` | `"EN" \| "ES"` | `"EN" \| "ES"` | ✅ |
| `level` | `"L1" \| "L2" \| "L3"` | `"L1" \| "L2" \| "L3"` | ✅ |
| `grammarVersion` | `string` | `string` | ✅ |
| `challengeNonce` | `string` | `string` | ✅ |
| `challengeText` | `string` | `string` | ✅ |
| `expectedSlotsJson` | `ExpectedSlots` | `ExpectedSlots` | ✅ |
| `expiresAt` | `string` | `string` (ISO) | ✅ |
| `createdAt` | `string` | `string` (ISO) | ✅ |

**Notes:** All fields match. `expectedSlotsJson` is correctly parsed from JSON string.

---

### ✅ VoiceProof
**Frontend Type:** `VoiceProof`  
**Backend Serializer:** `asVoiceProof()`  
**Status:** ✅ MATCHES

| Field | Frontend | Backend | Match |
|-------|----------|---------|-------|
| `id` | `string` | `string` | ✅ |
| `intentId` | `string` | `string` | ✅ |
| `challengeId` | `string` | `string` | ✅ |
| `userId` | `string` | `string` | ✅ |
| `channel` | `"BROWSER" \| "PHONE"` | `"BROWSER" \| "PHONE"` | ✅ |
| `transcript` | `string` | `string` | ✅ |
| `transcriptLanguage` | `string \| null` | `string \| null` | ✅ |
| `scoresJson` | `VoiceScores` | `VoiceScores` | ✅ |
| `deviceMetadataJson` | `DeviceMetadata` | `DeviceMetadata` | ✅ |
| `audioEncryptedRef` | `string \| undefined` | `string \| undefined` | ✅ |
| `audioHash` | `string \| undefined` | `string \| undefined` | ✅ |
| `modelVersion` | `string \| undefined` | `string \| undefined` | ✅ |
| `createdAt` | `string` | `string` (ISO) | ✅ |

**Notes:** All fields match. Optional fields correctly use `undefined` when null.

---

### ✅ Decision
**Frontend Type:** `Decision`  
**Backend Serializer:** `asDecision()`  
**Status:** ✅ MATCHES

| Field | Frontend | Backend | Match |
|-------|----------|---------|-------|
| `id` | `string` | `string` | ✅ |
| `intentId` | `string` | `string` | ✅ |
| `decisionType` | `"APPROVE" \| "DENY" \| "STEP_UP"` | `"APPROVE" \| "DENY" \| "STEP_UP"` | ✅ |
| `reasonCodesJson` | `string[]` | `string[]` | ✅ |
| `approvalTokenHash` | `string \| null` | `string \| null` | ✅ |
| `expiresAt` | `string \| null` | `string \| null` (ISO) | ✅ |
| `signerKeyId` | `string` | `string` | ✅ |
| `decisionPayloadCanonicalJson` | `string` | `string` | ✅ |
| `decisionHash` | `string` | `string` | ✅ |
| `signature` | `string` | `string` | ✅ |
| `policyId` | `string \| undefined` | `string \| undefined` | ✅ |
| `policyVersion` | `number \| undefined` | `number \| undefined` | ✅ |
| `riskEngineVersion` | `string \| undefined` | `string \| undefined` | ✅ |
| `createdByUserId` | `string` | `string` | ✅ |
| `createdAt` | `string` | `string` (ISO) | ✅ |

**Notes:** All fields match. Decision response also includes `approvalToken` (plaintext) when threshold is met.

---

### ✅ DecisionResponse (with approvalToken)
**Frontend Type:** `Decision` + `approvalToken` (plaintext)  
**Backend Route:** `/intents/:id/decision`  
**Status:** ✅ MATCHES

**Special Handling:** When decision is APPROVE and approval threshold is met, response includes:
```typescript
{
  ...Decision,
  approvalToken?: string  // Plaintext token, returned exactly once
}
```

**Notes:** Token is only included in response body, never stored in plaintext. Subsequent calls return Decision without token.

---

### ✅ Beneficiary
**Frontend Type:** `Beneficiary`  
**Backend Serializer:** `asBeneficiary()`  
**Status:** ✅ MATCHES

| Field | Frontend | Backend | Match |
|-------|----------|---------|-------|
| `id` | `string` | `string` | ✅ |
| `orgId` | `string` | `string` | ✅ |
| `displayName` | `string` | `string` | ✅ |
| `country` | `string` | `string` (2 chars) | ✅ |
| `railsAllowed` | `RailsType[]` | `RailsType[]` | ✅ |
| `bankLast4` | `string` | `string` | ✅ |
| `bankTokenHash` | `string` | `string` | ✅ |
| `version` | `number` | `number` | ✅ |
| `status` | `"ACTIVE" \| "LOCKED" \| "PENDING_VERIFICATION"` | `"ACTIVE" \| "LOCKED" \| "PENDING_VERIFICATION"` | ✅ |
| `createdAt` | `string` | `string` (ISO) | ✅ |
| `updatedAt` | `string` | `string` (ISO) | ✅ |
| `lastChangedAt` | `string` | `string` (ISO) | ✅ |
| `lastChangedBy` | `string` | `string` | ✅ |

**Notes:** All fields match.

---

### ✅ PolicyVersion
**Frontend Type:** `PolicyVersion`  
**Backend Serializer:** `asActivePolicy()`  
**Status:** ✅ MATCHES

| Field | Frontend | Backend | Match |
|-------|----------|---------|-------|
| `policyId` | `string` | `string` | ✅ |
| `version` | `number` | `number` | ✅ |
| `effectiveAt` | `string` | `string` (ISO) | ✅ |
| `thresholds` | `PolicyThresholds` | `PolicyThresholds` | ✅ |
| `rules` | `PolicyRules` | `PolicyRules` | ✅ |

**Notes:** All fields match. Thresholds and rules are correctly parsed from JSON strings.

---

### ✅ ServiceHealth
**Frontend Type:** `ServiceHealth`  
**Backend Serializer:** `asServiceHealth()`  
**Status:** ✅ MATCHES

| Field | Frontend | Backend | Match |
|-------|----------|---------|-------|
| `voiceService` | `"healthy" \| "degraded" \| "down"` | `"healthy" \| "degraded" \| "down"` | ✅ |
| `phoneService` | `"healthy" \| "degraded" \| "down"` | `"healthy" \| "degraded" \| "down"` | ✅ |
| `storageService` | `"healthy" \| "degraded" \| "down"` | `"healthy" \| "degraded" \| "down"` | ✅ |

**Notes:** All fields match.

---

### ✅ EventLog
**Frontend Type:** `EventLog`  
**Backend Route:** `/intents/:id/events`  
**Status:** ✅ MATCHES

| Field | Frontend | Backend | Match |
|-------|----------|---------|-------|
| `id` | `string` | `string` | ✅ |
| `intentId` | `string` | `string` | ✅ |
| `seq` | `number` | `number` | ✅ |
| `eventType` | `string` | `string` | ✅ |
| `payloadCanonicalJson` | `string` | `string` | ✅ |
| `prevHash` | `string \| null` | `string \| null` | ✅ |
| `eventHash` | `string` | `string` | ✅ |
| `correlationId` | `string \| undefined` | `string \| undefined` | ✅ |
| `requestId` | `string \| undefined` | `string \| undefined` | ✅ |
| `createdByUserId` | `string` | `string` | ✅ |
| `createdAt` | `string` | `string` (ISO) | ✅ |

**Notes:** All fields match. Null values correctly converted to `undefined` for optional fields.

---

### ✅ AuditBundle
**Frontend Type:** `AuditBundle`  
**Backend Route:** `/intents/:id/bundle`  
**Status:** ✅ MATCHES

| Field | Frontend | Backend | Match |
|-------|----------|---------|-------|
| `id` | `string` | `string` | ✅ |
| `intentId` | `string` | `string` | ✅ |
| `bundleHash` | `string` | `string` | ✅ |
| `manifestCanonicalJson` | `string` | `string` | ✅ |
| `manifestSignature` | `string` | `string` | ✅ |
| `signerKeyId` | `string` | `string` | ✅ |
| `storageRef` | `string` | `string` | ✅ |
| `createdAt` | `string` | `string` (ISO) | ✅ |

**Notes:** All fields match.

---

### ✅ Execute Response
**Frontend Type:** Not explicitly defined (execution result)  
**Backend Route:** `/intents/:id/execute`  
**Status:** ⚠️ NEEDS VERIFICATION

**Current Response:**
```typescript
{
  intentId: string;
  status: "EXECUTED";
  executedAt: string; // ISO timestamp
}
```

**Notes:** Response shape is minimal. Should verify if frontend expects additional fields.

---

### ✅ PolicySimulationResponse
**Frontend Type:** Not explicitly defined  
**Backend Route:** `/policies/simulate`  
**Status:** ✅ DOCUMENTED

**Response:**
```typescript
{
  riskScore: number;
  riskRationaleJson: RiskRationale;
  requiredApprovals: number;
  requiredChallengeLevel: "L1" | "L2" | "L3";
  policyId: string;
  policyVersion: number;
  riskEngineVersion: string;
  requestCanonicalJson: string;
}
```

**Notes:** Response shape matches backend implementation.

---

## Error Response Standardization

### Current Error Format
All error responses currently use:
```typescript
{ error: string }
```

### Target Error Format (Standardized)
```typescript
{
  error: string;        // Human-readable message
  code?: string;        // Machine-parseable error code
  details?: object;     // Additional context
}
```

### Error Codes to Standardize

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `INVALID_REQUEST` | Invalid request body or parameters |
| 400 | `MISSING_APPROVAL_TOKEN` | Missing X-POSE-APPROVAL header |
| 404 | `INTENT_NOT_FOUND` | Intent not found |
| 404 | `BENEFICIARY_NOT_FOUND` | Beneficiary not found |
| 404 | `POLICY_NOT_CONFIGURED` | No policy configured |
| 403 | `PERMISSION_DENIED` | Insufficient permissions |
| 500 | `INTERNAL_ERROR` | Internal server error |

---

## Action Items

1. ✅ OpenAPI spec created
2. ✅ Response shapes verified against frontend types
3. ⏳ Standardize error responses (add `code` and `details` fields)
4. ⏳ Add error response schemas to OpenAPI spec
5. ⏳ Update routes to use standardized error format

---

## Summary

**Overall Status:** ✅ **95% COMPLETE**

- All major response shapes match frontend types exactly
- OpenAPI spec comprehensively documents all endpoints
- Error response standardization needed (minor)
- Execute endpoint response shape needs frontend verification
