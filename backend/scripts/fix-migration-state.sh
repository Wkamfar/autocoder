#!/usr/bin/env bash
set -euo pipefail

# Fix Prisma migration state when migrations are stuck
# This script helps resolve P3009 errors (failed migrations)

log() { echo "[fix-migration] $*"; }
fail() { echo "[fix-migration] FAIL: $*" >&2; exit 1; }

# Check if DATABASE_URL is set
if [[ -z "${DATABASE_URL:-}" ]]; then
  fail "DATABASE_URL environment variable not set"
fi

log "Checking migration state..."

# Check if there are failed migrations
FAILED_MIGRATIONS=$(npx prisma migrate status --schema=./prisma/schema.prisma 2>&1 | grep -i "failed" || true)

if [[ -z "$FAILED_MIGRATIONS" ]]; then
  log "No failed migrations found. Checking status..."
  npx prisma migrate status --schema=./prisma/schema.prisma
  exit 0
fi

log "Found failed migrations. Attempting to resolve..."

# Option 1: Mark failed migration as applied (if it actually succeeded)
# This is safe if the migration actually completed but Prisma thinks it failed
log "Attempting to mark failed migration as applied..."

# Get the failed migration name
FAILED_MIGRATION=$(npx prisma migrate status --schema=./prisma/schema.prisma 2>&1 | grep -oP 'migration \K[^\s]+' | head -1 || echo "")

if [[ -n "$FAILED_MIGRATIONS" ]]; then
  log "Failed migration detected. Checking if tables exist..."
  
  # Check if the database actually has the tables (migration might have succeeded)
  TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT LIKE '_prisma%';" 2>/dev/null || echo "0")
  
  if [[ "$TABLE_COUNT" -gt "0" ]]; then
    log "Database has tables. Migration likely succeeded but Prisma state is wrong."
    log "Marking migration as applied..."
    
    # Get the failed migration ID
    FAILED_ID=$(psql "$DATABASE_URL" -t -c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1;" 2>/dev/null | xargs || echo "")
    
    if [[ -n "$FAILED_ID" ]]; then
      log "Resolving migration: $FAILED_ID"
      npx prisma migrate resolve --applied "$FAILED_ID" --schema=./prisma/schema.prisma || {
        log "Could not resolve with migrate resolve. Trying manual fix..."
        
        # Manual fix: mark migration as applied in database
        psql "$DATABASE_URL" -c "UPDATE _prisma_migrations SET finished_at = NOW(), logs = 'Manually resolved - migration actually succeeded' WHERE migration_name = '$FAILED_ID' AND finished_at IS NULL;" || true
      }
    fi
  else
    log "Database appears empty. Migration likely actually failed."
    log "Attempting to rollback and re-run..."
    
    # Rollback the failed migration
    FAILED_ID=$(psql "$DATABASE_URL" -t -c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1;" 2>/dev/null | xargs || echo "")
    
    if [[ -n "$FAILED_ID" ]]; then
      log "Rolling back failed migration: $FAILED_ID"
      npx prisma migrate resolve --rolled-back "$FAILED_ID" --schema=./prisma/schema.prisma || {
        # Manual rollback
        psql "$DATABASE_URL" -c "DELETE FROM _prisma_migrations WHERE migration_name = '$FAILED_ID' AND finished_at IS NULL;" || true
      }
    fi
  fi
fi

log "Re-running migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

log "Migration state fixed!"
