## SSRF Guardrails (Agent 5)

**Purpose:** prevent server-side request forgery through any feature that performs outbound HTTP(S), especially **webhooks** and future integrations.

### Threats covered

- Webhook target points to **localhost** or private networks
- Webhook target points to **cloud metadata** endpoints (e.g. `169.254.169.254`)
- IPv6 loopback / link-local abuse (`::1`, `fe80::/10`)
- Redirect-based SSRF (public URL that redirects to internal)

### Shipped today (evidence)

- URL safety checks:
  - `wire2/backend/src/lib/outboundUrlSafety.ts`
- Enforced for webhook create/update and re-checked at send time:
  - `wire2/backend/src/modules/webhooks/webhookService.ts`
- API surface returns `400` with `code: "UNSAFE_OUTBOUND_URL"` when blocked:
  - `wire2/backend/src/routes/webhooks.ts`
- Redirects disabled for webhook delivery:
  - `maxRedirects: 0` in webhook delivery axios call

### Policy (bank-grade default)

- **Allowed schemes:** `https` (default). `http` only allowed when explicitly enabled for dev (`WEBHOOK_ALLOW_HTTP=true`).
- **Blocked targets:** localhost, `.local`, `.internal`, and any targets that resolve to:
  - loopback
  - RFC1918 private networks
  - link-local
  - IPv6 unique-local
  - cloud metadata networks
- **DNS behavior:** best-effort resolution check; **fail closed** if resolution fails.

### Configuration

- `WEBHOOK_ALLOW_HTTP=true`: allow `http:` targets (dev only)
- `WEBHOOK_ALLOW_LOCALHOST=true`: allow localhost/private targets (dev only; default false)

### Tests

- `wire2/backend/src/tests/outboundUrlSafety.test.ts`

### Known limitations / follow-ups

- Full DNS rebinding resistance should pin resolution at connection time (custom agent / lookup pinning).
- Egress allowlisting for other outbound clients should route through a shared hardened client (future milestone).

