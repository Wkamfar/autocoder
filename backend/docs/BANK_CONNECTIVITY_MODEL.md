# Bank Connectivity Model (Agent 7)

## Models

### BankConnection

Represents a user-authorized connection to a bank connectivity provider (Plaid-class).

Key fields:

- `provider`: connector name (`plaid`, `teller`, `mx`, `mock`, ...)
- `institutionName`
- `status`: `ACTIVE` | `DEGRADED` | `REVOKED`
- `consentExpiresAt`
- `accessTokenEncrypted` / `refreshTokenEncrypted`: stored encrypted at rest (AES-256-GCM envelope)
- `lastSyncAt` / `lastError`: health model for UX and fail-closed execution

### BankAccount

Represents an account discovered under a connection.

Key fields:

- `railsEligible`: `["ACH","WIRE"]` etc (capabilities/eligibility)
- `ownershipJson`: provider-specific owner signals (nullable)
- `verificationJson`: provider-specific verification signals (nullable)

## Token storage

- Encryption key: `WIRE2_SECRETS_ENCRYPTION_KEY` (32 bytes base64url)
- Tokens are never logged.
- The backend stores only encrypted blobs for connector tokens.

## Degraded modes (required UX contract)

- If `BankConnection.status != ACTIVE`, execution should **fail closed** unless explicitly permitted by policy.
- UI should show last sync, failure reason, and remediation instructions (relink/re-consent).

