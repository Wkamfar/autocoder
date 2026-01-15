#!/usr/bin/env bash
# Quick fix for failed Prisma migrations
# Run this on the droplet to fix the P3009 error

set -e

cd /opt/wire2

echo "=== Fixing Failed Migration ==="

# Load environment
source .env.production || true
export DATABASE_URL="postgresql://${POSTGRES_USER:-wire2_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-wire2}?schema=public"

echo "Checking migration state..."

# Run inside the migration container
docker compose -f docker-compose.prod.yml run --rm wire-migrate bash -c "
  cd /app
  
  echo 'Checking for failed migrations...'
  
  # Get the failed migration ID
  FAILED_ID=\$(psql \"\$DATABASE_URL\" -t -c \"SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1;\" 2>/dev/null | xargs || echo '')
  
  if [ -z \"\$FAILED_ID\" ]; then
    echo 'No failed migrations found in database.'
    exit 0
  fi
  
  echo \"Found failed migration: \$FAILED_ID\"
  
  # Check if database actually has tables (migration might have succeeded)
  TABLE_COUNT=\$(psql \"\$DATABASE_URL\" -t -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT LIKE '_prisma%';\" 2>/dev/null | xargs || echo '0')
  
  echo \"Database has \$TABLE_COUNT tables\"
  
  if [ \"\$TABLE_COUNT\" -gt \"5\" ]; then
    echo \"Database has tables - migration likely succeeded but Prisma state is wrong\"
    echo \"Marking migration as applied...\"
    
    # Try Prisma resolve first
    npx prisma migrate resolve --applied \"\$FAILED_ID\" --schema=./prisma/schema.prisma 2>&1 || {
      echo \"Prisma resolve failed, trying manual fix...\"
      psql \"\$DATABASE_URL\" -c \"UPDATE _prisma_migrations SET finished_at = NOW(), logs = 'Manually resolved - migration actually succeeded' WHERE migration_name = '\$FAILED_ID' AND finished_at IS NULL;\" || true
    }
    
    echo \"Migration marked as applied\"
  else
    echo \"Database appears empty - migration actually failed\"
    echo \"Rolling back failed migration...\"
    
    # Try Prisma resolve first
    npx prisma migrate resolve --rolled-back \"\$FAILED_ID\" --schema=./prisma/schema.prisma 2>&1 || {
      echo \"Prisma resolve failed, trying manual rollback...\"
      psql \"\$DATABASE_URL\" -c \"DELETE FROM _prisma_migrations WHERE migration_name = '\$FAILED_ID' AND finished_at IS NULL;\" || true
    }
    
    echo \"Failed migration rolled back\"
  fi
  
  echo ''
  echo 'Re-running migrations...'
  npx prisma migrate deploy --schema=./prisma/schema.prisma
"

echo ""
echo "=== Migration Fix Complete ==="
echo "You can now re-run the deployment script:"
echo "  bash scripts/deploy_prod_droplet.sh"
