# API Keys Model (Wire2)

## Goals

- Programmatic access for integrations (like Stripe)
- Key rotation + expiry + auditability
- Least privilege (permissions/scopes)

## Key Material

Wire2 issues a **key** and an optional **secret**:

- `apiKey`: `wire_live_<random>`
- `apiSecret`: `wkey_secret_<random>` (returned once on creation)

Both are treated as sensitive.

## Storage (current)

- `ApiKey.keyHash = sha256(apiKey)` (unique)
- `ApiKey.secretHash = sha256(apiSecret)` (for validation when a secret is provided)
- Only the key prefix is ever shown back to users after creation.

## Authentication Formats

Supported request formats:

- **Recommended (key + secret)**: `Authorization: Basic base64(<apiKey>:<apiSecret>)`
- **Legacy (key-only)**: `Authorization: ApiKey <apiKey>` or header `X-API-KEY: <apiKey>`

Optional hardening:

- Set `WIRE2_REQUIRE_API_KEY_SECRET=true` to **require Basic auth** and reject key-only auth.

## Rotation / Revocation

- Rotation should be done by **creating a new key**, updating clients, then revoking the old key.
- Revoked keys are rejected immediately.
- Expired keys are rejected immediately.

## Operational Guidance

- Never log API keys or secrets.
- Treat keys as “bearer” credentials unless you enforce the secret-based mode.
- Prefer short expiries + rotation for higher assurance tenants.

