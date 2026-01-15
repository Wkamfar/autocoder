# Idempotency Policy (Agent 7)

## Goals

- **No duplicate side effects** under client retries, job retries, provider retries, or webhook replays.
- **Deterministic outcomes**: same idempotency key + same request must return the same response.
- **Safe failure**: reusing a key with a different request body must hard-fail.

## HTTP idempotency keys (mutations)

Wire2 enforces idempotency for mutating routes via middleware:

- Client sends `X-Idempotency-Key: <opaque string>`
- Server computes `keyHash = sha256(canonicalJson({ orgId, endpoint, idempotencyKey }))`
- Server computes `requestHash = sha256(canonicalJson(requestBody))`
- If `keyHash` exists:
  - If `requestHash` matches: **return cached response**
  - If `requestHash` differs: **409 `IDEMPOTENCY_KEY_REUSE`**
- If not exists: allow request to proceed and store response (2xx/3xx) for replay.

TTL: 24 hours (see `IDEMPOTENCY_KEY_TTL_HOURS`).

## Execution idempotency (money movement)

Money movement must be idempotent at multiple layers:

- **Workflow idempotency**: the same `Intent` + `bindingHash` must not execute twice.
- **Provider boundary**: all provider submission calls must include provider-specific idempotency keys (future provider integrations).
- **Provider callbacks**: webhooks/polling updates must be deduped by stable provider event keys (`ProviderEvent.dedupeKey`).

