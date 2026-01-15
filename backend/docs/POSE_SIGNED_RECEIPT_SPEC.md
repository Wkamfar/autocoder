# POSE Signed Receipt (“POSE Verification Token”) — Spec (v1)

This document defines the **portable, cryptographically verifiable receipt** emitted by Wire2 for executions we control.

## Goals

- **Offline verification**: a verifier can validate a receipt using only the receipt JWS + POSE JWKS.
- **No PII in signed payload**: payload contains only derived/minimized fields.
- **Deterministic payload canonicalization**: stable signatures; safe re-issuance.

## Formats

- **Signature format**: JWS Compact Serialization
- **Algorithm**: `EdDSA` (Ed25519)
- **Header**:
  - `alg`: `"EdDSA"`
  - `kid`: key id used to sign
  - `typ`: `"POSE-RECEIPT+JWS"`

## Public keys (JWKS)

- **Primary**: `GET /.well-known/pose-jwks.json`
- **Alternate**: `GET /api/wire/keys/jwks`

Keys are published as JWKs of type:

- `kty`: `"OKP"`
- `crv`: `"Ed25519"`
- `x`: base64url public key bytes
- `kid`: key id

## Canonicalization rule (critical)

Before signing, POSE canonicalizes the JSON payload using stable key ordering (JCS-like):

- Objects: keys sorted lexicographically
- Arrays: order preserved
- No whitespace

Implementation: `wire2/backend/src/lib/canonicalJson.ts`

## Payload schema (v1)

All receipts use `schema_version: 1`.

Required fields:

- `schema_version`: `1`
- `receiptType`: `"execution.completed" | "settlement.reported"`
- `orgId`
- `intentId`
- `executionRef`
- `bindingHash`
- `rail` (e.g. `"ACH"`, `"WIRE"`)
- `amount`: `{ currency, minor }`
- `beneficiaryHash` (derived token hash, not bank details)
- `policyVersion` (nullable)
- `occurredAt` (ISO timestamp)
- `evidence_chain_head` (nullable hash)

Optional fields:

- `bundleId`, `bundleHash` (if an audit bundle exists)
- `provider_correlation`: `{ provider, externalRef, externalStatus }`
- `request_id`, `trace_id`

## Server-side verifier (optional)

Endpoint: `POST /api/wire/verify/pose-receipt`

Body:

```json
{
  "jws": "<compact-jws>",
  "expected": {
    "intentId": "intent_...",
    "receiptType": "execution.completed"
  }
}
```

Returns `{ valid, reasons, header, payload, signerKeyId, revoked }`.

## Key rotation & revocation (v1)

Environment-based keys:

- `SIGNING_KEY_ID`
- `SIGNING_PRIVATE_KEY` (base64url; 32 or 64 bytes)
- `SIGNING_PUBLIC_KEY` (base64url; 32 bytes)
- `SIGNING_PUBLIC_KEYS_JSON` (kid → publicKey base64url)
- `SIGNING_REVOKED_KEY_IDS` (comma-separated)

Revoked key ids are not published in JWKS and will cause verifier reason `key_revoked`.

