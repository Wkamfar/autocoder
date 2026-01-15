# Service Level Objectives (SLOs) and Alerting Plan

**Last Updated:** 2025-12-31  
**Owner:** Agent E (Ops + Prod Hardening)

---

## Overview

This document defines Service Level Objectives (SLOs), Service Level Indicators (SLIs), and alerting thresholds for WIRE2 backend services.

---

## Service Level Objectives (SLOs)

### Availability SLO

**Target:** 99.9% uptime (3 nines)

- **Monthly Downtime Budget:** 43.2 minutes
- **Quarterly Downtime Budget:** 2.16 hours
- **Annual Downtime Budget:** 8.76 hours

**Measurement:**
- SLI: Percentage of successful health checks over 5-minute windows
- Successful health check: HTTP 200 response from `/health` endpoint
- Measurement window: Rolling 30-day window

### Latency SLO

**Target:** P95 latency < 500ms for API endpoints

- **P50 (Median):** < 200ms
- **P95:** < 500ms
- **P99:** < 1000ms

**Measurement:**
- SLI: Request duration from Fastify request start to response sent
- Excluded: Health check endpoints, metrics endpoints
- Measurement window: Rolling 7-day window

### Error Rate SLO

**Target:** Error rate < 0.1% (1 error per 1000 requests)

- **4xx Errors:** < 0.05% (client errors)
- **5xx Errors:** < 0.05% (server errors)

**Measurement:**
- SLI: Percentage of requests returning 4xx or 5xx status codes
- Excluded: 401 Unauthorized (auth failures), 404 Not Found (expected)
- Measurement window: Rolling 7-day window

### Database Performance SLO

**Target:** Database query P95 latency < 100ms

- **Connection Pool:** < 80% utilization
- **Query Duration:** P95 < 100ms
- **Connection Errors:** < 0.01%

**Measurement:**
- SLI: Database query duration from Prisma client
- Measurement window: Rolling 24-hour window

---

## Service Level Indicators (SLIs)

### Availability SLI

```
availability = (successful_health_checks / total_health_checks) * 100
```

**Health Check Configuration:**
- Endpoint: `/health`
- Frequency: Every 30 seconds
- Timeout: 10 seconds
- Success Criteria: HTTP 200 response

### Latency SLI

```
p95_latency = 95th_percentile(request_duration)
```

**Metrics:**
- Prometheus histogram: `wire2_http_request_duration_seconds`
- Buckets: [0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0] seconds

### Error Rate SLI

```
error_rate = (error_requests / total_requests) * 100
```

**Metrics:**
- Prometheus counter: `wire2_http_request_errors_total`
- Prometheus counter: `wire2_http_requests_total`

---

## Alerting Thresholds

### Critical Alerts (Page On-Call)

#### Service Down
- **Condition:** Health check failing for > 2 minutes
- **Severity:** Critical
- **Action:** Page on-call engineer immediately
- **Runbook:** [DR Plan](./DISASTER_RECOVERY.md)

#### Database Unavailable
- **Condition:** Database connection failures > 10% for 1 minute
- **Severity:** Critical
- **Action:** Page on-call engineer immediately
- **Runbook:** Check database status, restore from backup if needed

#### High Error Rate
- **Condition:** Error rate > 1% for 5 minutes
- **Severity:** Critical
- **Action:** Page on-call engineer
- **Runbook:** Check application logs, review recent deployments

### Warning Alerts (Notify Team)

#### SLO Violation Warning
- **Condition:** Availability < 99.5% over 1 hour
- **Severity:** Warning
- **Action:** Notify team via Slack
- **Runbook:** Review recent changes, check monitoring dashboards

#### High Latency
- **Condition:** P95 latency > 1000ms for 10 minutes
- **Severity:** Warning
- **Action:** Notify team via Slack
- **Runbook:** Check database performance, review slow queries

#### Database Performance Degradation
- **Condition:** Database P95 latency > 200ms for 10 minutes
- **Severity:** Warning
- **Action:** Notify team via Slack
- **Runbook:** Check database load, review query performance

#### Backup Failure
- **Condition:** Backup job failed
- **Severity:** Warning
- **Action:** Notify team via Slack
- **Runbook:** Check backup script, verify storage availability

### Info Alerts (Log Only)

#### Deployment Completed
- **Condition:** CI/CD pipeline deployment successful
- **Severity:** Info
- **Action:** Log to monitoring system
- **Runbook:** None

