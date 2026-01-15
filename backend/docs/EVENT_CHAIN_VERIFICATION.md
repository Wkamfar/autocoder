# Event Chain Verification

**Version:** 1.0  
**Last Updated:** 2025-01-01  
**Owner:** Agent C

## Overview

Event chains provide tamper-evident audit logs for wire transfer intents. Each event includes a hash of the previous event, creating an immutable chain. This document describes the verification algorithm.

## Event Chain Structure

Each event in the chain contains:

```typescript
{
  id: string;
  intentId: string;
  seq: number;                    // Sequential number (1, 2, 3, ...)
  eventType: string;              // e.g., "intent.created", "intent.approved"
  payloadCanonicalJson: string;   // Canonical JSON of event payload
  prevHash: string | null;        // Hash of previous event (null for first event)
  eventHash: string;               // Hash of this event
  createdByUserId: string;
  createdAt: Date;
}
```

## Hash Computation

Event hash is computed as:

```typescript
eventHash = sha256(canonicalJsonStringify({
  prevHash: prevHash | null,
  seq: seq,
  eventType: eventType,
  payloadCanonicalJson: payloadCanonicalJson,
  createdByUserId: createdByUserId,
  createdAt: createdAt.toISOString()
}))
```

## Verification Rules

### 1. Sequential Integrity

Events must have sequential `seq` values starting from 1:

- ✅ `seq: 1, 2, 3, 4, ...` (no gaps)
- ❌ `seq: 1, 2, 4, 5, ...` (gap at 3)
- ❌ `seq: 1, 3, 2, 4, ...` (out of order)

### 2. Hash Linkage

Each event (except the first) must link to the previous event:

- First event (`seq === 1`): `prevHash` must be `null`
- Subsequent events: `prevHash` must equal `eventHash` of previous event

Example:
```
Event 1: prevHash=null, eventHash=abc123
Event 2: prevHash=abc123, eventHash=def456  ✅
Event 3: prevHash=def456, eventHash=ghi789  ✅
```

### 3. Hash Recomputation

Each event's `eventHash` must match recomputed hash:

```typescript
recomputedHash = sha256(canonicalJsonStringify({
  prevHash: event.prevHash,
  seq: event.seq,
  eventType: event.eventType,
  payloadCanonicalJson: event.payloadCanonicalJson,
  createdByUserId: event.createdByUserId,
  createdAt: event.createdAt.toISOString()
}))

recomputedHash === event.eventHash  // Must be true
```

If `recomputedHash !== event.eventHash`, the event has been tampered with.

### 4. Timestamp Ordering

Events must have non-decreasing timestamps:

- ✅ `createdAt[1] <= createdAt[2] <= createdAt[3]`
- ❌ `createdAt[2] < createdAt[1]` (out of order)

Note: Equal timestamps are allowed (events created in same millisecond).

## Verification Algorithm

```typescript
async function verifyEventChain(intentId: string): Promise<{
  valid: boolean;
  errors: Array<{ seq: number; error: string }>;
  chainHash: string | null;
  eventCount: number;
}> {
  const events = await listIntentEvents(intentId);
  
  if (events.length === 0) {
    return { valid: true, errors: [], chainHash: null, eventCount: 0 };
  }

  const errors = [];
  let expectedPrevHash = null;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const expectedSeq = i + 1;

    // Check sequential integrity
    if (event.seq !== expectedSeq) {
      errors.push({ seq: event.seq, error: `Sequence gap: expected ${expectedSeq}, got ${event.seq}` });
      continue;
    }

    // Check hash linkage
    if (i === 0) {
      if (event.prevHash !== null) {
        errors.push({ seq: event.seq, error: `First event must have null prevHash` });
      }
    } else {
      if (event.prevHash !== expectedPrevHash) {
        errors.push({ seq: event.seq, error: `Hash linkage broken: expected ${expectedPrevHash}, got ${event.prevHash}` });
      }
    }

    // Recompute hash
    const recomputedHash = sha256(canonicalJsonStringify({
      prevHash: event.prevHash,
      seq: event.seq,
      eventType: event.eventType,
      payloadCanonicalJson: event.payloadCanonicalJson,
      createdByUserId: event.createdByUserId,
      createdAt: event.createdAt.toISOString()
    }));

    if (recomputedHash !== event.eventHash) {
      errors.push({ seq: event.seq, error: `Hash mismatch: stored ${event.eventHash}, recomputed ${recomputedHash}` });
    }

    // Check timestamp ordering
    if (i > 0 && event.createdAt < events[i - 1].createdAt) {
      errors.push({ seq: event.seq, error: `Timestamp out of order` });
    }

    expectedPrevHash = event.eventHash;
  }

  return {
    valid: errors.length === 0,
    errors,
    chainHash: events.length > 0 ? events[events.length - 1].eventHash : null,
    eventCount: events.length
  };
}
```

