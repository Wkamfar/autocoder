# Payments State Machines (Agent 7)

## Why two layers of state?

- `Intent.status`: user/business workflow (draft → proof → approvals → executed)
- `ExecutionLedger.status/state`: execution/reconciliation workflow (submission → provider acceptance → settlement/return)

`ExecutionLedger.state` is a **string** so rail/provider states can evolve without DB enum churn, but the contract is still explicit and testable.

## Minimal execution states (scaffold)

All rails should map into this core lifecycle:

- **created**: execution record created, not yet sent
- **submitted**: request submitted to provider/processor
- **settled**: provider indicates settlement (maps to `ExecutionLedger.status=CONFIRMED`)
- **failed**: provider indicates failure (maps to `ExecutionLedger.status=FAILED`)
- **returned**: return/recall/chargeback-like outcome where applicable (maps to `FAILED` + reason codes)

## Terminality rules

- `settled`, `failed`, `returned` are terminal states (future: allow post-settlement adjustments via compensating events)
- State must be monotonic (no “un-fail”)

## Provider event mapping (current implementation)

In `ProviderEvent.providerEventType`:

- `payment.settled` → `ExecutionLedger.status=CONFIRMED`, `state=settled`, `reconciliationStatus=matched`
- `payment.failed` → `ExecutionLedger.status=FAILED`, `state=failed`
- `payment.returned` → `ExecutionLedger.status=FAILED`, `state=returned`
- unknown types → reconciliation exception (`unmapped_event_type`)

## Next (bank-grade extension)

Per-rail state machines should explicitly model:

- cutoffs and effective dates
- acceptance vs settlement
- return codes and reversible/irreversible boundaries
- retries and duplicate/out-of-order provider events

