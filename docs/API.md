# WIRE API Documentation

Complete API reference for WIRE voice-based authorization platform.

## Base URL

- Production: `https://api.wire.pose.xyz`
- Sandbox: `https://sandbox.wire.pose.xyz`

## Authentication

WIRE uses API key authentication. Include your API key in the `Authorization` header:

```
Authorization: Bearer wire_live_your_api_key
```

For endpoints that require a secret, use Basic Auth:

```
Authorization: Basic base64(api_key:api_secret)
```

## Rate Limits

- 100 requests per minute per API key
- 1000 requests per hour per API key

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## Endpoints

### Intents

#### Create Intent
```http
POST /api/wire/intents
```

**Request Body:**
```json
{
  "railsType": "WIRE",
  "amountMinor": "1000000",
  "currency": "USD",
  "beneficiaryId": "benef_123",
  "purpose": "Payment for services"
}
```

**Response:**
```json
{
  "id": "intent_123",
  "orgId": "org_123",
  "status": "DRAFT",
  "riskScore": 45,
  "requiredApprovals": 2,
  "createdAt": "2024-01-20T10:00:00Z"
}
```

#### Get Intent
```http
GET /api/wire/intents/:id
```

#### List Intents
```http
GET /api/wire/intents?status=APPROVED&limit=10&offset=0
```

#### Submit Voice Proof
```http
POST /api/wire/challenges/:challengeId/proof
Content-Type: multipart/form-data

audio: <binary>
channel: BROWSER
```

#### Approve Intent
```http
POST /api/wire/intents/:id/decisions
```

**Request Body:**
```json
{
  "decisionType": "APPROVE",
  "proofId": "proof_123",
  "reasonCodes": []
}
```

#### Execute Intent
```http
POST /api/wire/intents/:id/execute
```

**Request Body:**
```json
{
  "approvalToken": "token_123",
  "idempotencyKey": "idemp_123"
}
```

### Beneficiaries

#### Create Beneficiary
```http
POST /api/wire/beneficiaries
```

**Request Body:**
```json
{
  "displayName": "Acme Corp",
  "country": "US",
  "railsAllowed": ["ACH", "WIRE"],
  "bankLast4": "1234",
  "bankTokenHash": "hash_123"
}
```

#### List Beneficiaries
```http
GET /api/wire/beneficiaries
```

### API Keys

#### List API Keys
```http
GET /api/wire/api-keys
```

#### Create API Key
```http
POST /api/wire/api-keys
```

**Request Body:**
```json
{
  "name": "Production API Key",
  "permissions": ["intent:create", "intent:read"],
  "expiresInDays": 90
}
```

**Response:**
```json
{
  "id": "apikey_123",
  "name": "Production API Key",
  "key": "wire_live_abc123...",
  "secret": "wkey_secret_xyz789...",
  "permissions": ["intent:create", "intent:read"],
  "expiresAt": "2024-04-20T10:00:00Z",
  "createdAt": "2024-01-20T10:00:00Z"
}
```

**⚠️ Important:** The secret is only returned once on creation. Store it securely.

#### Revoke API Key
```http
POST /api/wire/api-keys/:id/revoke
```

#### Delete API Key
```http
DELETE /api/wire/api-keys/:id
```

### Webhooks

#### List Webhooks
```http
GET /api/wire/webhooks
```

#### Create Webhook
```http
POST /api/wire/webhooks
```

**Request Body:**
```json
{
  "name": "Production Webhook",
  "url": "https://your-server.com/webhooks/wire",
  "events": [
    "intent.created",
    "intent.approved",
    "intent.executed"
  ]
}
```

**Response:**
```json
{
  "id": "webhook_123",
  "name": "Production Webhook",
  "url": "https://your-server.com/webhooks/wire",
  "events": ["intent.created", "intent.approved", "intent.executed"],
  "secret": "whsec_abc123...",
  "active": true,
  "createdAt": "2024-01-20T10:00:00Z"
}
```

**⚠️ Important:** The webhook secret is only returned once on creation. Use it to verify webhook signatures.

#### Update Webhook
```http
PATCH /api/wire/webhooks/:id
```

#### Delete Webhook
```http
DELETE /api/wire/webhooks/:id
```

### Webhook Events

Webhooks are delivered as POST requests to your configured URL with the following structure:

```json
{
  "id": "delivery_123",
  "type": "intent.created",
  "data": {
    "id": "intent_123",
    "orgId": "org_123",
    "railsType": "WIRE",
    "amountMinor": "1000000",
    "currency": "USD",
    "status": "DRAFT"
  },
  "timestamp": 1705752000000
}
```

**Headers:**
- `X-WIRE-Signature`: HMAC-SHA256 signature
- `X-WIRE-Timestamp`: Unix timestamp

**Verification:**
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret, timestamp) {
  const message = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(message);
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature;
}
```

### Event Types

- `intent.created` - New intent created
- `intent.updated` - Intent updated
- `intent.approved` - Intent approved
- `intent.denied` - Intent denied
- `intent.executed` - Intent executed
- `intent.canceled` - Intent canceled
- `challenge.created` - Voice challenge created
- `proof.submitted` - Voice proof submitted
- `decision.made` - Decision made
- `beneficiary.created` - Beneficiary created
- `beneficiary.updated` - Beneficiary updated
- `beneficiary.locked` - Beneficiary locked

### Users

#### List Users
```http
GET /api/wire/users
```

#### Create User
```http
POST /api/wire/users
```

#### Update User
```http
PATCH /api/wire/users/:id
```

#### Delete User
```http
DELETE /api/wire/users/:id
```

### Invitations

#### List Invitations
```http
GET /api/wire/invitations
```

#### Create Invitation
```http
POST /api/wire/invitations
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "role": "APPROVER",
  "permissions": ["intent:approve"],
  "expiresInDays": 7
}
```

#### Accept Invitation
```http
POST /api/wire/invitations/accept
```

**Request Body:**
```json
{
  "token": "invitation_token",
  "name": "John Doe"
}
```

### Public Endpoints

#### Sign Up
```http
POST /api/signup
```

**Request Body:**
```json
{
  "organizationName": "Acme Corporation",
  "adminName": "John Doe",
  "adminEmail": "john@acme.com"
}
```

### Sandbox

#### Toggle Sandbox Mode
```http
POST /api/sandbox/toggle
```

#### Get Sandbox Status
```http
GET /api/sandbox/status
```

#### Seed Test Data
```http
POST /api/sandbox/seed
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Error Codes

- `AUTH_REQUIRED` - Authentication required
- `INVALID_API_KEY` - Invalid API key
- `PERMISSION_DENIED` - Insufficient permissions
- `VALIDATION_ERROR` - Request validation failed
- `NOT_FOUND` - Resource not found
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `INTERNAL_ERROR` - Internal server error

## Idempotency

For mutating endpoints (create, update, execute), include an `idempotencyKey` header:

```
Idempotency-Key: unique-key-123
```

Idempotency keys are valid for 24 hours. Repeated requests with the same key return the same response.

## Webhooks Retry Logic

Webhooks are retried with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: 1 minute delay
- Attempt 3: 2 minutes delay
- Attempt 4: 4 minutes delay
- Attempt 5: 8 minutes delay

After 5 failed attempts, the webhook is marked as failed and manual intervention is required.

## Support

For API support, contact: api-support@wire.pose.xyz
