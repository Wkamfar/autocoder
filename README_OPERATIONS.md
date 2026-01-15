# WIRE2 Operations Guide

**Last Updated:** 2025-12-31  
**Owner:** Agent E (Ops + Prod Hardening)

---

## Quick Start

### Development Environment

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Access backend
curl http://localhost:8000/health
curl http://localhost:8000/ready
curl http://localhost:8000/metrics
```

### Background Jobs Worker

Some async work (notably **webhook delivery + retries**) is processed by a separate worker.

```bash
cd wire2/backend
npm run worker
```

### Synthetics (Smoke Checks)

Synthetic checks can be run against a deployment (Agent 10 can wire into CI / cron).

```bash
cd wire2/backend
SYNTHETIC_BASE_URL="https://your-env.example" SYNTHETIC_USER_ID="user_alice_smith" SYNTHETIC_APPROVER_ID="user_bob_jones" npm run synthetics
```

### Production Deployment

```bash
# Set required environment variables
export DATABASE_URL="postgresql://..."
export AUTH_MODE="oidc"
export CORS_ORIGIN="https://example.com"
# ... see docker-compose.prod.yml for full list

# Start production environment
docker-compose -f docker-compose.prod.yml up -d

# Verify deployment
curl http://localhost:8000/health
curl http://localhost:8000/ready
```

---

## Health Checks

### Liveness Check (`/health`)

Basic health check for container orchestration (Kubernetes liveness probe).

```bash
curl http://localhost:8000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-31T12:00:00.000Z",
  "version": "0.1.0",
  "uptime": 3600
}
```

### Readiness Check (`/ready`)

Readiness check with dependency verification (Kubernetes readiness probe).

```bash
curl http://localhost:8000/ready
```

**Response (Ready):**
```json
{
  "ready": true,
  "checks": {
    "database": {
      "status": "ready",
      "latency": 5
    }
  },
  "timestamp": "2025-12-31T12:00:00.000Z"
}
```

**Response (Not Ready):**
```json
{
  "ready": false,
  "checks": {
    "database": {
      "status": "not_ready"
    }
  },
  "timestamp": "2025-12-31T12:00:00.000Z"
}
```
*Status Code: 503*

---

## Metrics

### Prometheus Metrics Endpoint (`/metrics`)

Expose Prometheus-compatible metrics for monitoring.

```bash
curl http://localhost:8000/metrics
```

**Metrics Exposed:**
- `wire2_http_requests_total` - Total HTTP requests by method, route, status
- `wire2_http_request_duration_seconds` - Request duration histograms
- `wire2_http_request_errors_total` - Error counts by method, route
- `wire2_db_queries_total` - Total database queries
- `wire2_db_query_duration_seconds` - Database query duration
- `wire2_active_connections` - Current active HTTP connections

**Prometheus Configuration:**
```yaml
scrape_configs:
  - job_name: 'wire2-backend'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:8000']
```

---

## Backup and Restore

### Automated Backups

```bash
# Run backup
cd wire2/backend
./scripts/backup.sh /backups/wire2

# Schedule hourly backups (cron)
0 * * * * /path/to/wire2/backend/scripts/backup.sh /backups/wire2
```

### Manual Restore

```bash
# Restore from backup
cd wire2/backend
./scripts/restore.sh /backups/wire2/wire2_backup_20251231_120000.sql.gz
```

**⚠️ WARNING:** Restore will destroy all existing data!

See [Backup Scripts Documentation](backend/scripts/README.md) for details.

---

## CI/CD Pipeline

### Running CI Locally

```bash
# Install dependencies
cd wire2/backend
npm ci

# Run migrations
export DATABASE_URL="postgresql://wire2_user:wire2_password@localhost:5432/wire2_test"
npm run db:migrate:deploy

# Seed database
npm run db:seed

