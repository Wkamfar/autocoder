# Migration Safety and Rollback Strategy

**Last Updated:** 2025-12-31  
**Owner:** Agent E (Ops + Prod Hardening)

---

## Overview

This document outlines the migration safety practices, validation procedures, and rollback strategies for WIRE2 database migrations using Prisma.

---

## Migration Workflow

### 1. Development Workflow

```bash
# Create a new migration
npm run db:migrate:dev -- --name add_approval_table

# This will:
# 1. Apply changes to schema.prisma
# 2. Generate SQL migration file
# 3. Apply migration to dev database
# 4. Regenerate Prisma Client
```

### 2. Production Deployment Workflow

```bash
# Deploy migrations (safe, non-destructive)
npm run db:migrate:deploy

# This will:
# 1. Read migration files from prisma/migrations/
# 2. Check migration history in _prisma_migrations table
# 3. Apply only pending migrations
# 4. NOT regenerate Prisma Client (assumes pre-built)
```

---

## Migration Safety Rules

### ✅ Safe Migration Patterns

1. **Additive Changes**
   - Adding new tables
   - Adding nullable columns
   - Adding indexes (non-unique)
   - Adding foreign keys (with proper constraints)

2. **Non-Blocking Changes**
   - Adding computed columns
   - Adding views
   - Adding functions/triggers

3. **Backward-Compatible Changes**
   - Renaming columns (use two-step: add new, migrate data, remove old)
   - Changing column types (ensure data compatibility)

### ⚠️ Risky Migration Patterns (Require Care)

1. **Destructive Changes**
   - Dropping columns (ensure no code references)
   - Dropping tables (ensure no foreign keys)
   - Dropping indexes (may impact performance)

2. **Data-Modifying Changes**
   - Changing NOT NULL constraints (requires data migration)
   - Changing column types (requires data transformation)
   - Adding unique constraints (requires data validation)

3. **Locking Operations**
   - Creating indexes concurrently (use CONCURRENTLY in PostgreSQL)
   - Large table alterations (may lock table)

---

## Pre-Deployment Validation

### 1. Migration Validation Checklist

Before deploying migrations to production:

- [ ] **Review SQL**: Inspect generated SQL in `prisma/migrations/*/migration.sql`
- [ ] **Test in Staging**: Apply migration to staging database first
- [ ] **Backup Database**: Create full backup before migration
- [ ] **Check Dependencies**: Ensure no code changes depend on migration that aren't deployed
- [ ] **Rollback Plan**: Document rollback steps if migration fails
- [ ] **Downtime Assessment**: Determine if migration requires maintenance window

### 2. Automated Validation (CI)

The CI pipeline automatically validates migrations:

```yaml
# .github/workflows/ci.yml
- name: Validate migrations
  run: |
    npm run db:migrate:deploy  # Applies migrations
    npm run db:migrate:status  # Verifies migration state
```

### 3. Manual Validation Script

```bash
# scripts/validate-migrations.sh
#!/bin/bash
set -e

echo "Validating migrations..."

# Check for pending migrations
npx prisma migrate status

# Validate migration SQL syntax (PostgreSQL)
for migration in prisma/migrations/*/migration.sql; do
  echo "Validating $migration..."
  # Use pg_dump --schema-only to validate SQL
  psql -d wire2_test -f "$migration" --dry-run || exit 1
done

echo "Migration validation complete"
```

---

## Rollback Strategies

### Strategy 1: Prisma Migrate Reset (Development Only)

**⚠️ WARNING: Destroys all data. Use only in development.**

```bash
npm run db:migrate:reset
# This will:
# 1. Drop database
# 2. Recreate database
# 3. Apply all migrations
# 4. Run seed script
```

### Strategy 2: Manual SQL Rollback (Production)

Prisma does not generate rollback migrations automatically. For production rollbacks:

1. **Create Rollback Migration Manually**

