# Authentication

## API keys

Wire2 supports API keys for programmatic access.

### Recommended: Basic auth (key + secret)

Send:

- `Authorization: Basic base64(<apiKey>:<apiSecret>)`

### Legacy: ApiKey header (key-only)

Send one of:

- `Authorization: ApiKey <apiKey>`
- `X-API-KEY: <apiKey>`

## Session auth (UI)

The frontend uses:

- `Authorization: Bearer <session_token>`

This is intended for UI sessions, not server-to-server integrations.

