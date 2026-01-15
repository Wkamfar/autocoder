# Proof Lifecycle (CASH)

**Owner:** Agent 12  
**Status:** Spec (no implementation in this change-set)

## Reality check

Cash has no network receipt. Verification is achieved via **controls + attestations + tamper-evident evidence**, anchored on POSE.

## Actors

- Maker (requester)
- Checker(s) (approvers)
- Custodian(s) (physical handlers)
- Depository (bank branch / vault / armored carrier)
- System (Wire2)

## Required checkpoints (no gaps)

### 0) Intent created

- Event: `intent.created` (rail=CASH)
- Commit: amount/currency, custody policy, location policy (coarse), intended depository type

### 1) Custody policy enforced

- Event: `custody.policy_applied`
- Commit: required number of custodians, dual control rules, cooldown windows, exception rules

### 2) Pickup / handoff attestation (dual control)

- Event: `cash.handoff_attested`
- Requirements:
  - two independent signatures (maker + checker or two custodians)
  - timestamp + coarse location commitment
  - optional media commitment (photo/video hash) stored off-chain

### 3) Transport / custody continuity

- Event: `cash.custody_checkpoint`
- Repeatable: periodic attestations (optional) for high-value transfers

### 4) Deposit / intake receipt

- Event: `cash.deposit_receipt_attested`
- Commit:
  - deposit slip hash (off-chain)
  - teller/branch reference hash (off-chain)
  - discrepancy (short/over) fields committed

### 5) Completion

- Event: `settlement.reported` (cash settled by depository intake)

### 6) Disputes / discrepancies

- Events:
  - `cash.discrepancy_reported`
  - `cash.discrepancy_resolved`
- Commit: reason codes + resolution metadata (off-chain)

## Verification

Verifier must show:

- who attested custody handoffs (key ids, roles)
- evidence chain integrity + on-chain anchor integrity
- discrepancy outcomes

## Anti-fraud hard requirements

- dual control for handoffs
- mandatory cooldown for large cash intents
- explicit exception policy with sign-off + expiry

