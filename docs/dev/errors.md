# Errors

Wire2 errors follow:

```json
{ "error": "Human readable message", "code": "MACHINE_CODE", "details": { "optional": "context" } }
```

HTTP status codes:

- `400`: validation / bad request
- `401`: auth required / invalid credentials
- `403`: authenticated but missing permission
- `404`: resource not found (within tenant)
- `409`: conflict (e.g., idempotency mismatch)
- `429`: rate limited
- `500`: unexpected error

