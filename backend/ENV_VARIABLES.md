# WIRE2 Backend Environment Variables

## Required Variables

### Database
- `DATABASE_URL` - PostgreSQL connection string
  - Example: `postgresql://user:password@localhost:5432/wire2?schema=public`
  - Required: Yes

### Authentication
- `AUTH_MODE` - Authentication mode (`demo` or `oidc`)
  - Default: `demo`
  - Required: No (defaults to demo mode)

#### Feature flags (safe rollout)
- `OIDC_ENABLED` - Enable OIDC endpoints (`/api/auth/oidc/*`) even if `AUTH_MODE` is not `oidc`
  - Values: `true`/`false` or `1`/`0`
  - Default: `false` (unless `AUTH_MODE=oidc`)
- `SSO_ENFORCEMENT_ENABLED` - Enforce `OrgSsoConfig.enforced` on password login
  - Values: `true`/`false` or `1`/`0`
  - Default: `false` (unless `AUTH_MODE=oidc`)

Recommended safe rollout:
- Start with `OIDC_ENABLED=true` (pilot SSO without breaking password/demo flows)
- Then set `OrgSsoConfig.enforced=true` per org
- Then flip `SSO_ENFORCEMENT_ENABLED=true` in the target environment

### OIDC Configuration (if AUTH_MODE=oidc)
- `OIDC_ISSUER` - OIDC issuer URL
- `OIDC_CLIENT_ID` - OIDC client ID
- `OIDC_CLIENT_SECRET` - OIDC client secret

## Optional Variables

### Redis
- `REDIS_URL` - Redis connection string
  - Example: `redis://localhost:6379`
  - Default: Not configured (Redis features disabled)
  - Required: No

### POSE V2 Voice Service
- `POSE_V2_SERVICE_URL` - POSE V2 voice identification service URL
  - Example: `http://localhost:8000`
  - Default: `http://localhost:8000`
  - Required: No

- `POSE_V2_ENABLED` - Enable POSE V2 voice verification
  - Values: `true` or `false`
  - Default: `true`
  - Required: No

### Server Configuration
- `PORT` - Server port
  - Default: `8000`
  - Required: No

- `NODE_ENV` - Node environment
  - Values: `development`, `production`, `test`
  - Default: `development`
  - Required: No

- `HOST` - Server host
  - Default: `0.0.0.0`
  - Required: No

### CORS
- `CORS_ORIGIN` - CORS allowed origin
  - Default: `true` (allows all) in demo mode, `false` (no CORS) in production
  - Required: No

### Signing Keys (for audit bundles)
- `SIGNING_PRIVATE_KEY` - Ed25519 private key (base64url encoded)
  - Required: Yes for production (bundle generation)
  - Default: Not set (bundle generation will fail)

- `SIGNING_PUBLIC_KEY` - Ed25519 public key (base64url encoded)
  - Required: Yes for production
  - Default: Not set

- `SIGNING_KEY_ID` - Signing key identifier
  - Default: `dev_key_1`
  - Required: No

### Secrets Encryption (recommended)

- `WIRE2_SECRETS_ENCRYPTION_KEY` - AES-256-GCM key for encrypting application secrets at rest (base64url, 32 bytes)
  - Used for: webhook signing secrets (`Webhook.secretEncrypted`)
  - Required: No (but strongly recommended; in production webhook creation/rotation requires it)

### API key hardening (optional)

- `WIRE2_REQUIRE_API_KEY_SECRET` - Require API key *secret* (Basic auth) for API key authentication
  - Values: `true` / `false`
  - Default: `false`
  - When `true`, `Authorization: ApiKey <key>` and `X-API-KEY` are rejected; clients must use Basic auth.

### Application Version
- `APP_VERSION` - Application version string
  - Default: `0.1.0`
  - Required: No

## Example .env File

```bash
# Database
DATABASE_URL=postgresql://wire2_user:wire2_password@localhost:5432/wire2?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
AUTH_MODE=demo
OIDC_ENABLED=false
SSO_ENFORCEMENT_ENABLED=false

# POSE V2 Voice Service
POSE_V2_SERVICE_URL=http://localhost:8000
POSE_V2_ENABLED=true

# Server
PORT=8000
NODE_ENV=development
HOST=0.0.0.0

# Signing Keys (generate with: openssl genpkey -algorithm Ed25519 -out private.pem)
SIGNING_PRIVATE_KEY=your_base64url_private_key
SIGNING_PUBLIC_KEY=your_base64url_public_key
SIGNING_KEY_ID=dev_key_1

# Secrets encryption (32 bytes base64url)
WIRE2_SECRETS_ENCRYPTION_KEY=your_base64url_32byte_key

# API key hardening
WIRE2_REQUIRE_API_KEY_SECRET=false

### Sandbox (development/testing only)

- `SANDBOX_MODE` - Enable sandbox-only endpoints under `/api/sandbox/*`
  - Default: `false`
  - In production, sandbox endpoints are hard-disabled.
- `SANDBOX_ADMIN_TOKEN` - Optional shared secret required in `X-SANDBOX-ADMIN` header for sandbox mutations
  - Default: unset (no header required)
  - Recommended to set in any shared environment.

# Application
APP_VERSION=1.0.0
```

## Production Checklist

- [ ] Set `AUTH_MODE=oidc` and configure OIDC variables
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ORIGIN` to specific frontend URL
- [ ] Set `POSE_V2_SERVICE_URL` to production POSE V2 service
- [ ] Configure `SIGNING_PRIVATE_KEY` and `SIGNING_PUBLIC_KEY` (use KMS in production)
- [ ] Set `REDIS_URL` to production Redis instance
- [ ] Use secure `DATABASE_URL` with SSL
