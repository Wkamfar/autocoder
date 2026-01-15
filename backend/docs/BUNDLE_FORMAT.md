# Audit Bundle Format Specification

**Version:** 1.0  
**Last Updated:** 2025-01-01  
**Owner:** Agent C

## Overview

Audit bundles are ZIP archives containing all evidence and metadata for a wire transfer intent. Bundles are cryptographically signed and stored in object storage (S3/local filesystem).

## Archive Structure

```
bundle_{intentId}_{timestamp}.zip
├── manifest.json          # Canonical JSON of all bundle data
├── manifest.sig           # Base64url-encoded Ed25519 signature
├── metadata.json          # Bundle metadata (version, timestamps, etc.)
├── events.jsonl          # Event chain (one JSON per line, ordered by seq)
├── challenges/           # Voice challenges (if any)
│   └── {challengeId}.json
└── proofs/               # Voice proofs (if any)
    └── {proofId}.json
```

## File Descriptions

### manifest.json

Canonical JSON containing all bundle data:

```json
{
  "intent": { ... },
  "beneficiary": { ... },
  "challenges": [ ... ],
  "proofs": [ ... ],
  "decisions": [ ... ],
  "events": [ ... ],
  "policy": { ... }
}
```

- **Format**: Canonical JSON (no whitespace, sorted keys)
- **Purpose**: Complete audit trail of intent lifecycle
- **Hash**: SHA-256 hash of this file is stored as `bundleHash` in DB

### manifest.sig

Ed25519 signature of `manifest.json`:

- **Format**: Base64url-encoded signature (86 characters)
- **Algorithm**: Ed25519
- **Signer**: Identified by `signerKeyId` in metadata.json
- **Verification**: `verifyEd25519(manifest.json, manifest.sig, publicKey)`

### metadata.json

Bundle metadata:

```json
{
  "bundleId": "bundle_intent_123_1704067200000",
  "intentId": "intent_123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "signerKeyId": "dev_key_1",
  "version": "1.0",
  "mode": "full"
}
```

- **bundleId**: Unique bundle identifier
- **intentId**: Associated intent ID
- **createdAt**: Bundle creation timestamp (ISO 8601)
- **signerKeyId**: Key ID used for signing
- **version**: Bundle format version
- **mode**: `"full"` or `"redacted"`

### events.jsonl

Event chain in JSONL format (one JSON object per line):

```
{"seq":1,"eventType":"intent.created","payloadCanonicalJson":"...","eventHash":"..."}
{"seq":2,"eventType":"intent.approved","payloadCanonicalJson":"...","eventHash":"..."}
{"seq":3,"eventType":"bundle.created","payloadCanonicalJson":"...","eventHash":"..."}
```

- **Format**: JSON Lines (one JSON per line, no trailing comma)
- **Ordering**: Ordered by `seq` (ascending)
- **Purpose**: Immutable event log for tamper detection

### challenges/

Directory containing voice challenge records:

- **Format**: One JSON file per challenge
- **Filename**: `{challengeId}.json`
- **Content**: Challenge data (may be redacted in redacted mode)

### proofs/

Directory containing voice proof records:

- **Format**: One JSON file per proof
- **Filename**: `{proofId}.json`
- **Content**: Proof data (may be redacted in redacted mode)

## Redaction Modes

### Full Export (`mode: "full"`)

All data included:
- Intent details
- Beneficiary information (including account numbers)
- Challenge audio and transcripts
- Proof audio and transcripts
- All events and decisions

### Redacted Export (`mode: "redacted"`)

PII and sensitive data redacted:
- Beneficiary account numbers → `"***REDACTED***"`
- Beneficiary names → `"***REDACTED***"`
- Challenge audio → `"***REDACTED***"`
- Proof transcripts → `"***REDACTED***"`
- Other PII fields → `"***REDACTED***"`

**Use Cases:**
- External audits
- Regulatory compliance (GDPR right to be forgotten)
- Sharing with third parties

## Bundle Generation

### Request

```http
POST /api/wire/intents/{id}/bundle?mode=full
Authorization: Bearer {token}
```

Query parameters:
- `mode`: `"full"` or `"redacted"` (default: `"full"`)

### Response

```json
{
  "id": "bundle_intent_123_1704067200000",
  "intentId": "intent_123",
  "bundleHash": "sha256_hash_of_manifest",
  "manifestCanonicalJson": "...",
  "manifestSignature": "base64url_signature",
  "signerKeyId": "dev_key_1",
  "storageRef": "s3://bucket/bundles/bundle_123.zip",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

## Bundle Storage

### Storage Backends

1. **LocalFileStorage** (dev): `./storage/bundles/{bundleId}.zip`
2. **S3Storage** (prod): `s3://{bucket}/bundles/{bundleId}.zip`

### Storage Metadata

Stored as object metadata:
- `Content-Type`: `application/zip`
- `X-Bundle-Hash`: SHA-256 hash of manifest
- `X-Signer-Key-Id`: Key ID used for signing

## Bundle Verification

### Verify Signature

```http
GET /api/wire/bundles/{id}/verify
Authorization: Bearer {token}
```

Response:
```json
{
  "valid": true,
  "signerKeyId": "dev_key_1"
}
```

Or if invalid:
```json
{
  "valid": false,
  "error": "Signature verification failed",
  "signerKeyId": "dev_key_1"
}
```

### Download Bundle

```http
GET /api/wire/bundles/{id}/download?expiresIn=3600
Authorization: Bearer {token}
```

Response:
```json
{
  "url": "https://s3.amazonaws.com/bucket/bundles/bundle_123.zip?X-Amz-Signature=...",
  "expiresIn": 3600,
  "bundleId": "bundle_intent_123_1704067200000",
  "intentId": "intent_123"
}
```

## Bundle Integrity

### Hash Verification

1. Extract `manifest.json` from bundle
2. Compute SHA-256 hash: `hash = sha256(manifest.json)`
3. Compare with `bundleHash` from DB: `hash === bundle.bundleHash`

### Signature Verification

1. Extract `manifest.json` and `manifest.sig` from bundle
2. Read `signerKeyId` from `metadata.json`
3. Look up public key by `signerKeyId`
4. Verify: `verifyEd25519(manifest.json, manifest.sig, publicKey)`

### Event Chain Verification

1. Extract `events.jsonl` from bundle
2. Parse JSONL (one JSON per line)
3. Verify event chain using `verifyEventChain()` function
4. Check sequential integrity, hash linkage, recomputation

## Implementation

- **Archive Creation**: `wire2/backend/src/modules/evidence/bundleArchive.ts`
- **Storage**: `wire2/backend/src/lib/storage/`
- **Bundle Generation**: `wire2/backend/src/modules/intents/intentService.ts`
- **Verification**: `wire2/backend/src/modules/evidence/bundleVerification.ts`

## Version History

- **v1.0** (2025-01-01): Initial specification
  - ZIP archive format
  - Canonical JSON manifest
  - Ed25519 signatures
  - Full/redacted modes

## Future Enhancements

- [ ] Bundle compression levels (store, fast, best)
- [ ] Incremental bundles (only new events since last bundle)
- [ ] Bundle encryption (for additional security)
- [ ] Bundle streaming (for large bundles)
- [ ] Bundle format versioning (backward compatibility)
