# 🔐 Security Module — Agent B

> **Production-grade authentication, authorization, and security controls**

## Overview

This module provides enterprise-ready authentication and authorization for the WIRE2 backend. It supports both demo mode (for development) and OIDC mode (for production), with comprehensive security controls.

## Architecture

```
security/
├── config.ts              # Environment configuration (AUTH_MODE, OIDC, rate limits)
├── auth.ts                # Main auth plugin (demo + OIDC modes)
├── session.ts             # Session lifecycle management
├── oidc.ts                # OIDC integration + CSRF protection
├── rbac.ts                # Role-based access control
├── rateLimit.ts           # Multi-layer rate limiting
├── audit.ts               # Comprehensive audit logging
└── sessionCleanup.ts      # Automated cleanup utilities
```

## Quick Start

### Demo Mode (Development)

```bash
AUTH_MODE=demo npm run dev
```

Use `X-USER-ID` header:
```bash
curl -H "X-USER-ID: user_123" http://localhost:8000/api/wire/intents
```

### OIDC Mode (Production)

```bash
AUTH_MODE=oidc \
OIDC_ISSUER=https://accounts.google.com \
OIDC_CLIENT_ID=your-client-id \
OIDC_CLIENT_SECRET=your-secret \
npm run dev
```

Use Bearer token:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/wire/intents
```

## Features

### ✅ Authentication
- Dual-mode support (demo/OIDC)
- Session lifecycle management
- Token refresh with rotation
- Session revocation (single + bulk)

### ✅ Authorization
- Role-based access control (RBAC)
- Permission-based authorization
- Maker-checker enforcement
- Identity-bound security

### ✅ Security
- Cryptographically secure tokens
- CSRF protection (OIDC state)
- Rate limiting (multi-layer)
- Secure headers
- Input validation

### ✅ Operations
- Comprehensive audit logging
- Session cleanup utilities
- Health check support
- Error handling

## Usage Examples

### Require Permission

```typescript
import { requirePermission } from "./modules/security/auth.js";

app.post(
  "/intents",
  { preHandler: requirePermission("intent:create") },
  async (req, reply) => {
    // Only users with "intent:create" permission can access
  }
);
```

### Require Role

```typescript
import { requireRole } from "./modules/security/auth.js";

app.post(
  "/admin/users",
  { preHandler: requireRole("ADMIN") },
  async (req, reply) => {
    // Only ADMIN role can access
  }
);
```

### Maker-Checker Enforcement

```typescript
import { enforceMakerChecker } from "./modules/security/auth.js";

const result = await enforceMakerChecker(orgId, userId, intentId, "APPROVE");
if (!result.allowed) {
  throw new Error(result.reason);
}
```

### Session Management

```typescript
import { createSession, refreshSession, revokeSession } from "./modules/security/session.js";

// Create session
const { sessionId, accessToken, refreshToken } = await createSession({
  userId: "user_123",
  orgId: "org_456",
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"],
});

// Refresh session
const newSession = await refreshSession({ refreshToken });

// Revoke session
await revokeSession(sessionId, userId);
```

### Audit Logging

```typescript
import { logAuthEvent } from "./modules/security/audit.js";

await logAuthEvent({
  userId: "user_123",
  orgId: "org_456",
  eventType: "permission_denied",
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"],
  details: { permission: "intent:create" },
});
```

## Configuration

### Environment Variables

```bash
# Authentication mode
AUTH_MODE=demo|oidc  # Default: demo

# OIDC Configuration (required if AUTH_MODE=oidc)
OIDC_ISSUER=https://accounts.google.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-secret
OIDC_REDIRECT_URI=http://localhost:8000/api/auth/callback
OIDC_SCOPES=openid email profile

# CORS (production)
CORS_ORIGIN=https://your-frontend.com

# JWT Secret (for token signing)
JWT_SECRET=your-secret-key
```

### Rate Limiting Configuration

Edit `config.ts` to customize rate limits:

```typescript
export const RATE_LIMIT_CONFIG = {
  global: { windowMs: 15 * 60 * 1000, max: 100 },
  authenticated: { windowMs: 15 * 60 * 1000, max: 1000 },
  login: { windowMs: 15 * 60 * 1000, max: 5 },
  challenge: { windowMs: 60 * 1000, max: 3 },
};
```

## Database Schema

### Session Table
- Tracks active sessions
- Token hashes (never plaintext)
- Expiration and revocation
- Activity tracking

### AuthAuditLog Table
- Comprehensive audit trail
- Indexed for performance
- Extensible JSON details

See `prisma/schema.prisma` for full schema.

## Security Best Practices

1. **Never store plaintext tokens** — Only hashes in database
2. **Use HTTPS in production** — HSTS header enforced
3. **Rotate refresh tokens** — After 12 hours (configurable)
4. **Validate all inputs** — Length limits, sanitization
5. **Log all auth events** — For compliance and debugging
6. **Clean up expired sessions** — Run cleanup utility regularly

## Maintenance

### Session Cleanup

Run periodically (e.g., daily cron):

```typescript
import { cleanupExpiredSessions } from "./modules/security/sessionCleanup.js";

const { deleted, errors } = await cleanupExpiredSessions();
console.log(`Cleaned up ${deleted} expired sessions`);
```

### Audit Log Retention

Optional cleanup of old audit logs:

```typescript
import { cleanupOldAuditLogs } from "./modules/security/sessionCleanup.js";

const { deleted } = await cleanupOldAuditLogs(90); // 90 days retention
```

## Testing

### Demo Mode Testing

```bash
# Set demo mode
export AUTH_MODE=demo

# Test with X-USER-ID header
curl -H "X-USER-ID: user_123" http://localhost:8000/api/wire/intents
```

### OIDC Mode Testing

```bash
# Set OIDC mode
export AUTH_MODE=oidc
export OIDC_CLIENT_ID=test-client
export OIDC_CLIENT_SECRET=test-secret

# Get authorization URL
curl http://localhost:8000/api/auth/oidc/authorize

# Login (after OIDC callback)
curl -X POST http://localhost:8000/api/auth/demo/login \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_123"}'

# Use access token
curl -H "Authorization: Bearer <access-token>" \
  http://localhost:8000/api/wire/intents
```

## Production Considerations

1. **Use Redis for rate limiting** — Current implementation is in-memory (single instance)
2. **Use Redis for OIDC state** — Current implementation is in-memory
3. **Integrate JWT library** — Consider `jose` or `jsonwebtoken` for proper JWT
4. **Set up session cleanup cron** — Run `cleanupExpiredSessions()` daily
5. **Configure audit log retention** — Set retention policy based on compliance needs
6. **Use KMS for secrets** — Don't store secrets in environment variables (use KMS)

## Troubleshooting

### "Missing X-USER-ID header" (Demo Mode)
- Ensure `AUTH_MODE=demo`
- Include `X-USER-ID` header in request

### "Invalid or expired session" (OIDC Mode)
- Check token expiration
- Refresh token if expired
- Verify session not revoked

### "Rate limit exceeded"
- Check rate limit configuration
- Wait for window to reset
- Verify IP/user identification

### "Permission denied"
- Check user permissions
- Verify role assignment
- Review RBAC configuration

## Documentation

- [Implementation Summary](../../../docs/AGENT_B_IMPLEMENTATION_SUMMARY.md)
- [Polish Summary](../../../docs/AGENT_B_POLISH_SUMMARY.md)
- [Showcase](../../../docs/AGENT_B_SHOWCASE.md)

---

**Built with production in mind. Secure by default. Enterprise-ready.** 🚀
