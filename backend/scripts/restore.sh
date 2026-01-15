#!/bin/bash
# WIRE2 Database Restore Script
# Usage: ./scripts/restore.sh <backup-file>

set -e

if [ -z "$1" ]; then
  echo "ERROR: Backup file required"
  echo "Usage: $0 <backup-file>"
  echo "Example: $0 ./backups/wire2_backup_20251231_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Get database URL from environment or use default
DATABASE_URL="${DATABASE_URL:-postgresql://wire2_user:wire2_password@localhost:5432/wire2}"

echo "WARNING: This will DESTROY all existing data in the database!"
echo "Database: $DATABASE_URL"
echo "Backup file: $BACKUP_FILE"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled"
  exit 0
fi

# Extract connection details from DATABASE_URL
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Set PGPASSWORD for non-interactive password
export PGPASSWORD="$DB_PASS"

echo "Starting database restore..."

# Decompress if needed
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "Decompressing backup file..."
  TEMP_FILE=$(mktemp)
  gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
  BACKUP_FILE="$TEMP_FILE"
fi

# Restore database
psql \
  -h "$DB_HOST" \
  -p "${DB_PORT:-5432}" \
  -U "$DB_USER" \
  -d postgres \
  -f "$BACKUP_FILE"

# Cleanup temp file if created
if [ -n "$TEMP_FILE" ]; then
  rm -f "$TEMP_FILE"
fi

echo "Restore completed successfully"

# Verify restore
echo "Verifying restore..."
psql \
  -h "$DB_HOST" \
  -p "${DB_PORT:-5432}" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"

# Unset password
unset PGPASSWORD

echo "Restore verification complete"