#### High Request Volume
- **Condition:** Request rate > 2x baseline for 1 hour
- **Severity:** Info
- **Action:** Log to monitoring system
- **Runbook:** Review traffic patterns, consider scaling

---

## Monitoring Dashboards

### Primary Dashboard

**Metrics to Display:**
1. **Availability:** Current availability %, 30-day trend
2. **Request Rate:** Requests per second, by endpoint
3. **Latency:** P50, P95, P99 latency over time
4. **Error Rate:** 4xx and 5xx error rates
5. **Database Performance:** Query duration, connection pool usage
6. **Active Connections:** Current active HTTP connections

**Refresh Interval:** 30 seconds  
**Time Range:** Last 24 hours (default), configurable to 7 days

### Database Dashboard

**Metrics to Display:**
1. **Connection Pool:** Active connections, max connections, utilization %
2. **Query Performance:** P50, P95, P99 query duration
3. **Slow Queries:** Queries > 100ms, top 10 slow queries
4. **Database Size:** Database size, table sizes
5. **Replication Lag:** If using read replicas

### Infrastructure Dashboard

**Metrics to Display:**
1. **CPU Usage:** CPU utilization per container
2. **Memory Usage:** Memory usage per container
3. **Disk Usage:** Disk usage for database and application
4. **Network:** Network I/O, bandwidth usage
5. **Container Health:** Container status, restart counts

---

## Alerting Configuration

### Prometheus Alert Rules

```yaml
# alerts.yml

groups:
  - name: wire2_critical
    interval: 30s
    rules:
      - alert: ServiceDown
        expr: up{job="wire2-backend"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "WIRE2 backend service is down"
          description: "Health check failing for {{ $labels.instance }}"

      - alert: HighErrorRate
        expr: |
          rate(wire2_http_request_errors_total[5m]) / 
          rate(wire2_http_requests_total[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: DatabaseUnavailable
        expr: wire2_db_queries_total == 0 and rate(wire2_http_requests_total[1m]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database unavailable"
          description: "No database queries recorded but requests are being received"

  - name: wire2_warning
    interval: 1m
    rules:
      - alert: SLOViolationWarning
        expr: |
          (1 - (sum(rate(wire2_http_requests_total{status=~"2.."}[30d])) / 
                sum(rate(wire2_http_requests_total[30d])))) < 0.995
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Availability SLO violation warning"
          description: "Availability is below 99.5%"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(wire2_http_request_duration_seconds_bucket[5m])) > 1.0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High P95 latency"
          description: "P95 latency is {{ $value }}s"

      - alert: DatabaseSlowQueries
        expr: histogram_quantile(0.95, rate(wire2_db_query_duration_seconds_bucket[5m])) > 0.2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Database slow queries"
          description: "Database P95 latency is {{ $value }}s"
```

### Alertmanager Configuration

```yaml
# alertmanager.yml

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'oncall-pagerduty'
      continue: true
    - match:
        severity: warning
      receiver: 'team-slack'

receivers:
  - name: 'default'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#wire2-alerts'
        title: 'WIRE2 Alert'

  - name: 'oncall-pagerduty'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'
        description: '{{ .GroupLabels.alertname }}'

  - name: 'team-slack'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#wire2-alerts'
        title: 'WIRE2 Warning'
```

---

## Runbooks

### Service Down Runbook

1. **Check Health Endpoint**
   ```bash
   curl http://localhost:8000/health
   curl http://localhost:8000/ready
   ```

2. **Check Container Status**
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   docker-compose -f docker-compose.prod.yml logs wire-backend
   ```

3. **Check Database**
   ```bash
   docker-compose -f docker-compose.prod.yml exec postgres psql -U wire2_user -d wire2 -c "SELECT 1;"
   ```

4. **Restart Services**
   ```bash
   docker-compose -f docker-compose.prod.yml restart wire-backend
   ```

5. **If Still Down:** Escalate to DR procedures

### High Error Rate Runbook

1. **Check Error Logs**
   ```bash
   docker-compose -f docker-compose.prod.yml logs wire-backend | grep ERROR
   ```

2. **Check Recent Deployments**
   - Review deployment history
   - Check for recent code changes

3. **Check Database**
   - Verify database connectivity
   - Check for slow queries

4. **Rollback if Needed**
   - If recent deployment, consider rollback
   - Follow rollback procedures

---

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [SRE Book: SLIs, SLOs, and SLAs](https://sre.google/workbook/sli-slo/)
