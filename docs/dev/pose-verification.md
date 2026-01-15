# POSE Verification (Signed Receipts) — Integrator Quickstart

## What you get

POSE can emit a **signed receipt** (a JWS) for key events like:

- `execution.completed`
- `settlement.reported`

The receipt is **portable**: verifiers do not need database access.

## Fetch public keys (JWKS)

Use either endpoint:

- `GET /.well-known/pose-jwks.json`
- `GET /api/wire/keys/jwks`

## Verify a receipt (offline)

1. Split the receipt into `header.payload.signature` (JWS compact format).
2. Fetch JWKS, find the key where `kid` matches the receipt header `kid`.
3. Verify signature using Ed25519 over the ASCII string:

\[
\text{signingInput} = base64url(headerJson) \; "." \; base64url(payloadJson)
\]

4. Parse payload JSON and validate schema fields for your use-case.
5. Optionally compare payload fields to your expected values (`intentId`, `bindingHash`, etc.).

## Optional: server-side verification

POSE also exposes a convenience verifier (always returns 200):

`POST /api/wire/verify/pose-receipt`

```json
{
  "jws": "<receipt>",
  "expected": { "receiptType": "execution.completed" }
}
```

## Notes (security + privacy)

- **No PII** is included in the signed payload.
- `beneficiaryHash` is a derived hash; do not treat it as bank account proof by itself.
- `evidence_chain_head` and `bundleHash` (if present) enable deeper audit workflows.

