# Idempotency

For mutation endpoints, Wire2 supports idempotency keys via:

- Header: `X-Idempotency-Key: <string>`

Recommended:

- Generate a unique key per “client intent” (UUID).
- Reuse the same key for retries of the same operation.
- Do not reuse keys across different operations.

See also:

- `wire2/backend/docs/IDEMPOTENCY_POLICY.md` (planned)

