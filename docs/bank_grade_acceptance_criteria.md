# Bank‑Grade Acceptance Criteria (Wire2)

**Owner:** Agent 0 (Coordinator/CTO)  
**Last updated:** 2026-01-14  
**Status:** Signed (targets locked; changes require explicit revision)

This document defines the **measurable** criteria required to claim “bank‑grade” for Wire2. If it’s not measurable, it’s not a launch gate.

## Sign-off (required)

**These numeric targets are now signed off.**

- **Signed off by (names/roles)**:
  - Agent 0 (Coordinator/CTO) — final decision + release authority
  - Agent 5 (Security) — security posture + vuln SLAs review
  - Agent 8 (Reliability) — SLO/DR readiness review
  - Agent 10 (QA/Release) — CI gate enforcement review
- **Date**: 2026-01-14
- **Review cadence**: monthly (or earlier if a trust boundary changes, payment rails change, or a Sev-1 occurs)

## Numeric targets (signed)

| Category | Metric | Target | Measurement window | Notes |
|---|---|---:|---|---|
| Availability | Frontend availability | 99.9% | monthly | Excludes planned maintenance windows (must be documented) |
| Availability | API availability | 99.9% | monthly | `GET /api/wire/health` + key endpoints |
| Latency | Read endpoints | p95 < 300ms, p99 < 800ms | rolling 7d | Excluding 3rd-party bank latency |
| Latency | Write endpoints | p95 < 600ms, p99 < 1500ms | rolling 7d | Includes validation + DB write |
| Durability/DR | RPO | 15 minutes | per incident | Verified via restore drills |
| Durability/DR | RTO | 60 minutes | per incident | Verified via restore drills |
| Audit retention | Evidence + audit retention | 1 year (minimum) | policy | Make configurable; document legal-hold behavior |
| Security response | Critical vuln remediation | ≤ 7 days | per finding | Exceptions require risk sign-off + expiry |
| Support | Sev-1 response time | ≤ 15 minutes | per incident | Define severity rubric + paging |

## Definitions

- **SLO**: internal reliability target (measured continuously).
- **SLA**: customer contractual target (optional; subset of SLOs).
- **RPO**: max acceptable data loss window.
- **RTO**: max acceptable time to restore service after incident.
- **MTTR**: mean time to recover.

## Environments & scope

- **Production**: all “bank‑grade” gates apply.
- **Staging**: must support realistic load tests + incident drills.
- **Dev**: gates are advisory (but tests must run).

## Required gates (must be pass/fail)

### Availability & performance (core user flows)

Targets are defined in **“Numeric targets (signed)”** above.

**Measurement method**

- Use backend health + route instrumentation as defined in:
  - `wire2/backend/docs/SLOS_AND_ALERTING.md`

### Disaster recovery

Targets are defined in **“Numeric targets (signed)”** above.

- **Backup verification**: required (automated restore validation cadence: monthly, minimum)

Reference:

- `wire2/backend/docs/DISASTER_RECOVERY.md`

### Security & identity

- **No “enterprise” claims without threat model**: required
- **Key management**: documented and audited procedures required
- **Audit integrity**: evidence bundles must be verifiable end‑to‑end

References:

- `wire2/backend/docs/THREAT_MODEL.md`
- `wire2/backend/docs/SIGNING_KEY_MANAGEMENT.md`
- `wire2/backend/docs/EVENT_CHAIN_VERIFICATION.md`
- `wire2/backend/docs/BUNDLE_FORMAT.md`
- `wire2/backend/docs/CANONICAL_JSON_SPEC.md`

### Change management & migrations

- **No breaking changes** without: contract update + migration plan + feature flag + rollback plan + release note
- **Schema changes** must follow expand/contract and be reviewed

Reference:

- `wire2/backend/docs/MIGRATION_SAFETY.md`
- `wire2/backend/docs/API_CONTRACTS.md`

### Observability & incident response

- **On-call**: named rotation + escalation policy exists (TBD: owners)
- **Runbooks**: top 10 alerts have actionable runbooks
- **Postmortems**: blameless; written within TBD days; tracked actions assigned

Reference:

- `wire2/backend/docs/SLOS_AND_ALERTING.md`

## Launch checklist (minimum)

- [ ] All “Required gates” above are green in production
- [ ] `wire2/docs/RISK_REGISTER.md` reviewed within last 7 days
- [ ] Threat model reviewed within last 30 days
- [ ] URL contract is stable and has regression coverage: `wire2/docs/URL_CONTRACT.md`
- [ ] API contract rules adopted (versioning, errors, idempotency): `wire2/backend/docs/API_CONTRACTS.md`

