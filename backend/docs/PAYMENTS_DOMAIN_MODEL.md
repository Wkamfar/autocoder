# Payments Domain Model (Agent 7)

## Core principle: Intent ≠ Execution ≠ Ledger

Wire2 separates **what the user wants** from **what the rail/provider did** from **how we account for it**.

- **Payment Intent** (`Intent`): the user’s requested transfer (amount, rail, beneficiary, purpose) plus policy/risk/approval artifacts.
- **Payment Execution** (`ExecutionLedger`): immutable record of an execution attempt for an intent/binding hash.
- **Ledger / accounting** (future): double-entry postings that explain balances and reconcile to provider truth. For now, `ExecutionLedger` + provider events act as the reconciliation spine.

## IDs and correlation

- **`intentId`**: stable identifier of the requested payment.
- **`bindingHash`**: canonical fingerprint of intent details that approvals/authorization are bound to.
- **`executionRef`**: stable identifier for an execution attempt (`exec_<intentId>_<ts>`).
- **`providerEvent.id`**: internal ID for ingested provider callback/polling events.
- **`providerEvent.dedupeKey`**: stable dedupe key (unique) for provider event replay safety.

## ExecutionLedger fields (bank-grade expectations)

`ExecutionLedger` is the “truthy audit spine” for attempts and reconciliation:

- **`status`**: coarse enum (`PENDING`/`SUBMITTED`/`CONFIRMED`/`FAILED`/`RECONCILED`)
- **`state`**: rail/provider-specific state machine string (evolvable without DB enum churn)
- **`provider`**: which connector executed the action (e.g. `plaid`, `mock`)
- **`externalRef` / `externalStatus`**: provider correlation data
- **`reconciliationStatus` / `reconciliationAt`**: matching outcome + timestamp

## ProviderEvent boundary

Every inbound provider signal becomes a stored `ProviderEvent`:

- **Raw payload** stored (as canonical JSON string)
- **Normalized envelope** stored (canonical JSON string)
- **Dedupe** via unique `dedupeKey`
- **Processing** maps provider events → execution ledger updates OR reconciliation exceptions

## Coordination (Agents 6/8)

- **Agent 6 (Evidence)**: every execution transition must emit a verifiable “receipt” payload suitable for inclusion in audit bundles.
- **Agent 8 (Reliability)**: provider event ingestion/processing should run as replay-safe background jobs (outbox + retries/backoff + DLQ).

See also: `wire2/backend/docs/PAYMENTS_PROVIDER_SELECTION.md`.

