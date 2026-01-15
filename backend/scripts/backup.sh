#!/bin/bash
# WIRE2 Database Backup Script
# Usage: ./scripts/backup.sh [backup-dir]

set -e

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/wire2_backup_${TIMESTAMP}.sql"
BACKUP_FILE_COMPRESSED="${BACKUP_FILE}.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Get database URL from environment or use default
DATABASE_URL="${DATABASE_URL:-postgresql://wire2_user:wire2_password@localhost:5432/wire2}"

echo "Starting database backup..."
echo "Database: $DATABASE_URL"
echo "Backup file: $BACKUP_FILE_COMPRESSED"

# Extract connection details from DATABASE_URL
# Format: postgresql://user:password@host:port/database
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Set PGPASSWORD for non-interactive password
export PGPASSWORD="$DB_PASS"

# Perform backup using pg_dump
pg_dump \
  -h "$DB_HOST" \
  -p "${DB_PORT:-5432}" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --clean \
  --if-exists \
  --create \
  --format=plain \
  --no-owner \
  --no-acl \
  > "$BACKUP_FILE"

# Compress backup
gzip -f "$BACKUP_FILE"

echo "Backup completed: $BACKUP_FILE_COMPRESSED"

# Verify backup file exists and is not empty
if [ ! -s "$BACKUP_FILE_COMPRESSED" ]; then
  echo "ERROR: Backup file is empty or does not exist"
  exit 1
fi

# Get backup file size
BACKUP_SIZE=$(du -h "$BACKUP_FILE_COMPRESSED" | cut -f1)
echo "Backup size: $BACKUP_SIZE"

# Cleanup old backups (keep last 30 days)
echo "Cleaning up old backups (keeping last 30 days)..."
find "$BACKUP_DIR" -name "wire2_backup_*.sql.gz" -type f -mtime +30 -delete

# List remaining backups
echo "Remaining backups:"
ls -lh "$BACKUP_DIR"/wire2_backup_*.sql.gz 2>/dev/null || echo "No backups found"

# Unset password
unset PGPASSWORD

echo "Backup process complete"
