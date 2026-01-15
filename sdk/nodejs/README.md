# WIRE Node.js SDK

Official Node.js SDK for WIRE - Voice-based authorization for enterprise treasury teams.

## Installation

```bash
npm install @wire/sdk
```

## Quick Start

```javascript
const { createWireClient } = require('@wire/sdk');

const client = createWireClient({
  apiKey: 'wire_live_your_api_key',
  apiSecret: 'wkey_secret_your_secret',
  baseUrl: 'https://api.wire.pose.xyz', // Optional (should NOT include /api/wire unless you set apiPrefix="")
  apiPrefix: '/api/wire', // Optional (default)
  sandbox: false, // Optional, for testing
});

// Create a transfer intent
const intent = await client.createIntent({
  railsType: 'WIRE',
  amountMinor: '1000000', // $10,000.00 in minor units
  currency: 'USD',
  beneficiaryId: 'benef_123',
  purpose: 'Payment for services',
});

// Challenge + proof + approve
const challenge = await client.createChallenge(intent.id, { language: 'EN' });
const proof = await client.submitProof({
  challengeId: challenge.id,
  audio: audioBuffer, // Buffer
  transcript: 'Authorize transfer',
});
const decision = await client.createDecision(intent.id, {
  action: 'APPROVE',
  proofId: proof.id,
});

// Execute transfer
const execution = await client.executeIntent({
  intentId: intent.id,
  approvalToken: decision.approvalToken,
  idempotencyKey: 'idempotency-key-123',
});
```

## API Reference

### Client Methods

#### `createIntent(params)`
Create a new transfer intent.

#### `getIntent(intentId)`
Get an intent by ID.

#### `listIntents(params?)`
List intents with optional filters.

#### `createBeneficiary(params)`
Create a new beneficiary.

#### `listBeneficiaries()`
List all beneficiaries.

#### `createChallenge(intentId, params?)`
Create a voice challenge.

#### `submitProof({ challengeId, audio, transcript, ... })`
Submit voice proof for a challenge (JSON mode; `audio` can be a Buffer).

#### `createDecision(intentId, { action, proofId, reasonCodesJson? })`
Approve/deny/step-up an intent.

#### `executeIntent({ intentId, approvalToken, idempotencyKey? })`
Execute an approved intent (uses `X-POSE-APPROVAL` header).

#### `verifyWebhookSignature({ rawBody, signatureHeader, secret, toleranceSeconds? })`
Verify webhook signature authenticity.

## Webhooks

```javascript
const express = require('express');
const app = express();

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signatureHeader = String(req.headers['x-wire-signature'] || '');
  const rawBody = req.body.toString('utf8');
  
  const isValid = client.verifyWebhookSignature({
    rawBody,
    signatureHeader,
    secret: webhookSecret,
    toleranceSeconds: 300,
  });
  
  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(rawBody);
  // Handle webhook event
  console.log('Received event:', event.type);
  
  res.status(200).send('OK');
});
```

## Sandbox (deterministic seed/reset)

If your backend enables `SANDBOX_MODE=true`, you can reset a deterministic dataset:

```javascript
await client.sandboxReset("default");
```

## Error Handling

```javascript
const { WireError } = require('@wire/sdk');

try {
  const intent = await client.createIntent(params);
} catch (error) {
  if (error instanceof WireError) {
    console.error('API Error:', error.message);
    console.error('Status Code:', error.statusCode);
    console.error('Response Data:', error.data);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## License

MIT
