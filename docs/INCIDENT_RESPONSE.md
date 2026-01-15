# Incident Response (Agent 10)

Purpose: define severity, escalation, comms, and action tracking so incidents are handled consistently and auditable.

## Severity levels

- **S0 (Info / no customer impact)**: noisy alerts, minor degradations, no user-visible issue
- **S1 (High / customer impact)**: incorrect auth decisions, payment/approval correctness risk, tenant isolation risk, data exposure risk
- **S2 (Medium)**: partial outage, elevated error rates, degraded performance, missed webhooks with retries succeeding
- **S3 (Low)**: minor UI issues, non-critical feature regressions, cosmetic errors

## Triage checklist (first 10 minutes)

- [ ] Confirm **scope** (single tenant vs multi-tenant)
- [ ] Confirm **blast radius** (read-only vs write paths, auth/session, webhooks/jobs)
- [ ] Capture **timestamps** + **request IDs / trace IDs**
- [ ] Check **recent deploys**, migrations, feature flag flips, and config changes
- [ ] Decide **mitigation** (rollback / flag off / canary stop / rate limit / disable integration)
- [ ] Start a timeline doc (who/what/when) + assign an incident lead

## Comms templates

### Internal (engineering)

Subject: `[S{1|2|3}] Incident: <short summary>`

- Impact: <what’s broken / who is affected>
- Start time: <UTC>
- Current status: investigating | mitigating | monitoring | resolved
- Mitigation: <rollback/flag/etc>
- Next update: <time>

### External (customer-facing)

- Summary: <plain language>
- Impact: <what users see>
- Status: investigating | mitigating | monitoring | resolved
- Next update: <time>
- Workaround: <if any>

## Action tracking / postmortem

- [ ] Root cause analysis (technical + contributing factors)
- [ ] Detection gap analysis (why did/didn’t alerts fire)
- [ ] Corrective actions (owner + due date + verification)
- [ ] Follow-up: update tests + release gates to prevent recurrence

