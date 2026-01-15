# Unified Verifier Spec (WIRE / ACH / CASH / BTC / ETH)

**Owner:** Agent 12  
**Status:** Spec (no implementation in this change-set)

## Goal

Provide a single verifier that can answer:

- “Did this transaction happen?”
- “Who approved/proved what, and when?”
- “Is the evidence complete and untampered?”
- “Is the rail-specific settlement/finality satisfied?”

## Inputs

At minimum, verifier takes:

- `intentRef` (preferred)

Optionally:

- `bundleId` (off-chain evidence bundle id)
- `txRef` (rail-specific ref: bank trace id, BTC txid, ETH txHash)
- `mode`: `redacted` | `full` (authorization-gated)

## Outputs

- Timeline of events (ordered, monotonic sequence)
- For each event:
  - event type, timestamp, signer key id
  - verification status (hash ok, signature ok, on-chain anchor ok)
- Rail finality status:
  - WIRE/ACH: provider settlement/return status + reconciliation marker
  - CASH: custody/attestation completeness
  - BTC/ETH: confirmation/finality thresholds
- Explicit failure reasons:
  - missing events, broken chain, signature invalid, key revoked, anchor missing, finality not reached

## Verification steps (common core)

1. Fetch on-chain anchors for `intentRef` (Agent 11 contract)
2. Verify hash chain or batch inclusion proofs
3. Fetch bundle (if provided/authorized)
4. Recompute commitments and compare to anchors
5. Verify signatures against key registry (incl. revocations)
6. Verify rail-specific receipts/finality proofs

## Rail-specific plugins

Verifier should be modular:

- `WireAchVerifier`: bank settlement artifacts + return handling
- `CashVerifier`: attestations + dual control + discrepancy handling
- `BtcVerifier`: txid + confirmations + reorg handling
- `EthVerifier`: txHash + receipt + logs + finality rule

## Public vs authenticated verification

- Public verifier view:
  - shows event existence and integrity **without exposing sensitive fields**
- Authenticated verifier view:
  - can download full evidence bundle and reveal committed fields

## Edge cases (must be handled)

- Partial completion (intent created but not executed)
- Multiple execution attempts (must be explicit)
- Returns/reversals after “completed”
- Reorgs (BTC/ETH) affecting finality
- Key rotation/revocation mid-flow
- Missing anchor due to outage (should be detectable + auditable)

