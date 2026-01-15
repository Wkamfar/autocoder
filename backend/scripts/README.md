# WIRE2 Backend Scripts

This directory contains operational scripts for the WIRE2 backend.

## Available Scripts

### Backup Script (`backup.sh`)

Automated database backup script.

**Usage:**
```bash
./scripts/backup.sh [backup-dir]
```

**Example:**
```bash
# Backup to default location (./backups)
./scripts/backup.sh

# Backup to custom location
./scripts/backup.sh /var/backups/wire2
```

**Features:**
- Creates compressed SQL dumps
- Automatic cleanup of backups older than 30 days
- Backup verification
- Timestamped backup files

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string (defaults to local dev database)

**Cron Example:**
```bash
# Run hourly backups
0 * * * * /path/to/wire2/backend/scripts/backup.sh /backups/wire2
```

---

### Restore Script (`restore.sh`)

Database restore script for disaster recovery.

**Usage:**
```bash
./scripts/restore.sh <backup-file>
```

**Example:**
```bash
./scripts/restore.sh ./backups/wire2_backup_20251231_120000.sql.gz
```

**⚠️ WARNING:** This script will destroy all existing data in the database!

**Features:**
- Supports compressed (.gz) and uncompressed backups
- Interactive confirmation prompt
- Post-restore verification

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string (defaults to local dev database)

---

### SBOM Generation Script (`generate-sbom.sh`)

Generate Software Bill of Materials (SBOM) for dependency tracking.

**Usage:**
```bash
./scripts/generate-sbom.sh [output-dir]
```

**Example:**
```bash
# Generate SBOM to default location (./sbom)
./scripts/generate-sbom.sh

# Generate SBOM to custom location
./scripts/generate-sbom.sh /reports/sbom
```

**Features:**
- Generates SBOM in CycloneDX format
- Supports multiple SBOM generators (CycloneDX, Syft)
- Timestamped output files

**Requirements:**
- Node.js and npm installed
- Optional: `cyclonedx` CLI or `@cyclonedx/cyclonedx-npm` npm package
- Optional: `syft` CLI for additional SBOM generation

---

## Script Permissions

All scripts are executable. If you encounter permission errors:

```bash
chmod +x scripts/*.sh
```

---

## Integration with CI/CD

These scripts are integrated into the CI/CD pipeline:

- **Backup:** Can be scheduled via cron or CI workflow
- **SBOM Generation:** Automated in `.github/workflows/security-scan.yml`
- **Restore:** Manual operation for disaster recovery

---

## Troubleshooting

### Backup Script Issues

**Problem:** Backup fails with connection error
- **Solution:** Verify `DATABASE_URL` environment variable is set correctly
- **Solution:** Ensure PostgreSQL is running and accessible

**Problem:** Backup file is empty
- **Solution:** Check PostgreSQL user has read permissions
- **Solution:** Verify database exists and is accessible

### Restore Script Issues

**Problem:** Restore fails with permission error
- **Solution:** Ensure PostgreSQL user has CREATE DATABASE permission
- **Solution:** Check backup file is readable and not corrupted

**Problem:** Restore partially completes
- **Solution:** Check PostgreSQL logs for errors
- **Solution:** Verify backup file integrity

### SBOM Generation Issues

**Problem:** SBOM generation fails
- **Solution:** Ensure `package-lock.json` exists
- **Solution:** Run `npm install` before generating SBOM
- **Solution:** Install optional dependencies (`@cyclonedx/cyclonedx-npm`)

---

## References

- [Migration Safety Guide](../docs/MIGRATION_SAFETY.md)
- [Disaster Recovery Plan](../docs/DISASTER_RECOVERY.md)
- [SLOs and Alerting Plan](../docs/SLOS_AND_ALERTING.md)
