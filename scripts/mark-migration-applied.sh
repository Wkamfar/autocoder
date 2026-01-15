#!/usr/bin/env bash
set -euo pipefail

# Quick script to mark a failed migration as applied
# Usage: ./scripts/mark-migration-applied.sh <migration-name>

MIGRATION_NAME="${1:-20240101000000_init}"

echo "Marking migration $MIGRATION_NAME as applied..."

cd "$(dirname "$0")/.."

# Check if .env.production exists
if [[ ! -f .env.production ]]; then
  echo "Error: .env.production not found"
  exit 1
fi

# Run the migration resolve command
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm wire-migrate \
  npx prisma migrate resolve --applied "$MIGRATION_NAME"

echo "Migration $MIGRATION_NAME marked as applied. You can now run migrations again."
