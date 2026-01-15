#!/bin/bash
set -euo pipefail

# Script to run Prisma migration from Docker container or with correct database URL

echo "=== Fast Wire Prisma Migration ==="
echo ""

cd /opt/wire2/backend

# Check if PostgreSQL port is exposed
echo "Checking if PostgreSQL port is exposed..."
if netstat -tlnp 2>/dev/null | grep -q ":5432 " || ss -tlnp 2>/dev/null | grep -q ":5432 "; then
  echo "✓ PostgreSQL port 5432 is exposed"
  EXPOSED_PORT=true
else
  echo "✗ PostgreSQL port 5432 is not exposed"
  EXPOSED_PORT=false
fi

# Check for wire2 backend Docker container
cd /opt/pose-core
WIRE2_CONTAINER=$(docker ps --format "{{.Names}}" | grep -E "wire2|backend" | head -1 || echo "")

if [ -n "$WIRE2_CONTAINER" ]; then
  echo ""
  echo "Found wire2 backend container: $WIRE2_CONTAINER"
  echo ""
  echo "=== Option 1: Run Migration Inside Docker Container ==="
  echo ""
  echo "Run this command:"
  echo "  docker compose exec $WIRE2_CONTAINER npx prisma migrate dev --name add_fast_wire"
  echo ""
  echo "Or:"
  echo "  docker exec -it $WIRE2_CONTAINER npx prisma migrate dev --name add_fast_wire"
  echo ""
fi

if [ "$EXPOSED_PORT" = true ]; then
  echo "=== Option 2: Run Migration from Host (port exposed) ==="
  echo ""
  echo "Set DATABASE_URL and run:"
  echo "  cd /opt/wire2/backend"
  echo "  export DATABASE_URL='postgresql://wire2_user:wire2_password@localhost:5432/wire2?schema=public'"
  echo "  npx prisma migrate dev --name add_fast_wire"
  echo ""
fi

# Get database credentials from docker-compose
cd /opt/pose-core
DB_USER=$(grep -E "POSTGRES_USER|POSTGRES_USER:-" docker-compose*.yml 2>/dev/null | head -1 | sed 's/.*POSTGRES_USER:-\([^}]*\).*/\1/' | sed 's/.*POSTGRES_USER.*: *\([^@]*\).*/\1/' | tr -d ' ' || echo "wire2_user")
DB_PASS=$(grep -E "POSTGRES_PASSWORD" docker-compose*.yml 2>/dev/null | head -1 | sed 's/.*POSTGRES_PASSWORD.*: *\([^ ]*\).*/\1/' | tr -d ' ' || echo "wire2_password")
DB_NAME=$(grep -E "POSTGRES_DB|POSTGRES_DB:-" docker-compose*.yml 2>/dev/null | head -1 | sed 's/.*POSTGRES_DB:-\([^}]*\).*/\1/' | sed 's/.*POSTGRES_DB.*: *\([^@]*\).*/\1/' | tr -d ' ' || echo "wire2")

echo "=== Database Credentials from docker-compose ==="
echo "User: $DB_USER"
echo "Database: $DB_NAME"
echo "Password: (check docker-compose files or .env)"
echo ""

# Try to find network name
NETWORK=$(docker inspect $(docker ps | grep postgres | awk '{print $1}' | head -1) 2>/dev/null | grep -A 20 Networks | grep NetworkMode | head -1 | sed 's/.*"\(.*\)".*/\1/' || echo "")

if [ -n "$NETWORK" ]; then
  echo "=== Option 3: Use Docker Network ==="
  echo "Network: $NETWORK"
  echo ""
  echo "Create a temporary container:"
  echo "  docker run --rm -it --network $NETWORK \\"
  echo "    -v /opt/wire2/backend:/app \\"
  echo "    -w /app \\"
  echo "    node:20 \\"
  echo "    sh -c \"npm install && DATABASE_URL='postgresql://$DB_USER:$DB_PASS@postgres:5432/$DB_NAME?schema=public' npx prisma migrate dev --name add_fast_wire\""
  echo ""
fi

echo "=== Recommended Next Steps ==="
echo ""
if [ -n "$WIRE2_CONTAINER" ]; then
  echo "1. Try running migration inside the container:"
  echo "   docker compose exec $WIRE2_CONTAINER npx prisma migrate dev --name add_fast_wire"
  echo ""
elif [ "$EXPOSED_PORT" = true ]; then
  echo "1. Use exposed port with localhost:"
  echo "   cd /opt/wire2/backend"
  echo "   export DATABASE_URL='postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public'"
  echo "   npx prisma migrate dev --name add_fast_wire"
  echo ""
else
  echo "1. Check if PostgreSQL container is running:"
  echo "   docker ps | grep postgres"
  echo ""
  echo "2. Check if port is exposed in docker-compose:"
  echo "   grep -A 5 'postgres:' docker-compose*.yml | grep '5432:5432'"
  echo ""
fi
