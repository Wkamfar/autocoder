# Reconciliation & Exceptions (Agent 7)

## Objective

Every provider signal must be explainable and auditable:

`ProviderEvent` → (normalized) → `ExecutionLedger` update OR `ReconciliationException`

## ProviderEvent

Ingested provider events are:

- stored raw (canonical JSON string)
- stored normalized (canonical JSON string)
- deduped via unique `dedupeKey`
- processed exactly-once (best effort) via `processedAt`

## Matching strategy (current scaffold)

Primary join key:

- `executionRef` (from provider event → matches `ExecutionLedger.executionRef`)

If `executionRef` is missing or unknown:

- create an exception (`unscoped_event` or `unmatched_event`)

## Exceptions

`ReconciliationException` is an operator-visible queue:

- `OPEN` → needs triage
- `RESOLVED` → resolution recorded

Common kinds:

- `unmatched_event`: provider event references unknown execution
- `unscoped_event`: provider event missing correlation keys
- `unmapped_event_type`: provider event type not yet explicitly mapped

## Ops hooks

The backend provides:

- ingestion endpoint: `POST /api/wire/provider-events`
- processing endpoint: `POST /api/wire/provider-events/process`

These are scaffolding endpoints; real providers should use signature-verified webhooks and/or polling jobs.

