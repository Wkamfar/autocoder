# Risk Register (Wire2)

**Owner:** Agent 0 (Coordinator/CTO)  
**Last updated:** 2026-01-14  
**Cadence:** review weekly; “accepted risk” must include an expiry date

This is the canonical list of known risks, their severity, and the mitigation plan.  
If a risk is “accepted,” it must have an **expiry date** and an **owner**.

## Severity rubric

- **Critical**: likely to cause funds loss, fraud, or broad outage; must be mitigated before “bank‑grade” launch.
- **High**: significant security/reliability impact; requires mitigation plan + timeline.
- **Medium**: contained impact; mitigation planned.
- **Low**: minor; track and revisit.

## Register

| ID | Risk | Severity | Likelihood | Owner | Mitigation | Detection | Status | Accepted until |
|---|---|---:|---:|---|---|---|---|---|
| R-001 | **Route/URL contract drift** breaks customer links or app boot | High | Medium | Agent 0 + Agent 1 | Codify `/v2` base + `/wire/*` alias; add routing regression tests; freeze changes behind gate | E2E route tests; deploy smoke | Open | — |
| R-002 | **Breaking API changes** (frontend/backend mismatch) | High | Medium | Agent 0 + Agent 10 | API contracts doc; error taxonomy; versioning rules; CI checks | Contract tests; OpenAPI diff | Open | — |
| R-003 | **Multi‑tenant isolation failure** (data leakage across orgs) | Critical | Low/Med | Agent 10 | DB constraints; org scoping middleware; tests; audits | Security tests; logs | Open | — |
| R-004 | **Signing key compromise** enables tampering with evidence/audit bundles | Critical | Low | Agent 10 | Key rotation, storage hardening, access controls, break‑glass | Key usage alerts | Open | — |
| R-005 | **Idempotency gaps** cause double execution / duplicate state transitions | Critical | Medium | Agent 10 | Idempotency keys on execution; state machine constraints; retries | Duplicate execution detection | Open | — |
| R-006 | **3rd‑party provider outage** (bank/email/IdP) cascades into app outage | High | Medium | Agent 0 | Circuit breakers; graceful degradation; status UI; retries/backoff | External SLI dashboards | Open | — |
| R-007 | **Evidence bundle integrity unclear to auditors** (format/verification gaps) | High | Low/Med | Agent 0 + Agent 10 | Bundle format + verification docs; sample bundle; verifier tool docs | Audit export tests | Open | — |
| R-008 | **Observability blind spots** prevent fast triage | High | Medium | Agent 0 | SLOs + alerting coverage; top alerts runbooks | Incident metrics | Open | — |

## Review log

- 2026-01-14: initial register created from bank‑grade roadmap.

