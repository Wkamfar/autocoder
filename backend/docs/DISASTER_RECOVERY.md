# Disaster Recovery Plan

**Last Updated:** 2025-12-31  
**Owner:** Agent E (Ops + Prod Hardening)

---

## Overview

This document outlines the Disaster Recovery (DR) plan for WIRE2 backend infrastructure, including Recovery Point Objectives (RPO) and Recovery Time Objectives (RTO).

---

## DR Objectives

### Recovery Point Objective (RPO)
- **Target RPO:** 1 hour
- **Maximum Acceptable Data Loss:** 1 hour of transactions
- **Backup Frequency:** Hourly backups with point-in-time recovery capability

### Recovery Time Objective (RTO)
- **Target RTO:** 4 hours
- **Maximum Acceptable Downtime:** 4 hours
- **Critical Path:** Database restore + application deployment

---

## Backup Strategy

### 1. Database Backups

#### Automated Backups
- **Frequency:** Hourly (production), Daily (staging)
- **Retention:** 30 days (production), 7 days (staging)
- **Location:** 
  - Primary: On-premise backup storage
  - Secondary: Cloud object storage (S3/GCS) with cross-region replication
- **Backup Type:** Full database dumps (pg_dump)

#### Backup Script
```bash
# Run automated backup
./scripts/backup.sh /backups/wire2

# Or via cron (hourly)
0 * * * * /path/to/wire2/backend/scripts/backup.sh /backups/wire2
```

#### Backup Verification
- Automated backup integrity checks (checksum validation)
- Weekly restore tests to verify backup validity
- Alert on backup failures

### 2. Application State Backups

#### Configuration Backups
- Environment variables stored in secrets management (Vault/AWS Secrets Manager)
- Docker Compose configurations version-controlled in Git
- Database migration files version-controlled in Git

#### Application Code
- Version-controlled in Git repository
- Tagged releases for rollback capability

### 3. Audit Bundle Backups

- Audit bundles stored in object storage (S3/GCS)
- Cross-region replication enabled
- Immutable storage (WORM - Write Once Read Many)
- Retention: 7 years (compliance requirement)

---

## Disaster Scenarios

### Scenario 1: Database Corruption

**Symptoms:**
- Database queries failing
- Data integrity errors
- Application errors

**Recovery Steps:**
1. **Immediate:** Stop application to prevent further corruption
2. **Assess:** Identify corruption extent (tables affected)
3. **Restore:** Restore from most recent backup
4. **Verify:** Run integrity checks and test application
5. **Resume:** Restart application with monitoring

**RTO:** 2-4 hours  
**RPO:** Up to 1 hour (last backup)

### Scenario 2: Complete Infrastructure Loss

**Symptoms:**
- All services unavailable
- Infrastructure destroyed (fire, natural disaster, etc.)

**Recovery Steps:**
1. **Infrastructure:** Provision new infrastructure (cloud/on-premise)
2. **Database:** Restore database from backup
3. **Application:** Deploy application from Git repository
4. **Configuration:** Restore environment variables from secrets management
5. **Verification:** Run smoke tests and integrity checks
6. **DNS/Network:** Update DNS records and network configuration
7. **Resume:** Start services and monitor

**RTO:** 4-8 hours  
**RPO:** Up to 1 hour (last backup)

### Scenario 3: Data Center Outage

**Symptoms:**
- Complete data center unavailable
- Network connectivity lost

**Recovery Steps:**
1. **Failover:** Activate DR site (if available)
2. **Database:** Restore database from backup at DR site
3. **Application:** Deploy application at DR site
4. **DNS:** Update DNS to point to DR site
5. **Monitor:** Monitor services at DR site
6. **Return:** Plan return to primary site when available

**RTO:** 2-4 hours (with DR site)  
**RPO:** Up to 1 hour (last backup)

### Scenario 4: Security Breach

**Symptoms:**
- Unauthorized access detected
- Data exfiltration suspected
- Malicious activity in logs

**Recovery Steps:**
1. **Contain:** Isolate affected systems immediately
2. **Assess:** Determine breach extent and data affected
3. **Remediate:** Patch vulnerabilities, rotate credentials
4. **Restore:** If data corrupted, restore from pre-breach backup
5. **Audit:** Review audit logs and identify breach vector
6. **Notify:** Notify stakeholders and regulatory bodies (if required)
7. **Resume:** Restart services after remediation

**RTO:** 4-24 hours (depending on breach severity)  
**RPO:** Restore to pre-breach state (may require older backup)

---

## Recovery Procedures

### Database Restore Procedure

