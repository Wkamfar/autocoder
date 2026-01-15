# WIRE API Changelog

All notable changes to the WIRE API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Idempotency key support for mutating endpoints
- Rate limiting implementation
- Webhook support for intent status changes
- Batch operations for beneficiaries
- Pagination for list endpoints

## [1.0.0] - 2025-12-31

### Added
- Initial API release
- Transfer intent lifecycle management
- Voice challenge and proof submission
- Approval decisions and token management
- Beneficiary management
- Policy configuration and simulation
- Event chain and audit bundle generation
- OpenAPI 3.0.3 specification
- Comprehensive error handling
- Response shape verification

### Endpoints
- `GET /health` - Service health status
- `GET /intents` - List transfer intents
- `GET /intents/:id` - Get transfer intent
- `POST /intents` - Create transfer intent
- `PATCH /intents/:id` - Update transfer intent
- `POST /intents/:id/challenge` - Create voice challenge
- `POST /challenges/:challengeId/proof` - Submit voice proof
- `POST /intents/:id/decision` - Create approval decision
- `POST /intents/:id/execute` - Execute transfer intent
- `GET /intents/:id/events` - List intent events
- `POST /intents/:id/bundle` - Generate audit bundle
- `GET /beneficiaries` - List beneficiaries
- `POST /beneficiaries` - Create beneficiary
- `PATCH /beneficiaries/:id` - Update beneficiary
- `GET /policies` - Get active policy
- `POST /policies` - Create policy version
- `POST /policies/simulate` - Simulate risk scoring

### Authentication
- Demo mode: `X-USER-ID` header
- Production mode: OIDC/SAML (planned)

### Error Codes
- `INVALID_REQUEST` - Invalid request body
- `MISSING_APPROVAL_TOKEN` - Missing approval token header
- `INTENT_NOT_FOUND` - Intent not found
- `BENEFICIARY_NOT_FOUND` - Beneficiary not found
- `POLICY_NOT_CONFIGURED` - No policy configured
- `PERMISSION_DENIED` - Insufficient permissions
- `INTENT_INVALID_STATUS` - Intent in invalid status
- `INTENT_IN_COOLDOWN` - Intent in cooldown period
- `APPROVAL_TOKEN_INVALID` - Invalid approval token
- `APPROVAL_TOKEN_EXPIRED` - Approval token expired
- `APPROVAL_TOKEN_CONSUMED` - Approval token already used
- `BINDING_HASH_MISMATCH` - Binding hash mismatch
- `INTERNAL_ERROR` - Internal server error

## Migration Guides

### From v0.x to v1.0.0

**Breaking Changes:**
- None (initial release)

**Deprecations:**
- None

**New Features:**
- All endpoints are new in v1.0.0

## Versioning Strategy

- **Major (v1, v2):** Breaking changes (removed endpoints, changed response shapes)
- **Minor (v1.0, v1.1):** New features, backward compatible
- **Patch (v1.0.0, v1.0.1):** Bug fixes, backward compatible

## Deprecation Policy

- Deprecated endpoints will be marked in OpenAPI spec
- Deprecated endpoints will remain functional for at least 2 major versions
- Deprecation notices will be included in response headers: `X-API-Deprecated: true`
- Migration guides will be provided for deprecated endpoints

## Support

- Current version: v1.0.0
- Supported versions: v1.0.0+
- End of life: TBD
