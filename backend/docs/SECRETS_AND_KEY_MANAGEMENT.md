## Secrets & Key Management (Agent 5)

**Purpose:** define how Wire2 stores, uses, and rotates secrets/keys required for secure operation.

### Shipped today (evidence)

- **Evidence signing keys** are provided via env (base64url) and format-validated at startup:
  - `wire2/backend/src/server.ts`
  - `wire2/backend/src/lib/keyManagement.ts`
- **Webhook secrets** are generated and stored as:
  - `secretHash` (sha256) + optionally encrypted secret (when `SECRETS_ENCRYPTION_KEY` is set)
  - `wire2/backend/src/lib/secretBox.ts`
  - `wire2/backend/src/modules/webhooks/webhookService.ts`

### Bank-grade requirements (next)

- Move secrets out of env and into a managed store (KMS/Vault/Secrets Manager).
- Ensure least-privilege IAM policies per service, per environment.
- Rotation:
  - regular schedule (documented)
  - emergency revoke playbook
  - zero-downtime rotation where feasible (dual-read / dual-sign)

### Never log

Logs MUST NOT include:

- auth tokens
- refresh tokens
- API key secrets
- webhook secrets
- raw voice artifacts

### Incident playbooks (required)

- suspected key leak: rotate, invalidate, audit, notify
- signing key compromise: revoke + re-sign strategy, evidence impact analysis

