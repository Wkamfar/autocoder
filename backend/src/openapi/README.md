# WIRE API OpenAPI Documentation

This directory contains comprehensive API documentation, specifications, and tooling for the WIRE API.

## Files

- **`wire.openapi.json`** - OpenAPI 3.0.3 specification (source of truth)
- **`API_CONTRACT_DOCUMENTATION.md`** - Human-readable API documentation
- **`RESPONSE_SHAPE_VERIFICATION.md`** - Response shape verification checklist
- **`AGENT_A_COMPLETION_SUMMARY.md`** - Agent A completion summary
- **`validate-spec.ts`** - Script to validate OpenAPI spec against routes
- **`generate-types.ts`** - Script to generate TypeScript types from OpenAPI spec
- **`postman-collection.json`** - Postman collection for API testing
- **`swagger-ui-setup.md`** - Swagger UI setup instructions

## Quick Start

### View API Documentation

1. **Swagger UI** (recommended):
   ```bash
   npm run openapi:serve
   ```
   Then visit: http://localhost:3001/docs

2. **Postman**:
   - Import `postman-collection.json` into Postman
   - All endpoints pre-configured with examples

3. **Redoc**:
   ```bash
   npx @redocly/cli preview-docs wire.openapi.json
   ```

### Validate OpenAPI Spec

```bash
npm run openapi:validate
```

This checks:
- OpenAPI spec syntax
- Routes match implementation
- Response shapes match frontend types
- All required fields documented

### Generate TypeScript Types

```bash
npm run openapi:generate-types
```

Generates TypeScript types from OpenAPI spec to `src/types/api-generated.ts`.

### Test API Contract

```bash
npm run openapi:contract-tests
```

Runs contract tests to ensure implementation matches spec.

## API Versioning

Current version: **v1.0.0**

The API follows semantic versioning:
- **Major** (v1, v2): Breaking changes
- **Minor** (v1.0, v1.1): New features, backward compatible
- **Patch** (v1.0.0, v1.0.1): Bug fixes, backward compatible

## Authentication

### Demo Mode (Current)
- Uses `X-USER-ID` header
- Format: `X-USER-ID: user_123`

### Production Mode (Future)
- OIDC/SAML authentication
- JWT bearer tokens
- Format: `Authorization: Bearer <token>`

## Error Handling

All errors follow this format:
```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": {
    "additional": "context"
  }
}
```

See `API_CONTRACT_DOCUMENTATION.md` for complete error code reference.

## Rate Limiting

**Current:** Implemented (Redis-backed when `REDIS_URL` is set; safe fallback when unset).  
**Notes:** Limits are applied both globally and post-auth per user/org; see `wire2/backend/docs/RATE_LIMITING_AND_ABUSE_POLICY.md`.

## Idempotency

**Current:** Partially implemented.  
**Notes:** Mutating routes support `X-Idempotency-Key` where applicable; production execution routes require it. See `wire2/docs/dev/idempotency.md`.

## Contributing

When adding new endpoints:

1. Update `wire.openapi.json` first
2. Add request/response examples
3. Update `RESPONSE_SHAPE_VERIFICATION.md`
4. Run `npm run openapi:validate`
5. Update `API_CONTRACT_DOCUMENTATION.md`

## Tools

### OpenAPI CLI Tools

```bash
# Install OpenAPI tools
npm install -D @openapitools/openapi-generator-cli

# Generate client SDKs
npm run openapi:generate-client -- --generator-name typescript-axios

# Validate spec
npm run openapi:validate
```

### Swagger Codegen

```bash
# Generate server stubs
swagger-codegen generate -i wire.openapi.json -l nodejs-express-server

# Generate client SDKs
swagger-codegen generate -i wire.openapi.json -l typescript-axios
```

## Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger Editor](https://editor.swagger.io/)
- [Postman OpenAPI Import](https://learning.postman.com/docs/integrations/available-integrations/working-with-openAPI/)
- [Redoc](https://github.com/Redocly/redoc)

## Support

For API questions or issues:
- Check `API_CONTRACT_DOCUMENTATION.md` first
- Review `RESPONSE_SHAPE_VERIFICATION.md` for type compatibility
- See `AGENT_A_COMPLETION_SUMMARY.md` for implementation details
