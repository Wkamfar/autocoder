# POSE On‑Chain Evidence Model (Wire2)

**Owner:** Agent 11  
**Status:** Spec (no implementation in this change-set)  
**Goal:** define a privacy-safe, verifiable, append-only evidence system where POSE is the immutable anchor.

## Principles

- **Commit, don’t reveal**: on-chain stores commitments, not raw payloads.
- **Canonicalization first**: same input → same hash, always.
- **Append-only**: proofs cannot be removed or reordered without detection.
- **Key rotation compatible**: revoked keys remain verifiable for history.

## Core objects

### 1) Evidence envelope (canonical JSON)

This is the object hashed and signed.

Required fields:

- `version` (integer)
- `rail` (`WIRE`/`ACH`/`CASH`/`BTC`/`ETH`)
- `intentRef` (string; recommended: hash of internal intent id + org id)
- `orgRef` (string; recommended: hash or DID)
- `sequence` (integer; monotonic per intentRef)
- `eventType` (string enum; see roadmap Agent 11)
- `createdAt` (RFC3339)
- `actor`:
  - `role` (`MAKER`/`CHECKER`/`SYSTEM`/`PROVIDER`/`AUDITOR`)
  - `keyId` (string; points to key registry)
- `prevEventHash` (string|null)
- `payloadCommitment` (string; hash of payload or payload merkle root)
- `eventHash` (string; hash of the envelope without signatures)

Optional fields (recommended):

- `requestId` / `correlationId` (strings; off-chain only by default; can be committed but not revealed)
- `policyRef` (hash of policy version)
- `bundleRef` (content-addressed pointer commitment)

### 2) Payload (off-chain)

Stored off-chain in an evidence bundle (full or redacted). On-chain commitment is:

- `payloadCommitment = sha256(canonical_json(payload))`

For large payloads:

- `payloadCommitment = merkle_root([sha256(chunk_i)])`

### 3) Signature set (off-chain, optionally also committed)

Minimum signatures:

- **Org signing key**: signs `eventHash`

Optional:

- user/device keys, co-signer keys, provider attestation keys

Signature object:

- `sigVersion`
- `alg` (`ed25519`, etc.)
- `keyId`
- `signature` (bytes/base64)

## Hash chain vs Merkle chain

### Hash chain (simpler)

- Each envelope includes `prevEventHash`
- `eventHash` links to previous event
- On-chain anchors store `(intentRef, sequence, eventHash, prevEventHash)`

### Merkle batching (cost optimized)

- Events produced off-chain
- Build a Merkle tree per batch
- On-chain anchors store `(batchRoot, batchId, batchMetaCommitment)`
- Verifier uses inclusion proofs for each event

## Privacy constraints (non-negotiable)

Do not place on chain:

- PII (names/emails/addresses)
- bank tokens, account numbers, routing numbers
- raw amounts if they can be linked to identities (commit only)
- raw voice artifacts or embeddings

## Verification algorithm (high level)

Given a `publicReceipt` (intentRef + optionally an eventHash or bundle pointer):

1. Fetch on-chain anchors for intentRef (or batch root)
2. Verify ordering (sequence or hash chain)
3. Fetch off-chain bundle (redacted/full)
4. Recompute event hashes and payload commitments
5. Verify signatures using key registry + revocation data
6. Confirm all event hashes match on-chain anchors

## Open questions (must be decided)

- Batch policy (strict vs merkle)
- Finality rule (how many confirmations on POSE before “anchored” is final)
- Key registry location (on-chain registry vs signed off-chain registry anchored on-chain)

