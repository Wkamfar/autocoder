# Degraded Mode Policy (Agent 8)

This defines what WIRE2 must do when dependencies degrade (DB, Redis, POSE, external providers).

## Principles

- **Fail closed** for money movement and privileged mutations when safety cannot be proven.
- **Fail open (read-only)** for safe reads and non-sensitive UX.
- **Be explicit**: surface clear user messaging and remediation steps (never “silent success”).
- **Prefer bounded retries** with circuit breakers over unbounded retry storms.

## Dependency policy (baseline)

- **Postgres unavailable**: service is **not ready** (`/ready` returns 503).
- **Redis unavailable**: degrade features that use Redis (caching/session optimizations) but keep core flows functional where possible.
- **POSE voice service unavailable**: degrade to explicit “voice verification unavailable” UX (no implicit bypass).
- **Webhook destinations failing**: retry with backoff; DLQ with operator-owned replay.

## Circuit breakers + saturation controls (Agent 8)

- Webhook delivery uses a **circuit breaker** per webhook (`webhook:<webhookId>`) and a **per-tenant concurrency limit** (`JOB_TENANT_CONCURRENCY`).
- Email delivery uses a **circuit breaker** per provider (`email:<EMAIL_PROVIDER>`) and the same per-tenant concurrency limit.
- Evidence bundle generation uses a **per-tenant export concurrency limit** (`JOB_EXPORT_CONCURRENCY_PER_TENANT`) to prevent CPU/IO starvation.

## Required UX hooks

- A stable error code taxonomy for degraded states
- A “retry later” UI pattern for transient failures
- Admin visibility into DLQ + replay actions

