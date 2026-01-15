# Threat Model (Wire2)

**Owner:** Agent 0 (Coordinator/CTO) + Agent 10 (Backend)  
**Last updated:** 2026-01-14  
**Status:** Draft (iterate; review at least monthly)

This document is the formal threat model required before “enterprise/bank‑grade” claims.

## Scope

- Wire2 frontend (`wire2/frontend/`)
- Wire2 backend APIs (`/api/wire/*`)
- Fraud/voice services (`wire2/backend/fraud-service`, `wire2/backend/voice-service`)
- Storage for evidence bundles and event chains
- External providers (IdP/SSO, email, bank connectors)

## Assets (what we must protect)

- **Funds movement state**: intents, approvals, execution tokens, final execution status
- **Beneficiaries**: routing + identity information (high sensitivity)
- **Credentials & sessions**: auth tokens, magic links, session state
- **Voice artifacts**: voiceprints/embeddings, challenge phrases, proofs
- **Audit evidence**: event chains, audit bundles, signature material
- **Secrets**: API keys, webhook secrets, signing keys, DB credentials

## Actors

- External attacker (no account)
- Compromised user account (ATO)
- Malicious insider (support/admin/engineer)
- Partner system compromised (webhook consumer, bank connector)
- Network adversary (MITM assumptions limited by TLS, but include misconfig cases)

## Trust boundaries

- Browser ↔ backend API gateway/services
- Backend services ↔ database/redis/storage
- Backend ↔ external providers (IdP/email/bank)
- Admin UI ↔ privileged backend endpoints

## Attacker goals

- Execute fraudulent transfer or manipulate beneficiary
- Account takeover and privilege escalation
- Evidence tampering (erase/alter event chain or bundle)
- Exfiltrate sensitive PII/credentials/voice data
- Denial of service to disrupt operations or force unsafe fallbacks

## Key abuse cases & mitigations

### ATO / session hijack

- **Threats**: stolen tokens, magic-link scanning, replay, device compromise
- **Mitigations**
  - Short token TTLs; rotation; revocation
  - Bind approvals/execution tokens to org + user + intent + TTL
  - Rate limits + anomaly detection
  - Step-up auth for sensitive actions (MFA / voice step-up as policy)

### Beneficiary tampering

- **Threats**: modify payout details after approval, race conditions, UI desync
- **Mitigations**
  - Immutable snapshots in intent; lock beneficiary records at certain states
  - Server-side state machine enforcement
  - Strong audit trail (who/what/when) and verification tooling

### Replay / double execution

- **Threats**: retries or malicious replays cause multiple executes
- **Mitigations**
  - Idempotency on side-effect endpoints
  - Single-flight execution lock + state constraints
  - Durable execution ledger + reconciliation

### Evidence tampering

- **Threats**: modify event chain or bundles; forge signatures; swap storage objects
- **Mitigations**
  - Canonical JSON + signature verification
  - Key management + rotation + access control
  - Content-addressed storage / hashes

References:

- `wire2/backend/docs/CANONICAL_JSON_SPEC.md`
- `wire2/backend/docs/BUNDLE_FORMAT.md`
- `wire2/backend/docs/EVENT_CHAIN_VERIFICATION.md`
- `wire2/backend/docs/SIGNING_KEY_MANAGEMENT.md`

### SSRF / injection via integrations

- **Threats**: SSRF via webhook URLs or other integrations; SQL injection; template injection
- **Mitigations**
  - URL allowlists / block private ranges for outbound HTTP
  - Parameterized queries via ORM; validation
  - Strict content types; size limits; upload scanning (if any)

### Insider threat / privilege abuse

- **Threats**: admin overreach, broad data access, key access
- **Mitigations**
  - Least privilege, scoped permissions, audited admin actions
  - Break-glass access with explicit logging and expiry
  - Separation of duties for key ops

## Residual risk tracking

All residual risks must be entered in:

- `wire2/docs/RISK_REGISTER.md`

## Review cadence & sign‑off

- **Monthly review**: Agent 0 + Agent 10
- **Pre-launch review**: within 7 days of launch
- **Change triggers**: new auth method, new bank connector, new public routes, new storage provider, new privileged endpoints

