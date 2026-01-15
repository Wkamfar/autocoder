# Master Proof Matrix (Event Types × Rails × Fields × Signatures × Anchoring × Verifier Rules)

**Owner:** Agent 11 + Agent 12  
**Status:** Spec (no implementation in this change-set)  
**Last updated:** 2026-01-14

This is the single “source of truth” matrix for what gets proven, signed, anchored, and verified across **WIRE / ACH / CASH / BTC / ETH**.

## Baseline (applies to every row)

Every event produces an **Evidence Envelope** as defined in:

- `wire2/docs/pose/POSE_ONCHAIN_EVIDENCE_MODEL.md`

Minimum envelope fields (always required):

- `version`, `rail`, `intentRef`, `orgRef`, `sequence`, `eventType`, `createdAt`, `actor.{role,keyId}`, `prevEventHash`, `payloadCommitment`, `eventHash`

Signature requirement (baseline):

- **Org signing key** over `eventHash` (unless otherwise noted)

Anchoring vocabulary:

- **Immediate**: anchor the event on POSE as soon as the event is emitted (async job, but no batching).
- **Batch**: include in Merkle batch; anchor `batchRoot` within the batch SLA.

## Matrix

**Rails shorthand**: `W`=WIRE, `A`=ACH, `C`=CASH, `B`=BTC, `E`=ETH

