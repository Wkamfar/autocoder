## Rate Limiting & Abuse Policy (Agent 5)

**Purpose:** protect Wire2 from operational abuse (credential stuffing, bot scraping, webhook storms, brute force), while preserving UX.

### Shipped today (evidence)

- Rate limiter middleware (Redis-backed when `REDIS_URL` is configured; in-memory fallback otherwise):
  - `wire2/backend/src/modules/security/rateLimit.ts`
- Default configuration:
  - `wire2/backend/src/modules/security/config.ts` (`RATE_LIMIT_CONFIG`)
- Applied globally:
  - `wire2/backend/src/modules/security/auth.ts` (global limiter hook)
- Applied to login/token flows:
  - `wire2/backend/src/routes/auth.ts` (`preHandler: rateLimiters.login`)

### Current limits (defaults)

See `RATE_LIMIT_CONFIG` in code. Key tiers:

- **global**: per client (user if authed, else IP) - coarse protection
- **login**: protects auth endpoints
- **challenge**: protects fraud-sensitive flows
- **authenticatedUser / authenticatedOrg**: post-auth per-user and per-org tiers (tenant protection)

### Tiered quotas policy (operational)

Wire2 supports simple, explicit per-org quota tiers via multipliers applied to **org-scoped** limits.

- `RATE_LIMIT_DEFAULT_ORG_MULTIPLIER=1`
- `RATE_LIMIT_ORG_MULTIPLIERS` (JSON map), e.g.:

```json
{
  "org_acme": 2,
  "org_enterprise_123": 5
}
```

This multiplies the configured `authenticatedOrg.max` (and any other org-scoped limiter) by the multiplier.

### Monitoring (recommended)

Prometheus metrics emitted:

- `wire2_rate_limit_events_total{limiter,scope,result}`

Recommended alerts:

- sustained `result="blocked"` spikes per limiter (login/challenge/authed_org)
- high org-level blocking (customer-impacting throttling)

### Bank-grade requirements (next)

- Add Redis operational hardening: HA, persistence strategy, monitoring, and failure modes (do we fail-open or fail-closed per endpoint class).
- Multi-dimensional limits: per **IP / user / org / endpoint class**.
- Tenant quotas for exports/webhooks/api keys (coordinate with Agent 9).
- Add metrics per limiter: block rate, remaining budget, top offenders.

### Response requirements

When limited, responses MUST:

- return `429`
- include `Retry-After`
- include stable machine code: `RATE_LIMIT_EXCEEDED`

### Tests

Rate limit behavior should be exercised via integration tests for the highest-risk endpoints (login, challenge/proof, webhook test delivery).

