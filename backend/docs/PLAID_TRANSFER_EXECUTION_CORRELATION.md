# Plaid Transfer Execution + Correlation Contract (Bank‑Grade)

## Goal

Make Plaid Transfer executions **provably reconcilable** end‑to‑end:

`Intent` → `ExecutionLedger` → (Plaid `transfer_id`) → (`/transfer/event/sync` + webhooks) → `ProviderEvent` → deterministic `ExecutionLedger` transitions.

## Best-choice invariant (non‑negotiable)

### 1) `ExecutionLedger.externalRef` MUST equal Plaid `transfer_id`

For any execution performed via Plaid Transfer:

- **`ExecutionLedger.provider`** = `"plaid"`
- **`ExecutionLedger.externalRef`** = **Plaid `transfer_id`** (string)

This is the **primary join key** for correlating Plaid transfer events back to a specific execution attempt.

Why this is the best choice:
- `transfer_id` is the **stable provider identifier** for the money-movement object.
- Plaid transfer events include `transfer_id`, so correlation does not depend on fragile heuristics.
- It supports bank‑grade backfills: if webhooks are dropped, `/transfer/event/sync` still contains everything needed.

### 2) Set `externalRef` immediately at execution time (before SUBMITTED)

When the Plaid create call succeeds, we must:
- update the execution ledger row with `externalRef=transfer_id`
- persist the mapping **before** we advance `ExecutionLedger.status` to `SUBMITTED`

This guarantees the sync worker can always correlate the next event batch.

## Idempotency contract (execution boundary)

For Plaid Transfer create/submit:

- The **Wire2 idempotency key** (HTTP `X-Idempotency-Key`) becomes the **provider idempotency key** for the create call.
- The execution ledger `metadataJson` should store:
  - the idempotency key used
  - provider request IDs (when available)

This prevents duplicate `transfer_id` creation on retries/timeouts.

## Webhook → sync → event processing contract

### Webhook signal

- Plaid sends `TRANSFER_EVENTS_UPDATE` webhooks.
- These do **not** represent a single execution; they are a “new events available” signal.

Wire2 behavior:
- store the webhook as a `ProviderEvent` (type `plaid.TRANSFER.TRANSFER_EVENTS_UPDATE`)
- enqueue a **Plaid sync job** (deduped by triggering ProviderEvent id)

### Sync worker

The sync job calls:
- `POST /transfer/event/sync` with `after_id=<last_seen_event_id>` and `count<=500`

Cursor strategy (bank‑grade):
- we track progress by the **max numeric** Plaid `event_id` we have already ingested for that org
- sync continues while `has_more=true` (bounded per job tick)

### Normalized ProviderEvent (from sync)

Each Plaid transfer event becomes:

- `ProviderEvent.provider="plaid"`
- `ProviderEvent.providerEventType="plaid.TRANSFER.EVENT.<event_type>"`
- `ProviderEvent.providerEventId="<event_id>"` (string, numeric)
- `ProviderEvent.executionRef`:
  - resolved by looking up `ExecutionLedger` where `externalRef = transfer_id`
- `ProviderEvent.intentId`:
  - copied from the correlated `ExecutionLedger.intentId` when available

### Deterministic ExecutionLedger transitions

For correlated Plaid transfer events:

- `pending` → `ExecutionLedger.status=PENDING`, `state=pending`
- `posted` → `ExecutionLedger.status=SUBMITTED`, `state=posted`
- `settled` → `ExecutionLedger.status=CONFIRMED`, `state=settled`, `reconciliationStatus=matched`
- `failed|returned|cancelled` → `ExecutionLedger.status=FAILED`, `state=<event_type>`

Guardrails:
- out‑of‑order events that would “rewind” state create a `ReconciliationException` (`out_of_order_event`)
- events arriving after terminal states create a `ReconciliationException` (`state_conflict`)
- missing correlation (no `transfer_id` mapping) creates `ReconciliationException` (`unscoped_event` or `unmatched_event`)

## Where “Plaid transfer creation” should live (best choice)

**Execution should be implemented as a provider connector module**, invoked from `executeIntent`:

- `executeIntent` owns:
  - policy/approval checks
  - ledger-first invariants (create ledger row, append audit events)
- Plaid connector owns:
  - calling Plaid Transfer create/authorize/submit (as applicable)
  - extracting `transfer_id`
  - updating ledger `externalRef` and provider status

This separation keeps Wire2 portable (Plaid → Modern Treasury → sponsor bank API) while preserving the same correlation/reconciliation spine.

