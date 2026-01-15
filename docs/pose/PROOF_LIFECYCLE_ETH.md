# Proof Lifecycle (ETH)

**Owner:** Agent 12  
**Status:** Spec (no implementation in this change-set)

## Inputs

- `chainId`
- `to` (address)
- `valueWei` (or token transfer fields)
- Optional: `tokenContract`, `tokenAmount`, `tokenDecimals`

## Checkpoints

### 0) Intent created

- Event: `intent.created` (rail=ETH)
- Commit: `(chainId, to, valueWei)` hashed (or token fields)

### 1) Beneficiary binding / address policy

- Event: `beneficiary.bound`
- Commit: `(to, chainId)` commitment + policyRef

### 2) Approval / proof steps

- Same maker-checker and step-up proof events as required

### 3) Broadcast

- Event: `execution.attempted`
- Commit: `txHash` (hash) + nonce commitment (optional)

### 4) Receipt

- Event: `execution.completed` / `execution.failed`
- Commit:
  - `status`, `blockNumber`, `gasUsed` commitments
  - For ERC-20: commit transfer log inclusion (topic hash + logIndex)

### 5) Finality

- Event: `settlement.reported`
- Commit: confirmation count / finality indicator based on chain policy

### 6) Reorg handling

- Similar to BTC: detect and explicitly report finality loss/restoration if applicable

## Verification

Verifier must:

- fetch tx receipt and validate committed fields
- validate confirmation/finality rule for the chainId
- validate log-based token transfer matches committed intent (if token)

## Edge cases

- Token transfers vs native ETH
- Contract interactions where value is 0 but logs matter
- L2 finality nuances (document per chainId)