## Tamper Detection

The verification algorithm detects:

1. **Modified Events**: Hash recomputation fails
2. **Deleted Events**: Sequential integrity check fails
3. **Reordered Events**: Hash linkage check fails
4. **Inserted Events**: Sequential integrity or hash linkage fails
5. **Modified Payloads**: Hash recomputation fails (payload is part of hash)

## API Endpoint

### Verify Event Chain

```http
GET /api/wire/intents/{id}/events/verify
Authorization: Bearer {token}
```

**Response (Valid Chain):**
```json
{
  "valid": true,
  "errors": [],
  "chainHash": "abc123def456...",
  "eventCount": 5
}
```

**Response (Invalid Chain):**
```json
{
  "valid": false,
  "errors": [
    {
      "seq": 3,
      "error": "Hash mismatch: stored xyz789, recomputed abc123"
    }
  ],
  "chainHash": "abc123def456...",
  "eventCount": 5
}
```

## Usage Examples

### Verify Intent Event Chain

```typescript
import { verifyEventChain } from "./modules/evidence/eventChain.js";

const result = await verifyEventChain("intent_123");

if (result.valid) {
  console.log(`Chain is valid. Final hash: ${result.chainHash}`);
} else {
  console.error("Chain verification failed:");
  result.errors.forEach(err => {
    console.error(`  Event ${err.seq}: ${err.error}`);
  });
}
```

### Verify Bundle Event Chain

When verifying a bundle:

1. Extract `events.jsonl` from bundle
2. Parse JSONL (one JSON per line)
3. Call `verifyEventChain()` with parsed events
4. Check `result.valid`

## Performance Considerations

- **Time Complexity**: O(n) where n = number of events
- **Space Complexity**: O(n) for loading all events
- **Optimization**: For large chains, consider:
  - Paginated verification (verify in chunks)
  - Cached verification results
  - Incremental verification (only verify new events)

## Future Enhancements

### Signed Checkpoints

Add checkpoint events every N events:

```typescript
{
  eventType: "checkpoint",
  payload: {
    lastSeq: 100,
    lastEventHash: "abc123...",
    intentId: "intent_123",
    checkpointSignature: "ed25519_signature"
  }
}
```

**Benefits:**
- Faster verification (verify from last checkpoint)
- External anchoring (store checkpoint hash in blockchain/immutable log)
- Tamper detection even if DB is compromised

### External Anchoring

Store checkpoint hashes in external systems:
- Blockchain (Ethereum, Bitcoin)
- Immutable logs (Certificate Transparency logs)
- Distributed ledgers

**Benefits:**
- Tamper detection even if entire DB is compromised
- Proof of existence at specific time
- Cross-system verification

## Implementation

- **Verification Function**: `wire2/backend/src/modules/evidence/eventChain.ts` (`verifyEventChain`)
- **API Endpoint**: `wire2/backend/src/routes/wire.ts` (`GET /intents/:id/events/verify`)
- **Tests**: `wire2/backend/src/modules/evidence/__tests__/eventChain.test.ts` (to be created)

## Related Documentation

- [Canonical JSON Specification](./CANONICAL_JSON_SPEC.md)
- [Bundle Format Specification](./BUNDLE_FORMAT.md)
- [Signing Key Management](./SIGNING_KEY_MANAGEMENT.md)
