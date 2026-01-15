# Observability Standard (Agent 8)

This document defines the **minimum required** observability for bank-grade reliability across WIRE2.

## Logging (structured JSON)

- **Format**: JSON per line
- **Required fields**:
  - `timestamp` (ISO8601)
  - `level` (`info|warn|error`)
  - `message`
  - `requestId` (propagate end-to-end; returned to clients as `X-Request-Id`)
  - `orgId` / `userId` where applicable
- **Redaction**:
  - Never log secrets/tokens/keys/audio blobs
  - Do not log raw PII unless explicitly required and approved

## Metrics (golden signals)

- **HTTP**: traffic, latency (p50/p95/p99), errors (4xx/5xx), saturation
- **DB**: query latency, error rates, connection pool saturation
- **Jobs**: queue depth by type/status, processing rate, retry rate, DLQ growth

Current implementation includes `wire2_jobs_total{type,status}` on `/metrics`.

## Tracing

- **Goal**: frontend → backend → DB/external call spans with sampling + PII-safe attributes.
- **Baseline shipped**:
  - Backend responds with `traceparent` and `X-Trace-Id`
  - Webhook outbound calls include `traceparent`
  - Jobs can carry `traceId`/`requestId` in payload where enqueue happens in-request (e.g., async bundle generation)

### Related runtime knobs

- `JOB_TENANT_CONCURRENCY` (default `5`): per-tenant concurrency limit for external calls (webhooks/email)
- `JOB_EXPORT_CONCURRENCY_PER_TENANT` (default `2`): per-tenant concurrency limit for export generation jobs
- `CB_FAILURE_THRESHOLD` (default `5`), `CB_OPEN_MS` (default `30000`): circuit breaker thresholds

