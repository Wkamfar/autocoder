# Plaid Connectivity (Link + Auth/Identity) — Implementation Notes

This document describes the Wire2 Plaid connectivity implementation for **sandbox/dev** and the constraints needed for bank-grade production.

## Endpoints

All endpoints are under the backend prefix `/api/wire` (see `wire2/backend/src/app.ts`).

### Create Link token

`POST /api/wire/banks/plaid/link_token/create`

Body:

- `clientUserId` (string): stable identifier in your system
- `redirectUri` (optional URL)

Response: Plaid `link_token` + expiration.

### Exchange public token

`POST /api/wire/banks/plaid/public_token/exchange`

Body:

- `publicToken` (string): Plaid `public_token` from Link

Side effects:

- Creates `BankConnection(provider="plaid")`
- Stores `access_token` in `BankConnection.accessTokenEncrypted`
- Ingests `BankAccount` rows from `/accounts/get`
- Stores minimized `ownershipJson` / `verificationJson` snapshots (no raw PII)

### Ops: refresh/revoke

- `POST /api/wire/bank/connections/:id/refresh` (requires `bank:admin`)
- `POST /api/wire/bank/connections/:id/revoke` (requires `bank:admin`)

## Token storage

- Tokens are stored in `BankConnection.accessTokenEncrypted`
- Encryption uses `WIRE2_SECRETS_ENCRYPTION_KEY` (AES-256-GCM via `wire2/backend/src/lib/secretBox.ts`)

**Production rule:** `WIRE2_SECRETS_ENCRYPTION_KEY` must be set, or token storage will error.

## Connection health model

`BankConnection.status`:

- `ACTIVE`: Link is healthy and refresh succeeds
- `DEGRADED`: provider calls failed; requires re-auth or operator action
- `REVOKED`: item removed and tokens wiped

## Auditability

Token lifecycle actions emit org audit events (tamper-evident chain):

- `bank.plaid.link_token.created`
- `bank.connection.created`
- `bank.connection.refreshed`
- `bank.connection.revoked`

No secrets are included in audit payloads.

