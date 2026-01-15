# Quick Fix for Failed Migration Error

## Problem

You're seeing this error:
```
Error: P3009
migrate found failed migrations in the target database, new migrations will not be applied.
The `20240101000000_init` migration started at ... failed
```

## Quick Fix (Run on Droplet)

```bash
cd /opt/wire2
bash scripts/fix-failed-migration.sh
```

This script will:
1. Check if the migration actually succeeded (by checking if tables exist)
2. If tables exist: Mark the migration as applied (Prisma state was wrong)
3. If tables don't exist: Roll back the failed migration
4. Re-run all migrations

## Manual Fix (If Script Doesn't Work)

```bash
cd /opt/wire2

# Run inside migration container
docker compose -f docker-compose.prod.yml run --rm wire-migrate bash

# Inside the container:
cd /app

# Check what failed
psql "$DATABASE_URL" -c "SELECT migration_name, started_at, finished_at FROM _prisma_migrations WHERE finished_at IS NULL;"

# If migration actually succeeded (tables exist), mark it as applied:
FAILED_ID="20240101000000_init"  # Replace with actual migration name
npx prisma migrate resolve --applied "$FAILED_ID" --schema=./prisma/schema.prisma

# Or if migration actually failed, roll it back:
npx prisma migrate resolve --rolled-back "$FAILED_ID" --schema=./prisma/schema.prisma

# Then re-run migrations
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Exit container
exit
```

## After Fix

Once the migration is fixed, continue with deployment:

```bash
cd /opt/wire2
bash scripts/deploy_prod_droplet.sh
```

The updated deployment script will now automatically detect and fix failed migrations in the future.
