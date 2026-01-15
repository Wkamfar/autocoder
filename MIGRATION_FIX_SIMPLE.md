# Simple Migration Fix - Run on Droplet

## Option 1: Interactive Fix (Recommended)

```bash
cd /opt/wire2

# Start an interactive shell in the migration container
docker compose -f docker-compose.prod.yml run --rm wire-migrate sh

# Then inside the container, run these commands one by one:
cd /app

# Check for failed migrations
FAILED_ID=$(psql "$DATABASE_URL" -t -c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1;" 2>/dev/null | xargs || echo '')

# If no failed migration, exit
if [ -z "$FAILED_ID" ]; then
  echo "No failed migrations found."
  exit 0
fi

echo "Found failed migration: $FAILED_ID"

# Check if tables exist
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT LIKE '_prisma%';" 2>/dev/null | xargs || echo '0')

echo "Database has $TABLE_COUNT tables"

# If tables exist, mark migration as applied
if [ "$TABLE_COUNT" -gt "5" ]; then
  echo "Marking migration as applied..."
  npx prisma migrate resolve --applied "$FAILED_ID" --schema=./prisma/schema.prisma || \
  psql "$DATABASE_URL" -c "UPDATE _prisma_migrations SET finished_at = NOW(), logs = 'Manually resolved' WHERE migration_name = '$FAILED_ID' AND finished_at IS NULL;" || true
else
  echo "Rolling back failed migration..."
  npx prisma migrate resolve --rolled-back "$FAILED_ID" --schema=./prisma/schema.prisma || \
  psql "$DATABASE_URL" -c "DELETE FROM _prisma_migrations WHERE migration_name = '$FAILED_ID' AND finished_at IS NULL;" || true
fi

# Re-run migrations
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Exit container
exit
```

## Option 2: One-liner with sh

```bash
cd /opt/wire2

docker compose -f docker-compose.prod.yml run --rm wire-migrate sh -c 'cd /app && FAILED_ID=$(psql "$DATABASE_URL" -t -c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1;" 2>/dev/null | xargs || echo "") && if [ -z "$FAILED_ID" ]; then echo "No failed migrations"; exit 0; fi && echo "Found: $FAILED_ID" && TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '\''public'\'' AND table_name NOT LIKE '\''_prisma%'\'';" 2>/dev/null | xargs || echo "0") && echo "Tables: $TABLE_COUNT" && if [ "$TABLE_COUNT" -gt "5" ]; then npx prisma migrate resolve --applied "$FAILED_ID" --schema=./prisma/schema.prisma || psql "$DATABASE_URL" -c "UPDATE _prisma_migrations SET finished_at = NOW() WHERE migration_name = '\''$FAILED_ID'\'' AND finished_at IS NULL;"; else npx prisma migrate resolve --rolled-back "$FAILED_ID" --schema=./prisma/schema.prisma || psql "$DATABASE_URL" -c "DELETE FROM _prisma_migrations WHERE migration_name = '\''$FAILED_ID'\'' AND finished_at IS NULL;"; fi && npx prisma migrate deploy --schema=./prisma/schema.prisma'
```

## Option 3: Use the existing backend container

If the backend container is running, you can exec into it:

```bash
cd /opt/wire2

docker exec -it wire2-backend-prod sh -c 'cd /app && FAILED_ID=$(psql "$DATABASE_URL" -t -c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1;" 2>/dev/null | xargs || echo "") && if [ -z "$FAILED_ID" ]; then echo "No failed migrations"; exit 0; fi && echo "Found: $FAILED_ID" && TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '\''public'\'' AND table_name NOT LIKE '\''_prisma%'\'';" 2>/dev/null | xargs || echo "0") && if [ "$TABLE_COUNT" -gt "5" ]; then npx prisma migrate resolve --applied "$FAILED_ID" --schema=./prisma/schema.prisma || psql "$DATABASE_URL" -c "UPDATE _prisma_migrations SET finished_at = NOW() WHERE migration_name = '\''$FAILED_ID'\'' AND finished_at IS NULL;"; else npx prisma migrate resolve --rolled-back "$FAILED_ID" --schema=./prisma/schema.prisma || psql "$DATABASE_URL" -c "DELETE FROM _prisma_migrations WHERE migration_name = '\''$FAILED_ID'\'' AND finished_at IS NULL;"; fi && npx prisma migrate deploy --schema=./prisma/schema.prisma'
```