#### Full Restore
```bash
# 1. Stop application
docker-compose -f docker-compose.prod.yml stop wire-backend

# 2. Drop existing database (if needed)
dropdb -h localhost -U wire2_user wire2

# 3. Restore from backup
./scripts/restore.sh /backups/wire2_backup_20251231_120000.sql.gz

# 4. Verify restore
psql -h localhost -U wire2_user -d wire2 -c "SELECT COUNT(*) FROM \"TransferIntent\";"

# 5. Run migrations (if needed)
npm run db:migrate:deploy

# 6. Restart application
docker-compose -f docker-compose.prod.yml start wire-backend
```

#### Point-in-Time Recovery (PostgreSQL)

For point-in-time recovery, use PostgreSQL WAL archiving:

```bash
# 1. Restore base backup
pg_basebackup -h primary-server -D /var/lib/postgresql/data -U replicator

# 2. Configure recovery.conf
echo "restore_command = 'cp /backups/wal/%f %p'" >> /var/lib/postgresql/data/recovery.conf
echo "recovery_target_time = '2025-12-31 12:00:00'" >> /var/lib/postgresql/data/recovery.conf

# 3. Start PostgreSQL
pg_ctl start -D /var/lib/postgresql/data
```

### Application Deployment Procedure

```bash
# 1. Checkout specific release tag
git checkout v0.1.0

# 2. Build application
cd backend
npm ci
npm run build

# 3. Deploy with docker-compose
docker-compose -f docker-compose.prod.yml up -d --build

# 4. Verify deployment
curl http://localhost:8000/health
curl http://localhost:8000/ready
```

---

## DR Testing

### Test Schedule

- **Monthly:** Database restore test (staging environment)
- **Quarterly:** Full DR drill (complete infrastructure recovery)
- **Annually:** Cross-region failover test

### Test Procedures

1. **Backup Verification Test**
   - Restore latest backup to test database
   - Verify data integrity
   - Run application tests against restored database

2. **Full DR Drill**
   - Simulate infrastructure loss
   - Execute full recovery procedure
   - Measure RTO and RPO
   - Document lessons learned

3. **Failover Test**
   - Test DR site activation
   - Verify DNS failover
   - Test application functionality at DR site

---

## Monitoring and Alerts

### Backup Monitoring

- **Backup Success:** Alert if backup fails
- **Backup Age:** Alert if last backup > 2 hours old
- **Backup Size:** Alert on significant size changes (possible corruption)

### Infrastructure Monitoring

- **Database Health:** Alert on connection failures, query errors
- **Application Health:** Alert on health check failures
- **Disk Space:** Alert on low disk space (< 20% free)

### DR Activation Triggers

- **Manual:** On-call engineer activates DR
- **Automated:** Auto-failover for critical failures (if configured)

---

## Communication Plan

### Internal Communication

- **On-Call:** Primary on-call engineer notified immediately
- **Team:** Engineering team notified within 1 hour
- **Management:** Management notified within 2 hours

### External Communication

- **Customers:** Status page updated with incident details
- **Regulatory:** Notify regulatory bodies if required (data breach scenarios)
- **Vendors:** Notify infrastructure vendors if needed

---

## Post-Disaster Review

After any DR activation:

1. **Incident Report:** Document incident details, timeline, root cause
2. **Recovery Metrics:** Measure actual RTO and RPO vs targets
3. **Lessons Learned:** Identify improvements to DR plan
4. **Action Items:** Create tickets for DR plan improvements
5. **Update Documentation:** Update DR plan based on learnings

---

## DR Site Requirements

### Primary DR Site (Recommended)

- **Location:** Different geographic region from primary
- **Infrastructure:** Equivalent to primary (compute, storage, network)
- **Database:** Standby replica or regular restore capability
- **Network:** Low-latency connection to primary (for replication)

### DR Site Activation

- **Manual Activation:** On-call engineer activates DR site
- **Automated Activation:** Auto-failover for critical failures (optional)
- **DNS Failover:** Update DNS records to point to DR site
- **Monitoring:** Monitor services at DR site

---

## References

- [Backup Scripts](../scripts/backup.sh)
- [Restore Scripts](../scripts/restore.sh)
- [Migration Safety](./MIGRATION_SAFETY.md)
- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)

---

## Appendix: DR Runbook Checklist

### Pre-Disaster Preparation
- [ ] Backups configured and tested
- [ ] DR site provisioned and tested
- [ ] Runbooks documented and accessible
- [ ] On-call rotation established
- [ ] Contact information up-to-date

### During Disaster
- [ ] Assess situation and determine disaster type
- [ ] Activate DR procedures
- [ ] Notify stakeholders
- [ ] Execute recovery steps
- [ ] Monitor recovery progress

### Post-Disaster
- [ ] Verify services restored
- [ ] Run integrity checks
- [ ] Document incident
- [ ] Conduct post-mortem
- [ ] Update DR plan
