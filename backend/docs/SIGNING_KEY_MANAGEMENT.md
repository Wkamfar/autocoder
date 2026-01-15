# Signing Key Management

**Version:** 1.0  
**Last Updated:** 2025-01-01  
**Owner:** Agent C

## Overview

This document describes the key management strategy for Ed25519 signing keys used to sign audit bundle manifests.

## Signing Algorithm

- **Algorithm**: Ed25519 (Edwards-curve Digital Signature Algorithm)
- **Key Size**: 32 bytes public key, 64 bytes private key
- **Signature Size**: 64 bytes (86 characters base64url-encoded)
- **Performance**: Fast signing and verification, small signatures

## Development Mode

### Key Generation

Generate a key pair:

```bash
# Using Node.js crypto (one-liner)
node -e "const {generateKeyPairSync} = require('crypto'); const {publicKey, privateKey} = generateKeyPairSync('ed25519', {publicKeyEncoding: {type: 'spki', format: 'pem'}, privateKeyEncoding: {type: 'pkcs8', format: 'pem'}}); console.log('PUBLIC:', Buffer.from(publicKey.replace(/-----BEGIN PUBLIC KEY-----/, '').replace(/-----END PUBLIC KEY-----/, '').replace(/\s/g, ''), 'base64').slice(-32).toString('base64url')); console.log('PRIVATE:', Buffer.from(privateKey.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, ''), 'base64').slice(-64).toString('base64url'));"
```

Or use a proper key generation script (see below).

### Environment Variables

Set in `.env`:

```bash
# Development signing keys (base64url-encoded)
SIGNING_PRIVATE_KEY=<64-byte-private-key-base64url>
SIGNING_PUBLIC_KEY=<32-byte-public-key-base64url>
SIGNING_KEY_ID=dev_key_1
```

### Key Storage

- **Private key**: Stored in environment variable (never in code or DB)
- **Public key**: Stored in environment variable (for verification)
- **Key ID**: `dev_key_1` (hardcoded for dev mode)

## Production Mode

### Phase 1: KMS Integration (Recommended)

Use AWS KMS, GCP KMS, or HashiCorp Vault for key management.

#### AWS KMS

```bash
# Environment variables
SIGNING_KEY_ID=kms:aws:us-east-1:key/abc123
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

**Implementation Notes:**
- Use KMS `Sign` API for signing (private key never leaves KMS)
- Store public key in config/DB or fetch from KMS
- Key rotation: Create new key, update `SIGNING_KEY_ID`, old keys remain valid for historical bundles

#### GCP KMS

```bash
SIGNING_KEY_ID=gcp:projects/my-project/locations/us-east1/keyRings/my-ring/cryptoKeys/my-key
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

#### HashiCorp Vault

```bash
SIGNING_KEY_ID=vault:signing:v1
VAULT_ADDR=https://vault.example.com
VAULT_TOKEN=...
```

### Phase 2: Key Rotation

Support multiple active keys:

1. **New key creation**: Generate new key in KMS
2. **Key ID mapping**: Store `keyId → publicKey` mapping in config/DB
3. **Bundle signing**: Use latest key ID
4. **Bundle verification**: Look up public key by `signerKeyId` from bundle
5. **Old key retention**: Keep old keys active for historical bundle verification

### Phase 3: HSM (Highest Security)

For maximum security, use Hardware Security Module (HSM):

- AWS CloudHSM
- Azure Dedicated HSM
- On-premise HSM (e.g., Thales, Utimaco)

**Benefits:**
- Private key material never leaves HSM
- FIPS 140-2 Level 3+ compliance
- Tamper-resistant hardware

## Key Generation Script

Create `scripts/generate-signing-key.ts`:

```typescript
import { generateKeyPairSync } from "crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

// Extract raw bytes
const publicKeyRaw = Buffer.from(
  publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s/g, ""),
  "base64"
).slice(-32);

const privateKeyRaw = Buffer.from(
  privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, ""),
  "base64"
).slice(-64);

console.log("SIGNING_PUBLIC_KEY=" + publicKeyRaw.toString("base64url"));
console.log("SIGNING_PRIVATE_KEY=" + privateKeyRaw.toString("base64url"));
```

Run:
```bash
tsx scripts/generate-signing-key.ts
```

## Key Storage Best Practices

### ✅ DO

- Store private keys in secure key management systems (KMS/HSM)
- Use environment variables for dev keys (never commit to git)
- Rotate keys periodically (annually or per security policy)
- Store public keys in config/DB for verification
- Include `signerKeyId` in bundles for key lookup

### ❌ DON'T

- Never commit private keys to version control
- Never store private keys in database
- Never log private keys
- Never transmit private keys over unencrypted channels
- Never use same key across environments (dev/staging/prod)

## Bundle Signing Flow

1. Generate bundle manifest (canonical JSON)
2. Get signing key from KMS/env
3. Sign manifest: `signature = signEd25519(manifestCanonicalJson, privateKey)`
4. Store bundle with `manifestSignature` and `signerKeyId`

## Bundle Verification Flow

1. Retrieve bundle from DB/storage
2. Look up public key by `signerKeyId`
3. Verify signature: `verifyEd25519(manifestCanonicalJson, signature, publicKey)`
4. Return verification result

## Implementation Files

- **Signing**: `wire2/backend/src/lib/signing.ts`
- **Key Management**: `wire2/backend/src/lib/keyManagement.ts`
- **Bundle Signing**: `wire2/backend/src/modules/intents/intentService.ts` (generateAuditBundle)
- **Bundle Verification**: `wire2/backend/src/modules/evidence/bundleVerification.ts`

## Security Considerations

1. **Key Compromise**: If private key is compromised, rotate immediately and re-sign critical bundles
2. **Key Loss**: If private key is lost, historical bundles cannot be re-signed (but can still be verified with old public key)
3. **Key Rotation**: Plan for key rotation without breaking historical bundle verification
4. **Access Control**: Limit access to signing keys (use IAM roles, Vault policies, etc.)

## Compliance

- **SOC 2**: Key management controls
- **PCI DSS**: Cryptographic key management (Requirement 3.5)
- **GDPR**: Data integrity and authenticity

## Future Enhancements

- [ ] KMS integration (AWS/GCP/Vault)
- [ ] Key rotation automation
- [ ] HSM support
- [ ] Key escrow/recovery
- [ ] Audit logging of key usage
