# Proof Lifecycle (WIRE / ACH)

**Owner:** Agent 11 + Agent 12  
**Status:** Spec (no implementation in this change-set)

## Goal

Define an end-to-end, no-gaps proof timeline for WIRE/ACH such that:

- Every state transition creates signed evidence (off-chain)
- Every evidence step is anchored on POSE (on-chain commitment)
- Final settlement/return is captured and verifiable

## Actors

- **Requester** (maker)
- **Approver(s)** (checker(s))
- **System** (Wire2 backend)
- **Provider** (bank rail / processor; typically off-chain)
- **Auditor/Verifier**

## State machine (rail-agnostic)

- `DRAFT`
- `PENDING_PROOF`
- `PENDING_APPROVALS`
- `READY_TO_EXECUTE`
- `EXECUTING`
- `EXECUTED`
- `SETTLED`
- `FAILED` / `RETURNED` / `REVERSED`

## Evidence checkpoints (required, in order)

For each checkpoint:

- Produce **Evidence Envelope** (canonical JSON)
- Compute `eventHash`
- Sign with org key (+ optional user/device keys)
- Append to off-chain event chain
- Anchor to POSE (strict or batched, per policy)

### 0) Intent created

- **Event**: `intent.created`
- **Payload (committed)**:
  - rail type (WIRE/ACH), amount/currency commitment, beneficiary commitment, policyRef
- **Notes**: never store bank routing/account numbers on chain; commit only.

### 1) Proof requested (if policy requires)

- **Event**: `proof.requested`
- **Payload**: challenge requirements (L1/L2/L3) committed

### 2) Proof submitted + verified (voice/phone/etc.)

- **Event**: `proof.submitted`, `proof.verified`
- **Payload**:
  - proof result committed
  - proof artifacts stored off-chain (redacted/full variants)

### 3) Approvals added (maker-checker)

- **Event**: `approval.added`
- **Payload**:
  - approver role, approval outcome, binding hash commitment

### 4) Execution attempted

- **Event**: `execution.attempted`
- **Payload**:
  - idempotency key hash
  - executionRef commitment

### 5) Provider acknowledgment (if available)

- **Event**: `execution.acknowledged`
- **Payload**:
  - provider trace/confirmation commitment

### 6) Execution completed/failed

- **Event**: `execution.completed` or `execution.failed`
- **Payload**:
  - error taxonomy code (if failed)
  - provider receipt commitment (if success)

### 7) Settlement / return / reversal

- **Event**: `settlement.reported` / `return.reported` / `reversal.reported`
- **Payload**:
  - settlement statement commitment, reason codes commitment

### 8) Reconciliation complete

- **Event**: `reconciliation.completed`
- **Payload**:
  - ledger ↔ provider statement mapping commitment

### 9) Evidence bundle created + verification

- **Event**: `evidence.bundle_created`
- **Payload**:
  - bundle content-address commitment, redaction mode, chain head hash

## Verification (what a user/auditor can prove)

- The intent existed at time X
- The set of approvals/proofs existed and was not modified
- The execution attempt and result existed
- Settlement/return state was reported with committed artifacts
- The full bundle matches the on-chain commitments

## Edge cases (must be documented + handled)

- Multiple execution attempts (retries) must create distinct execution events
- Beneficiary change after approval must invalidate binding hash and require re-approval
- Provider delays: settlement may arrive later; keep chain consistent