| Event type | Rails | Minimum payload fields (committed; never raw PII) | Required signatures | Anchor policy | Verifier rules (must check) |
|---|---|---|---|---|---|
| `intent.created` | W,A,C,B,E | `rail`, `amountCommitment`, `currencyCommitment`, `beneficiaryCommitment`, `policyRef` | org | Immediate | on-chain anchor exists; envelope hash-chain starts at seq=0; policyRef present |
| `intent.updated` (if allowed) | W,A,C,B,E | `changedFieldsCommitment`, `bindingHash`, `policyRef` | org + (checker if policy says) | Batch | update does **not** bypass binding/approval rules; verifier confirms update preceded re-approval if required |
| `beneficiary.bound` | W,A,B,E | `beneficiaryCommitment`, `beneficiaryVersionCommitment` | org + maker | Batch | beneficiary commitment matches later execution receipt commitments |
| `beneficiary.changed` | W,A,B,E | `prevBeneficiaryCommitment`, `newBeneficiaryCommitment`, `bindingHash` | org + maker + checker | Immediate | invalidates prior approvals (verifier requires `approval.invalidated` or re-approval events before execution) |
| `beneficiary.locked` | W,A,B,E | `beneficiaryCommitment`, `lockReasonCode` | org + checker | Batch | lock event exists before execution for high-risk policies |
| `custody.policy_applied` | C | `custodyPolicyRef`, `dualControlRequired`, `cooldownPolicyRef` | org + checker | Batch | verifier confirms policy exists before handoff attestations |
| `cash.handoff_attested` | C | `handoffCommitment`, `coarseLocationCommitment`, optional `mediaCommitment` | org + **2 distinct human signers** | Immediate | verify two signer keyIds are distinct; timestamps monotonic; chain integrity |
| `cash.custody_checkpoint` | C | `checkpointCommitment` | org + custodian | Batch | optional unless policy requires; if required, verifier ensures cadence satisfied |
| `cash.deposit_receipt_attested` | C | `depositSlipCommitment`, `depositoryRefCommitment`, `discrepancyCommitment` | org + checker | Immediate | verifier checks discrepancy resolution if non-zero |
| `cash.discrepancy_reported` | C | `discrepancyCommitment`, `reasonCode` | org + checker | Immediate | verifier requires follow-up `cash.discrepancy_resolved` before `SETTLED` |
| `cash.discrepancy_resolved` | C | `resolutionCommitment`, `resolutionCode` | org + checker | Batch | verifier confirms settlement allowed post-resolution |
| `proof.requested` | W,A,C,B,E | `requiredChallengeLevel`, `proofTypeCommitment` | org | Batch | verifier ensures required level matches later `proof.verified` |
| `proof.submitted` | W,A,C,B,E | `proofArtifactCommitment`, `deviceAttestationCommitment` (if any) | org + user/device (if applicable) | Batch | verifier checks proof hash matches stored bundle; no raw voice on-chain |
| `proof.verified` | W,A,C,B,E | `resultCode`, `riskSignalsCommitment` | org | Immediate (for execution gating) | verifier checks verified exists before approvals/execution when policy requires |
| `approval.added` | W,A,C,B,E | `approvalRole` (maker/checker), `approvalOutcome`, `bindingHash` | org + human signer | Immediate for “final approval”, otherwise Batch | verifier checks maker-checker invariants (no self-approval for restricted actions) |
| `approval.invalidated` | W,A,B,E | `reasonCode`, `bindingHash` | org | Batch | verifier requires invalidation before new approvals when binding changes |
| `execution.token_issued` (if used) | W,A,B,E | `approvalTokenHash`, `expiresAtCommitment` | org | Batch | token issuance must occur after approvals; verifier checks token not reused |
| `execution.attempted` | W,A,C,B,E | `executionRefCommitment`, `idempotencyKeyHash`, `attemptNumber` | org | **Immediate** | must exist before any “completed”/“settled”; verifier checks idempotency + monotonic attempt numbers |
| `execution.acknowledged` | W,A | `providerAckCommitment` (trace id hash, etc.) | org | Batch | if ack exists, verifier checks provider artifact inclusion in bundle |
| `execution.completed` | W,A,C,B,E | `receiptCommitment` | org | **Immediate** | verifier checks receipt commitment exists and is consistent with rail-specific receipt rules below |
| `execution.failed` | W,A,C,B,E | `errorCode`, `errorDetailsCommitment` | org | Immediate | verifier confirms failure reason and that settlement did not proceed |
| `settlement.reported` | W,A,C,B,E | `settlementReceiptCommitment`, `finalityRuleRef` | org | Immediate | verifier applies rail-specific finality rules (bank settlement vs chain confirmations vs custody completion) |
| `return.reported` / `reversal.reported` | W,A | `returnReasonCode`, `providerArtifactCommitment` | org | Immediate | verifier checks it occurs after execute; marks final state override |
| `btc.confirmations_reached` | B | `txidCommitment`, `blockRefCommitment`, `confirmations` | org | Batch (except final) | verifier checks confirmations monotonically increase; reorg events if decrease |
| `btc.reorg_detected` | B | `txidCommitment`, `prevBlockRefCommitment`, `newBlockRefCommitment` | org | Immediate | verifier marks “finality lost” until restored |
| `eth.receipt_observed` | E | `txHashCommitment`, `blockRefCommitment`, `statusCommitment`, optional `logInclusionCommitment` | org | Batch | verifier checks receipt matches chain; token transfers require log proof |
| `reconciliation.completed` | W,A | `ledgerProviderMapCommitment`, `exceptionsCommitment` | org | Batch | verifier confirms 100% mapping or explicit exception queue events |
| `evidence.bundle_created` | W,A,C,B,E | `bundleRefCommitment`, `redactionMode`, `chainHeadHashCommitment` | org | Batch | verifier can download bundle (authz-gated) and recompute all hashes |
| `evidence.bundle_downloaded` | W,A,C,B,E | `downloadAuditCommitment` (no identity leakage) | org | Batch | verifier confirms audit trail exists for exports without revealing downloader publicly |

## Rail-specific verifier rules (summary)

### WIRE / ACH

- Verify provider artifacts and reconciliation commitments exist for settlement/returns.
- Settlement may arrive later; verifier must tolerate delayed `settlement.reported` but require it for “final”.

### CASH

- Verify dual-control on `cash.handoff_attested` (two distinct human signers).
- Verify discrepancy resolution exists before `settlement.reported` when discrepancies occur.

### BTC

- Verify tx exists and confirmations meet policy threshold before final `settlement.reported`.
- Reorg events must be present if confirmations regress.

### ETH

- Verify tx receipt exists and status is success before final settlement.
- If ERC-20: verify transfer log inclusion commitment.

## Change control

Any change to:

- event taxonomy
- required payload fields
- signature requirements
- anchor policy
- verifier rules

…is a **breaking change** and must follow `wire2/backend/docs/API_CONTRACTS.md` + `wire2/docs/URL_CONTRACT.md` style discipline (versioning + migration + rollout plan).

