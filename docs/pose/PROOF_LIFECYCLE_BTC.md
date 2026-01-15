# Proof Lifecycle (BTC)

**Owner:** Agent 12  
**Status:** Spec (no implementation in this change-set)

## Inputs

- `network` (mainnet/testnet/regtest)
- `toAddress` (recipient)
- `amountSats`
- Optional: `fromAddress` (if controlled)

## Checkpoints

### 0) Intent created

- Event: `intent.created` (rail=BTC)
- Commit: `(network, toAddress, amountSats)` hashed

### 1) Beneficiary binding / address policy

- Event: `beneficiary.bound`
- Commit:
  - beneficiary address commitment
  - whitelist / policyRef commitment

### 2) Approval / proof steps

- Same maker-checker and step-up proof events as Wire/Ach (as required by policy)

### 3) Broadcast

- Event: `execution.attempted`
- Commit: `txid` (hash) + broadcast timestamp

### 4) Confirmations

- Events:
  - `btc.confirmations_reached` (N=1/3/6 or policy-defined)
  - `settlement.reported` (final at threshold)
- Commit: `(blockHeight, confirmations, blockHash commitment)`

### 5) Reorg handling

- Event: `btc.reorg_detected` if confirmations drop below threshold
- Event: `btc.finality_restored` once threshold is re-met

## Verification

Verifier must be able to:

- confirm tx exists on the BTC network (via trusted RPC or multiple providers)
- confirm confirmation depth threshold met
- match committed txid/address/amount to the off-chain bundle (if authorized)

## Edge cases

- Replace-by-fee (RBF) flows
- Double-spend attempts (policy: fail closed)
- Third-party custody: ensure custody key management is separately auditable

