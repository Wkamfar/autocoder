## CSP Rollout (Operational) — Agent 5

**Goal:** move CSP from “supported” to “operationalized”: collect reports, alert on anomalies, and safely roll out enforce mode.

### Shipped components

- **Report endpoint**: `POST /api/security/csp-report`
  - `wire2/backend/src/routes/securityReports.ts`
- **Content type support**: `application/csp-report` and `application/reports+json`
  - `wire2/backend/src/app.ts`
- **Headers**:
  - `Content-Security-Policy-Report-Only` (default)
  - `Reporting-Endpoints` (modern reporting)
  - `wire2/backend/src/modules/security/auth.ts`
- **Metrics**:
  - `wire2_csp_reports_total{disposition, directive}`
  - `wire2/backend/src/lib/observability.ts`

### Configuration

- `CSP_MODE=report-only|enforce|off` (default: `report-only`)
- `CSP_REPORT_PATH=/api/security/csp-report` (default as shown)
- `CSP_REPORT_ENDPOINT` (optional; value used in `Reporting-Endpoints`)
- `CSP_ALERT_THRESHOLD_PER_MIN=100` (best-effort in-process warning log threshold)

### Alerting (recommended)

Use Prometheus/Alertmanager (or equivalent) to alert on:

- sudden spikes in CSP violations:
  - `rate(wire2_csp_reports_total[5m])` above baseline
- violations of high-risk directives (example):
  - `directive="script-src"` / `directive="object-src"` anomalies

### Enforce rollout (safe path)

1. **Report-only in staging** for ≥7 days; baseline the metrics and identify top violations.
2. **Fix violations** (remove inline scripts, add nonces/hashes, adjust policy).
3. **Canary enforce**: set `CSP_MODE=enforce` in a canary environment (or a subset of traffic).
4. **Full enforce** once violations drop near zero and the canary shows no UX breakage.
5. Keep report-only mode available as an emergency rollback switch.

### Known limitations

- In-process threshold logs are not a replacement for real alerting; they are a safety net.
- Do not add high-cardinality labels (URLs, full blocked-uri) to metrics—keep metrics bounded.