```sql
-- prisma/migrations/YYYYMMDDHHMMSS_rollback_add_approval_table/migration.sql

-- Example: Rollback adding a column
ALTER TABLE "Approval" DROP COLUMN IF EXISTS "newColumn";

-- Example: Rollback adding a table
DROP TABLE IF EXISTS "Approval" CASCADE;
```

2. **Mark Migration as Rolled Back**

```sql
-- Remove migration record from _prisma_migrations
DELETE FROM "_prisma_migrations" 
WHERE migration_name = 'YYYYMMDDHHMMSS_add_approval_table';
```

3. **Apply Rollback**

```bash
# Apply rollback migration
npx prisma migrate deploy
```

### Strategy 3: Database Backup Restore (Production)

**Fastest rollback for critical failures:**

```bash
# 1. Stop application
docker-compose -f docker-compose.prod.yml stop wire-backend

# 2. Restore from backup
pg_restore -d wire2_prod /backups/wire2_backup_$(date +%Y%m%d_%H%M%S).dump

# 3. Verify database state
npx prisma migrate status

# 4. Restart application
docker-compose -f docker-compose.prod.yml start wire-backend
```

---

## Migration Best Practices

### 1. Naming Conventions

- Use descriptive names: `add_approval_table`, `add_unique_constraint_intent_binding`
- Include date prefix: Prisma auto-generates `YYYYMMDDHHMMSS_` prefix
- Avoid generic names: `update_schema`, `fix_bug`

### 2. Idempotency

- Ensure migrations are idempotent (safe to run multiple times)
- Use `IF NOT EXISTS` / `IF EXISTS` clauses where possible
- Check for existing data before inserting defaults

### 3. Data Migrations

- Separate schema changes from data migrations
- Use transactions for data migrations
- Validate data before and after migration

### 4. Performance Considerations

- Use `CREATE INDEX CONCURRENTLY` for large tables
- Batch large data migrations
- Monitor migration duration in staging

---

## Emergency Procedures

### Migration Failure During Deployment

1. **Stop Deployment**: Immediately halt deployment pipeline
2. **Assess Impact**: Check migration logs and database state
3. **Rollback Decision**:
   - If migration partially applied: Manual SQL rollback
   - If migration not applied: Skip migration, fix issue, redeploy
   - If data corrupted: Restore from backup
4. **Communication**: Notify team and stakeholders
5. **Post-Mortem**: Document root cause and prevention measures

### Database Lock/Timeout

1. **Identify Locking Query**: Check `pg_stat_activity`
2. **Kill Blocking Queries**: `SELECT pg_terminate_backend(pid)`
3. **Retry Migration**: After locks cleared
4. **Consider Maintenance Window**: For large migrations

---

## Monitoring and Alerts

### Migration Status Monitoring

- **Check Migration Status**: `npx prisma migrate status`
- **Alert on Pending Migrations**: Set up alert if migrations pending > 24 hours
- **Alert on Migration Failures**: Monitor CI/CD pipeline failures

### Database Health Checks

- **Connection Pool**: Monitor connection pool exhaustion
- **Query Performance**: Alert on slow queries post-migration
- **Lock Duration**: Alert on long-running locks

---

## References

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL Migration Best Practices](https://www.postgresql.org/docs/current/ddl-alter.html)
- [Database Migration Patterns](https://martinfowler.com/articles/evodb.html)

---

## Appendix: Migration Template

```sql
-- prisma/migrations/YYYYMMDDHHMMSS_descriptive_name/migration.sql

-- Step 1: Add new column (nullable first)
ALTER TABLE "TableName" ADD COLUMN IF NOT EXISTS "newColumn" TEXT;

-- Step 2: Migrate existing data (if needed)
UPDATE "TableName" SET "newColumn" = 'default_value' WHERE "newColumn" IS NULL;

-- Step 3: Add constraint (if needed)
ALTER TABLE "TableName" ALTER COLUMN "newColumn" SET NOT NULL;

-- Step 4: Add index (if needed)
CREATE INDEX IF NOT EXISTS "TableName_newColumn_idx" ON "TableName"("newColumn");
```
