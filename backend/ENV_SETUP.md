# Environment Variable Setup

This document describes all required and optional environment variables for the WIRE2 backend.

## Required Variables

### Database
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/wire2
```

## Critical Variables (Required for Production)

### Signing Keys (Agent C)
These are required for audit bundle generation. Without them, bundle creation will fail.

```bash
# Generate keys using Node.js crypto:
# node -e "const {generateEd25519KeyPair} = require('./dist/lib/signing.js'); console.log(JSON.stringify(generateEd25519KeyPair(), null, 2))"

# Or use OpenSSL:
# openssl genpkey -algorithm Ed25519 -outform DER | base64url

SIGNING_PRIVATE_KEY=base64url_encoded_64_byte_private_key
SIGNING_PUBLIC_KEY=base64url_encoded_32_byte_public_key
SIGNING_KEY_ID=dev_key_1
```

**Key Generation:**
1. Generate Ed25519 key pair
2. Encode private key (64 bytes) as base64url → `SIGNING_PRIVATE_KEY`
3. Encode public key (32 bytes) as base64url → `SIGNING_PUBLIC_KEY`

**Note:** In production, use KMS (AWS KMS, GCP KMS, or HashiCorp Vault) instead of env vars.

## Optional Variables

### Authentication (Agent B)
```bash
# Demo mode (default if not set)
AUTH_MODE=demo

# OIDC mode (for production)
AUTH_MODE=oidc
OIDC_ISSUER=https://your-oidc-provider.com
OIDC_CLIENT_ID=your_client_id
OIDC_CLIENT_SECRET=your_client_secret
OIDC_REDIRECT_URI=http://localhost:3000/auth/callback
OIDC_SCOPES=openid,profile,email
```

### Storage (Agent C)
```bash
# Local filesystem (default)
STORAGE_TYPE=local

# AWS S3
STORAGE_TYPE=s3
STORAGE_BUCKET=wire-bundles-prod
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Google Cloud Storage
STORAGE_TYPE=gcs
STORAGE_BUCKET=wire-bundles-prod
GCP_PROJECT_ID=your_project_id
GCP_KEY_FILE=/path/to/service-account-key.json
```

### Server Configuration
```bash
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
```

### Rate Limiting (Agent B)
```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Logging
```bash
LOG_LEVEL=info
```

## Example .env File

Create a `.env` file in `wire2/backend/`:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wire2

# Signing Keys (generate these!)
SIGNING_PRIVATE_KEY=your_64_byte_base64url_private_key
SIGNING_PUBLIC_KEY=your_32_byte_base64url_public_key
SIGNING_KEY_ID=dev_key_1

# Storage
STORAGE_TYPE=local

# Server
PORT=3000
NODE_ENV=development
```

## Validation

The server validates environment variables on startup:
- Missing `DATABASE_URL` → Server exits with error
- Missing signing keys → Warning (bundle generation will fail)
- Invalid signing key format → Server exits with error

## Production Recommendations

1. **Never commit `.env` files** - Use secrets management (AWS Secrets Manager, GCP Secret Manager, etc.)
2. **Use KMS for signing keys** - Don't store private keys in env vars in production
3. **Use managed databases** - Don't hardcode database credentials
4. **Enable OIDC** - Set `AUTH_MODE=oidc` for production
5. **Use S3/GCS** - Set `STORAGE_TYPE=s3` or `STORAGE_TYPE=gcs` for production
