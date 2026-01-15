# Webhooks

## Create a webhook

In the Wire2 UI:

- Settings → Webhooks → Create
- Copy the **webhook secret** (shown once)

## Signature verification

Wire2 sends:

- `X-WIRE-Signature: t=<unix_ms>,v1=<hex>` (preferred) or `t=<unix_ms>,v0=<hex>` (legacy)

Verify:

- Parse `t` and `v1`/`v0`
- Reject if timestamp is too old (recommended 5 minutes)
- Compute HMAC over `${t}.${rawBody}` using the webhook secret (v1)
- Compare using timing-safe equality

Canonical spec: `wire2/backend/docs/WEBHOOKS_SIGNING_SPEC.md`

## Delivery logs + testing

Wire2 provides:

- A “Test” button in the UI (sends a `webhook.test` event)
- Delivery logs view (status, attempts, response body, next retry)

