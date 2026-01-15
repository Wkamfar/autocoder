# Plaid Transfer Execution (ACH) — Implementation

## Overview

When `PLAID_TRANSFER_ENABLED=true`, Wire2 can execute an **ACH credit** using Plaid Transfer.

Core invariant (bank‑grade): **`ExecutionLedger.externalRef = transfer_id`** immediately after `transfer/create` succeeds.

## Config

- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV` = `sandbox|development|production`
- `PLAID_TRANSFER_ENABLED=true`

Production safety:

- `NODE_ENV=production` requires **`X-Idempotency-Key`** on execution routes.
- Tokens at rest require `WIRE2_SECRETS_ENCRYPTION_KEY`.

## Execution flow

1. `POST /api/wire/intents/:id/execute`
2. `executeIntent` creates the ledger row (status `PENDING`, provider `plaid`, state `created`).
3. Provider connector runs:
   - `POST /transfer/recipient/create`
   - `POST /transfer/authorization/create`
   - `POST /transfer/create` (idempotent)
4. On success:
   - `ExecutionLedger.externalRef = transfer_id`
   - status advances to `SUBMITTED`

## Request shape (sandbox)

Execution accepts an optional body:

```json
{
  "provider": "plaid",
  "plaidRecipient": {
    "name": "Vendor LLC",
    "routingNumber": "011000015",
    "accountNumber": "123456789"
  }
}
```

These details are **not stored** and must not be logged.

## Idempotency

- Wire2 uses `X-Idempotency-Key` to avoid duplicate executions.
- Plaid Transfer create uses `idempotency_key` set from the raw `X-Idempotency-Key` value.

## Reconciliation

- Plaid `TRANSFER_EVENTS_UPDATE` webhook triggers `/transfer/event/sync`
- Sync emits `ProviderEvent` rows with `transfer_id` correlation to `ExecutionLedger.externalRef`
- Deterministic state transitions update the ledger

