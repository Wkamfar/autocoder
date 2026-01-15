# Quickstart

## 1) Create API key

In the Wire2 UI:

- Settings → API Keys → Create
- Save the secret once (it is only shown once)

## 2) Call the API

Base URL:

- Local: `http://localhost:3000`
- API prefix: `/api/wire`

Auth (recommended):

- `Authorization: Basic base64(<apiKey>:<apiSecret>)`

Example:

```bash
curl -sS \
  -H "Authorization: Basic $(printf "%s" "wire_live_...:wkey_secret_..." | base64)" \
  http://localhost:3000/api/wire/intents
```

## 3) Configure webhooks

- Settings → Webhooks → Create
- Subscribe to events you care about
- Save the webhook secret once (it is only shown once)

Then implement signature verification in your server. See [Webhooks](./webhooks.md).

## Sandbox determinism (dev/testing)

If you enable sandbox mode (`SANDBOX_MODE=true`) you can reset a deterministic dataset:

- `POST /api/sandbox/reset` with `{ "seed": "default" }`

This creates a sandbox org and users with stable IDs for the given seed.

