# Error Scenarios Documentation

Comprehensive documentation of all error scenarios, error codes, and error handling patterns for the WIRE API.

## Error Response Format

All errors follow this standardized format:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": {
    "additional": "context",
    "field": "specific_field_name"
  }
}
```

## Error Codes Reference

### 400 Bad Request

#### `INVALID_REQUEST`
**When:** Request body validation fails

**Examples:**
```json
{
  "error": "amountMinor must match pattern /^\\d+$/",
  "code": "INVALID_REQUEST",
  "details": {
    "field": "amountMinor",
    "received": "50.00",
    "expected": "numeric string"
  }
}
```

```json
{
  "error": "beneficiaryId is required",
  "code": "INVALID_REQUEST",
  "details": {
    "field": "beneficiaryId"
  }
}
```

**Common Causes:**
- Invalid amount format (must be digits only)
- Missing required fields
- Invalid enum values
- String length violations
- Invalid JSON structure

---

#### `MISSING_APPROVAL_TOKEN`
**When:** Execute endpoint called without `X-POSE-APPROVAL` header

**Example:**
```json
{
  "error": "Missing X-POSE-APPROVAL header",
  "code": "MISSING_APPROVAL_TOKEN"
}
```

**Resolution:** Include approval token in header:
```
X-POSE-APPROVAL: <token>
```

---

#### `INTENT_INVALID_STATUS`
**When:** Intent operation attempted in invalid status

**Example:**
```json
{
  "error": "Intent not in required status (current: EXECUTED)",
  "code": "INTENT_INVALID_STATUS",
  "details": {
    "currentStatus": "EXECUTED",
    "allowedStatuses": ["PENDING_APPROVALS"]
  }
}
```

**Common Scenarios:**
- Updating intent in `EXECUTED`, `DENIED`, `CANCELED`, `EXPIRED`
- Creating challenge for executed intent
- Making decision on non-pending intent

---

#### `INTENT_IN_COOLDOWN`
**When:** Challenge creation attempted during cooldown period

**Example:**
```json
{
  "error": "Intent is in cooldown",
  "code": "INTENT_IN_COOLDOWN",
  "details": {
    "cooldownUntil": "2025-01-01T13:00:00Z"
  }
}
```

**Resolution:** Wait until cooldown expires

---

#### `APPROVAL_TOKEN_INVALID`
**When:** Approval token is invalid or malformed

**Example:**
```json
{
  "error": "Invalid approval token: token hash mismatch",
  "code": "APPROVAL_TOKEN_INVALID",
  "details": {
    "reason": "token hash mismatch"
  }
}
```

**Common Causes:**
- Token doesn't match stored hash
- Token for different intent
- Token for different binding hash

---

#### `APPROVAL_TOKEN_EXPIRED`
**When:** Approval token has expired

**Example:**
```json
{
  "error": "Approval token expired",
  "code": "APPROVAL_TOKEN_EXPIRED",
  "details": {
    "expiresAt": "2025-01-01T12:00:00Z",
    "currentTime": "2025-01-01T13:00:00Z"
  }
}
```

**Resolution:** Request new approval token

---

#### `APPROVAL_TOKEN_CONSUMED`
**When:** Approval token already used

**Example:**
```json
{
  "error": "Approval token already consumed",
  "code": "APPROVAL_TOKEN_CONSUMED",
  "details": {
    "consumedAt": "2025-01-01T12:00:00Z"
  }
}
```

**Resolution:** Tokens are single-use; cannot reuse

---

#### `BINDING_HASH_MISMATCH`
**When:** Approval token binding hash doesn't match intent

**Example:**
```json
{
  "error": "Binding hash mismatch: intent was modified after approval",
  "code": "BINDING_HASH_MISMATCH",
  "details": {
    "tokenBindingHash": "abc123",
    "intentBindingHash": "def456"
  }
}
```

**Resolution:** Intent was modified; new approval required

---

### 403 Forbidden

#### `PERMISSION_DENIED`
**When:** User lacks required permission

**Example:**
```json
{
  "error": "Permission denied: intent:execute",
  "code": "PERMISSION_DENIED",
  "details": {
    "requiredPermission": "intent:execute",
    "userPermissions": ["intent:create", "intent:approve"]
  }
}
```

**Required Permissions:**
- `intent:create` - Create/update intents
- `intent:approve` - Make approval decisions
- `intent:execute` - Execute intents
- `beneficiary:create` - Create/update beneficiaries
- `policy:edit` - Create policy versions
- `intent:view_bundle` - Generate/download/verify audit bundles

---

### 404 Not Found

#### `INTENT_NOT_FOUND`
**When:** Intent ID doesn't exist or belongs to different org

**Example:**
```json
{
  "error": "Intent not found",
  "code": "INTENT_NOT_FOUND",
  "details": {
    "intentId": "intent_999"
  }
}
```

**Common Causes:**
- Invalid intent ID
- Intent belongs to different organization
- Intent was deleted

---

#### `BENEFICIARY_NOT_FOUND`
**When:** Beneficiary ID doesn't exist or belongs to different org

**Example:**
```json
{
  "error": "Beneficiary not found",
  "code": "BENEFICIARY_NOT_FOUND",
  "details": {
    "beneficiaryId": "benef_999"
  }
}
```

**Common Causes:**
- Invalid beneficiary ID
- Beneficiary belongs to different organization
- Beneficiary was deleted

---

#### `POLICY_NOT_CONFIGURED`
**When:** No active policy exists for organization

**Example:**
```json
{
  "error": "No policy configured",
  "code": "POLICY_NOT_CONFIGURED"
}
```

**Resolution:** Create policy version via `POST /policies`

---

#### `CHALLENGE_NOT_FOUND`
**When:** Challenge ID doesn't exist

**Example:**
```json
{
  "error": "Challenge not found",
  "code": "CHALLENGE_NOT_FOUND",
  "details": {
    "challengeId": "challenge_999"
  }
}
```

---

### 500 Internal Server Error

#### `INTERNAL_ERROR`
**When:** Unexpected server error

**Example:**
```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR",
  "details": {
    "requestId": "req_abc123"
  }
}
```

**Note:** In production, details should not expose sensitive information

---

## Error Handling Best Practices

### Client-Side Handling

1. **Check Error Code:**
   ```typescript
   if (error.code === "INTENT_NOT_FOUND") {
     // Handle not found
   } else if (error.code === "PERMISSION_DENIED") {
     // Handle permission error
   }
   ```

2. **Display User-Friendly Messages:**
   ```typescript
   const errorMessages = {
     INTENT_NOT_FOUND: "This transfer intent could not be found.",
     PERMISSION_DENIED: "You don't have permission to perform this action.",
     APPROVAL_TOKEN_EXPIRED: "Your approval token has expired. Please request a new one.",
   };
   ```

3. **Retry Logic:**
   ```typescript
   // Retry on transient errors
   if (error.code === "INTERNAL_ERROR") {
     // Retry with exponential backoff
   }
   ```

4. **Field-Level Errors:**
   ```typescript
   if (error.details?.field) {
     // Highlight specific field in form
     setFieldError(error.details.field, error.error);
   }
   ```

### Server-Side Handling

1. **Always Include Code:**
   ```typescript
   return reply.code(404).send({
     error: "Intent not found",
     code: "INTENT_NOT_FOUND",
     details: { intentId }
   });
   ```

2. **Provide Context:**
   ```typescript
   return reply.code(400).send({
     error: "Invalid request",
     code: "INVALID_REQUEST",
     details: {
       field: "amountMinor",
       received: value,
       expected: "numeric string"
     }
   });
   ```

3. **Log Errors:**
   ```typescript
   app.log.error({ error, code, details }, "API error");
   ```

## Error Scenarios by Endpoint

### POST /intents

**Possible Errors:**
- `400 INVALID_REQUEST` - Invalid request body
- `404 BENEFICIARY_NOT_FOUND` - Beneficiary doesn't exist
- `404 POLICY_NOT_CONFIGURED` - No policy configured
- `403 PERMISSION_DENIED` - Missing `intent:create` permission

### PATCH /intents/:id

**Possible Errors:**
- `400 INVALID_REQUEST` - Invalid request body or empty patch
- `400 INTENT_INVALID_STATUS` - Intent in invalid status
- `404 INTENT_NOT_FOUND` - Intent doesn't exist
- `403 PERMISSION_DENIED` - Missing `intent:create` permission

### POST /intents/:id/challenge

**Possible Errors:**
- `400 INTENT_INVALID_STATUS` - Intent in invalid status
- `400 INTENT_IN_COOLDOWN` - Intent in cooldown
- `404 INTENT_NOT_FOUND` - Intent doesn't exist

### POST /challenges/:challengeId/proof

**Possible Errors:**
- `400 INVALID_REQUEST` - Invalid request body
- `404 CHALLENGE_NOT_FOUND` - Challenge doesn't exist

### POST /intents/:id/decision

**Possible Errors:**
- `400 INVALID_REQUEST` - Invalid request body
- `400 INTENT_INVALID_STATUS` - Intent not in `PENDING_APPROVALS`
- `404 INTENT_NOT_FOUND` - Intent doesn't exist
- `403 PERMISSION_DENIED` - Missing `intent:approve` permission

### POST /intents/:id/execute

**Possible Errors:**
- `400 MISSING_APPROVAL_TOKEN` - Missing `X-POSE-APPROVAL` header
- `400 APPROVAL_TOKEN_INVALID` - Invalid token
- `400 APPROVAL_TOKEN_EXPIRED` - Token expired
- `400 APPROVAL_TOKEN_CONSUMED` - Token already used
- `400 BINDING_HASH_MISMATCH` - Intent modified after approval
- `400 INTENT_INVALID_STATUS` - Intent not in `APPROVED` status
- `404 INTENT_NOT_FOUND` - Intent doesn't exist
- `403 PERMISSION_DENIED` - Missing `intent:execute` permission

### POST /beneficiaries

**Possible Errors:**
- `400 INVALID_REQUEST` - Invalid request body
- `403 PERMISSION_DENIED` - Missing `beneficiary:create` permission

### PATCH /beneficiaries/:id

**Possible Errors:**
- `400 INVALID_REQUEST` - Invalid request body
- `404 BENEFICIARY_NOT_FOUND` - Beneficiary doesn't exist
- `403 PERMISSION_DENIED` - Missing `beneficiary:create` permission

### POST /policies

**Possible Errors:**
- `400 INVALID_REQUEST` - Invalid request body
- `403 PERMISSION_DENIED` - Missing `policy:edit` permission

### POST /policies/simulate

**Possible Errors:**
- `400 INVALID_REQUEST` - Invalid request body
- `404 BENEFICIARY_NOT_FOUND` - Beneficiary doesn't exist
- `404 POLICY_NOT_CONFIGURED` - No policy configured

## Testing Error Scenarios

### Unit Tests

```typescript
it("should return INTENT_NOT_FOUND for non-existent intent", async () => {
  const response = await request(app)
    .get("/api/wire/intents/nonexistent")
    .set("X-USER-ID", "user_123");
  
  expect(response.status).toBe(404);
  expect(response.body).toMatchObject({
    error: expect.any(String),
    code: "INTENT_NOT_FOUND",
  });
});
```

### Integration Tests

```typescript
it("should handle approval token expiration", async () => {
  // Create intent and get expired token
  const expiredToken = await createExpiredToken();
  
  const response = await request(app)
    .post("/api/wire/intents/intent_123/execute")
    .set("X-POSE-APPROVAL", expiredToken);
  
  expect(response.status).toBe(400);
  expect(response.body.code).toBe("APPROVAL_TOKEN_EXPIRED");
});
```

## Error Monitoring

### Recommended Metrics

- Error rate by code
- Error rate by endpoint
- Error rate by user/org
- Error rate over time

### Alerting

Set up alerts for:
- High error rates (> 5%)
- Critical errors (`INTERNAL_ERROR`)
- Permission denials spike
- Token validation failures

## Future Enhancements

1. **Error Correlation IDs:**
   - Include correlation ID in all errors
   - Link errors to request logs

2. **Error Retry Headers:**
   - `Retry-After` header for rate limits
   - `X-Retry-Id` for idempotent retries

3. **Error Details Sanitization:**
   - Remove sensitive data in production
   - Sanitize stack traces

4. **Error Aggregation:**
   - Group similar errors
   - Provide error summaries
