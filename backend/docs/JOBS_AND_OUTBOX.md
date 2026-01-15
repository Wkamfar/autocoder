# Jobs + Outbox (Agent 8)

WIRE2 uses a **Postgres-backed job queue** (table `Job`) for reliable async work (webhook delivery, retries, and future notifications/export generation).

## Architecture

- **Producer (API server)** writes domain state + an async “intent” to process by **enqueuing a job** in Postgres.
- **Consumer (worker process)** polls due jobs, claims them with `FOR UPDATE SKIP LOCKED`, executes handlers, and reschedules with backoff until success or DLQ.

This yields **at-least-once** processing with dedupe on enqueue (`Job.uniqueKey`).

## Running the worker

From `wire2/backend/`:

```bash
npm run worker
```

### Worker environment variables

- `JOB_WORKER_ID`: optional (default `worker_<pid>`)
- `JOB_CONCURRENCY`: optional (default `10`)
- `JOB_POLL_INTERVAL_MS`: optional (default `1000`)
- `JOB_VISIBILITY_TIMEOUT_MS`: optional (default `600000` / 10m)
- `JOB_REAP_EVERY_TICKS`: optional (default `30`)

## Delivery + Retry semantics (webhooks)

- API creates `WebhookDelivery` rows and **enqueues** `Job(type="webhook.delivery", uniqueKey=<deliveryId>)`.
- Worker performs the HTTP delivery and updates `WebhookDelivery` status.
- On failure, `WebhookDelivery.nextRetryAt` is computed (exponential backoff) and the same job is rescheduled to `runAt = nextRetryAt`.
- Once retries are exhausted, the job becomes **DLQ** (`status=DEAD`) and the delivery is marked `failed`.

## Operational visibility

- **Prometheus**: `/metrics` includes job counts by type/status (`wire2_jobs_total{type,status}`).
- **Admin**: `/api/wire/admin/jobs` lists jobs, including DLQ.
- **Replay**: `/api/wire/admin/jobs/:id/replay` re-queues a DEAD job.

## Extended job types (P1)

- `email.send`: async email notifications (opt-in via `EMAIL_ASYNC=true` in API processes)
- `evidence.bundle.generate`: async evidence bundle generation (opt-in via `POST /api/wire/intents/:id/bundle?async=1`)
