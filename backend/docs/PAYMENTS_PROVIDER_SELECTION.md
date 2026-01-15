# Payments Provider Selection (Agent 7 — P0)

## Decision (P0)

**Connectivity + account verification**: **Plaid (Link + Auth/Identity)**  
**ACH money movement (P0 rail)**: **Plaid Transfer**  
**Wires**: **defer to P1** (requires sponsor bank/processor; keep our provider abstraction stable so we can add Modern Treasury / direct bank APIs without rewriting the domain model).

This split optimizes for:
- **Fast “bank-grade” P0**: real institutions, real webhook behavior, real failure modes, strong sandbox tooling.
- **Clean separation of concerns**: connectivity ≠ execution rails.
- **Vendor portability**: lock-in limited to connector module + stored provider correlation fields.

## Rails scope

### P0 (must be production-credible)
- **ACH** (including same-day where supported by provider)

### P1+
- **Wire** (US domestic + international depends on sponsor bank)
- **Instant rails** (RTP/FedNow) if sponsor supports

## “Bank-grade” provider requirements

### Security
- OAuth / Link flow must support state/nonce/PKCE where applicable
- Webhook signatures and replay prevention supported (timestamp tolerance, rotation)
- Token scope minimization and revocation supported
- Sandbox + production parity for signature verification

### Reliability + ops
- Webhooks are at-least-once (expected); provider must document retry policies
- Clear correlation identifiers (transfer/payment id, event id where available)
- Deterministic retrieval endpoints for backfill and reconciliation (polling/reporting)
- Sandbox fidelity: can simulate returns, NSF, invalid account, cutoff misses, and partial outages

### Accounting/reconciliation posture
- Provider must expose “truth artifacts” we can reconcile against:
  - settlement/transfer status timeline
  - trace IDs / reference IDs
  - (ideally) statements/reports for day-end matching

## Webhook semantics (how we treat all providers)

Wire2 assumes **all provider callbacks are untrusted** and may be:
- duplicated
- out-of-order
- delayed (minutes → hours)
- missing (requires polling/backfill)

### Wire2 contract (canonical)
- Every inbound provider signal is stored as a `ProviderEvent`
  - raw payload (redacted if needed)
  - normalized envelope
  - **dedupe key** (unique) for replay safety
- Processing is deterministic:
  - provider event → execution ledger update OR reconciliation exception
- Unknown event types never silently succeed:
  - they create a `ReconciliationException` (`unmapped_event_type`)

### Signature verification (required)
For each provider we implement:
- verify signature over raw body + timestamp header (provider-specific)
- reject if timestamp outside tolerance (e.g. 5 min)
- store the **provider signature metadata** (hash) with the provider event for forensics

## Plaid-specific notes (P0)

### Connectivity (Link + Auth/Identity)
- Link provides strong sandbox tooling and a mature UX/security surface.
- Auth/Identity signals provide account/routing verification and (where available) ownership hints.

### ACH (Plaid Transfer)
- Use provider idempotency keys on create/submit boundaries (provider-specific fields)
- Treat transfer status webhooks as at-least-once; always backfill by querying transfer status when needed
- **Correlation invariant (required)**: for Plaid Transfer executions, set `ExecutionLedger.externalRef = transfer_id` immediately when the create call succeeds so `/transfer/event/sync` can deterministically map events → execution.

See: `wire2/backend/docs/PLAID_TRANSFER_EXECUTION_CORRELATION.md`.

### Sandbox fidelity (what we must test)
P0 must include an automated “provider chaos suite” that simulates:
- webhook replays (same event delivered multiple times)
- out-of-order status transitions
- dropped webhook (requires polling/backfill)
- returns/failures (NSF, invalid account, unauthorized, etc. as supported)
- provider degradation (timeouts, 5xx, rate limits)

## Coordination points

### With Agent 6 (Evidence / receipts)
Every execution transition must emit a verifiable “receipt” payload that includes:
- intentId, orgId, executionRef, rail, amount/currency
- provider + external refs (trace IDs)
- transition (from → to), timestamp, actor/request_id
- links to the immutable event chain head

### With Agent 8 (Jobs/outbox)
Provider events and polling/backfill must run through:
- outbox pattern for event emission
- job queue for retries/backoff + DLQ
- idempotent processors keyed by `ProviderEvent.dedupeKey`

## Exit criteria for P0 provider selection

We consider P0 complete when:
- We can execute ACH end-to-end with real provider semantics
- Webhook verification + replay safety is proven
- Reconciliation exceptions are visible and actionable
- Sandbox scenarios cover failure/return paths

