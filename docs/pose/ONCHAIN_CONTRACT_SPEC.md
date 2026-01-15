# On‑Chain Contract Spec (POSE Evidence Registry)

**Owner:** Agent 11  
**Status:** Spec (no implementation in this change-set)

## Contract: `EvidenceRegistry`

Purpose: provide an append-only on-chain anchor for evidence events or batch roots.

## Identifiers

- `intentRef`: `bytes32` (hash identifier; never raw UUID)
- `orgRef`: `bytes32` (hash or DID hash)
- `eventHash`: `bytes32`
- `prevEventHash`: `bytes32` (or zero)
- `payloadCommitment`: `bytes32` (optional if included in eventHash already)

## Storage model

Two possible models:

### A) Strict event anchoring (highest assurance)

Store per-event anchors with monotonic sequence:

- mapping `intentRef => uint64 nextSequence`
- mapping `intentRef => bytes32 lastEventHash`

### B) Batch anchoring (Merkle roots)

Store per-batch roots:

- mapping `batchId => batchRoot`
- mapping `intentRef => (batchId list)` or event-to-batch index

## Functions (recommended minimal API)

- `anchorEvent(intentRef, orgRef, sequence, eventHash, prevEventHash)`
  - requires `sequence == nextSequence(intentRef)`
  - requires `prevEventHash == lastEventHash(intentRef)` (or sequence==0)
  - emits `EventAnchored(...)`

- `anchorBatch(batchId, batchRoot, batchMetaCommitment)`
  - emits `BatchAnchored(...)`

## Events

- `EventAnchored(bytes32 intentRef, bytes32 orgRef, uint64 sequence, bytes32 eventHash, bytes32 prevEventHash)`
- `BatchAnchored(bytes32 batchId, bytes32 batchRoot, bytes32 batchMetaCommitment)`

## Key registry (options)

1) On-chain key registry:
   - `registerKey(orgRef, keyIdHash, pubKey, validFrom, validTo)`
   - `revokeKey(orgRef, keyIdHash, revokedAt)`

2) Off-chain registry with on-chain root:
   - periodic `KeyRegistryRootAnchored(orgRef, merkleRoot, version)`

## Reorg/finality policy (must be documented)

Verifier must define:

- “Anchored” vs “Final”
- required confirmation depth on POSE
- how to handle orphaned anchors

## Security requirements

- idempotency / replay protection for anchor transactions
- per-org authorization (only org anchor key can anchor for orgRef)
- rate limiting / spam resistance

