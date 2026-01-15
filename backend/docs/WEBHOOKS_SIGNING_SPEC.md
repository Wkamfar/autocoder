# Webhooks Signing Spec (Wire2)

## Overview

Wire2 signs every webhook delivery so you can verify authenticity and reject replays/tampering.

## Delivery Payload (JSON)

Wire2 sends `POST` with a JSON body:

```json
{
  "id": "delivery_...",
  "type": "intent.created",
  "data": { "...": "..." },
  "timestamp": 1700000000000
}
```

## Headers

- `X-WIRE-Signature`: `t=<unix_ms>,v1=<hex>` (preferred) or legacy `t=<unix_ms>,v0=<hex>`
- `X-WIRE-Timestamp`: `<unix_ms>` (redundant; included for convenience)
- `X-WIRE-Signature-Mode`: `v1` or `legacy`

## Signature Construction (v1)

- **Message**: `${timestamp}.${rawBody}`
  - `timestamp` is the integer unix timestamp in milliseconds.
  - `rawBody` is the exact UTF-8 request body bytes interpreted as a string.
- **Signature**: `HMAC_SHA256(webhook_secret, message)` encoded as lowercase hex.
- **Header**: `X-WIRE-Signature: t=<timestamp>,v1=<signatureHex>`

## Legacy Mode (v0)

Older webhooks may be delivered in legacy mode (until the webhook secret is rotated after enabling encrypted secret storage):

- **Key**: `sha256Hex(webhook_secret)` (i.e., hash of secret) is used as the HMAC key.
- **Header**: `t=<timestamp>,v0=<signatureHex>`

If you rotate the webhook secret, deliveries will switch to **v1**.

## Production requirement

In production, Wire2 requires `WIRE2_SECRETS_ENCRYPTION_KEY` to be configured so all newly created/rotated webhooks use **v1** signing.

## Verification Requirements (recommended)

- **Replay window**: reject if `abs(now - timestamp) > 300s` (configurable).
- **Constant-time compare**: compare provided signature vs expected using timing-safe equality.
- **Store last-seen delivery IDs** (optional but recommended): if you need stronger replay defense, persist `id` for a short TTL and reject duplicates.