# Run tests
npm test
```

### GitHub Actions

CI pipeline runs automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Manual workflow dispatch

**Pipeline Steps:**
1. Checkout code
2. Setup Node.js
3. Install dependencies
4. Generate Prisma Client
5. Run migrations (ephemeral Postgres)
6. Seed database
7. Run tests
8. Type check
9. Lint

See [CI Workflow](.github/workflows/ci.yml) for details.

---

## Monitoring and Alerting

### Service Level Objectives (SLOs)

- **Availability:** 99.9% uptime
- **Latency:** P95 < 500ms
- **Error Rate:** < 0.1%

### Alerting

- **Critical Alerts:** Service down, database unavailable, high error rate
- **Warning Alerts:** SLO violations, high latency, backup failures
- **Info Alerts:** Deployments, high request volume

See [SLOs and Alerting Plan](backend/docs/SLOS_AND_ALERTING.md) for full configuration.

---

## Disaster Recovery

### Recovery Objectives

- **RPO (Recovery Point Objective):** 1 hour
- **RTO (Recovery Time Objective):** 4 hours

### DR Procedures

1. **Database Corruption:** Restore from backup
2. **Infrastructure Loss:** Provision new infrastructure, restore database
3. **Data Center Outage:** Activate DR site, restore database
4. **Security Breach:** Contain, assess, remediate, restore if needed

See [Disaster Recovery Plan](backend/docs/DISASTER_RECOVERY.md) for detailed procedures.

---

## Migration Management

### Safe Migration Practices

1. **Review SQL:** Inspect generated migration SQL
2. **Test in Staging:** Apply migration to staging first
3. **Backup Database:** Create backup before migration
4. **Rollback Plan:** Document rollback steps

### Rollback Strategies

1. **Manual SQL Rollback:** Create reverse migration
2. **Backup Restore:** Restore from pre-migration backup
3. **Migration Reset:** Development only (destroys data)

See [Migration Safety Guide](backend/docs/MIGRATION_SAFETY.md) for details.

---

## Security Scanning

### Automated Scanning

Security scanning runs automatically via GitHub Actions:
- Dependency vulnerability scanning (npm audit)
- SBOM generation (CycloneDX, Syft)
- Docker image scanning (Trivy)
- Code security scanning (Trivy)

### Manual SBOM Generation

```bash
cd wire2/backend
./scripts/generate-sbom.sh ./sbom
```

See [Security Scan Workflow](.github/workflows/security-scan.yml) for details.

---

## Troubleshooting

### Service Won't Start

1. **Check Logs:**
   ```bash
   docker-compose -f docker-compose.prod.yml logs wire-backend
   ```

2. **Check Database:**
   ```bash
   docker-compose -f docker-compose.prod.yml exec postgres psql -U wire2_user -d wire2 -c "SELECT 1;"
   ```

3. **Check Health Endpoints:**
   ```bash
   curl http://localhost:8000/health
   curl http://localhost:8000/ready
   ```

### High Latency

1. **Check Database Performance:**
   ```bash
   # View slow queries
   docker-compose -f docker-compose.prod.yml exec postgres psql -U wire2_user -d wire2 -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
   ```

2. **Check Metrics:**
   ```bash
   curl http://localhost:8000/metrics | grep wire2_db_query_duration
   ```

### Backup Failures

1. **Check Disk Space:**
   ```bash
   df -h /backups
   ```

2. **Check Database Connectivity:**
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

3. **Check Backup Script Permissions:**
   ```bash
   ls -l backend/scripts/backup.sh
   chmod +x backend/scripts/backup.sh
   ```

---

## References

- [Agent E Completion Summary](docs/AGENT_E_COMPLETION_SUMMARY.md)
- [Migration Safety Guide](backend/docs/MIGRATION_SAFETY.md)
- [Disaster Recovery Plan](backend/docs/DISASTER_RECOVERY.md)
- [SLOs and Alerting Plan](backend/docs/SLOS_AND_ALERTING.md)
- [Backend Scripts Documentation](backend/scripts/README.md)
