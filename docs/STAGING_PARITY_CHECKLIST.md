# Staging Parity Checklist (Agent 10)

Goal: staging should behave like production **without** risking real funds or sensitive data. This checklist is the minimum bar for staging-parity E2E and release smoke tests.

## Environment & config

- [ ] **Build parity**: staging uses the same build pipeline/artifacts as production (no local-only builds)
- [ ] **Runtime parity**: same Node version, same base images, same process model (API + worker)
- [ ] **Config validation**: config is validated at startup; unknown env vars are flagged
- [ ] **Feature flags**: all risky features are behind flags; staging can exercise both on/off
- [ ] **Clock/time**: timezone, NTP, and date handling match production defaults

## Identity, auth, and sessions

- [ ] **Auth mode parity**: staging runs the intended auth mode (demo/password or OIDC), with explicit documentation of the differences
- [ ] **Session continuity**: rolling deploy does not log users out unexpectedly; refresh token behavior is tested
- [ ] **RBAC parity**: roles/permissions match production; least-privilege is the default

## Data: seeded tenants and safe test data

- [ ] **Seeded tenants**: a small fixed set of orgs/users exist for E2E (with stable identifiers)
- [ ] **Safe data**: no real PII; synthetic names/emails; deterministic “voice” fixtures
- [ ] **Deterministic sandbox**: sandbox endpoints produce stable outputs (seeded data, stable errors)
- [ ] **Isolation**: cross-tenant access is continuously tested (multi-tenant isolation suite)

## External dependencies (banking, webhooks, storage)

- [ ] **Providers mocked/sandboxed**: bank connectivity uses sandbox providers or mock adapters
- [ ] **Outbound SSRF guardrails on**: staging keeps outbound URL safety checks enabled
- [ ] **Webhooks**: events deliver to a staging receiver; signing enabled; retry behavior observable
- [ ] **Object storage**: staging bucket with strict lifecycle rules; no prod buckets

## Observability & operations

- [ ] **Logs**: structured logs with request IDs + trace IDs; PII redaction verified
- [ ] **Metrics**: basic dashboards exist (latency, error rate, webhook backlog, job queue depth)
- [ ] **Alerting**: paging/alerts wired for S1/S2 conditions in staging (at least to Slack/email)
- [ ] **Audit**: admin/support actions are audited (who/what/when)

## Release smoke tests (must run against staging)

- [ ] **Top 6 critical flows** pass in staging (API-level E2E acceptable for P0)
- [ ] **Migration rehearsal**: migrations applied on staging before production deploy
- [ ] **Rollback rehearsal**: rollback procedure tested quarterly (or before major releases)

