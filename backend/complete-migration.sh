#!/bin/bash
set -euo pipefail

# Complete migration script for Fast Wire
# Run this from /opt/wire2/backend

echo "=== Fast Wire Prisma Migration ==="
echo ""

# Check if we're in the right directory
if [ ! -f "prisma/schema.prisma" ]; then
  echo "Error: prisma/schema.prisma not found"
  echo "Please run this script from /opt/wire2/backend"
  exit 1
fi

echo "✓ Found Prisma schema"

# Check for DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
  echo ""
  echo "DATABASE_URL not set. Checking for .env file..."
  
  if [ -f ".env" ]; then
    echo "Loading DATABASE_URL from .env file..."
    set -a
    source .env
    set +a
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo ""
  echo "ERROR: DATABASE_URL is not set"
  echo ""
  echo "Please set it using one of these methods:"
  echo ""
  echo "Method 1: Export environment variable"
  echo "  export DATABASE_URL='postgresql://user:pass@host:5432/database'"
  echo ""
  echo "Method 2: Create/update .env file"
  echo "  echo 'DATABASE_URL=postgresql://user:pass@host:5432/database' >> .env"
  echo ""
  echo "Method 3: Check your docker-compose.yml"
  echo "  cd /opt/pose-core && grep DATABASE_URL docker-compose*.yml"
  echo ""
  echo "Example DATABASE_URL formats:"
  echo "  postgresql://postgres:postgres@localhost:5432/wire2"
  echo "  postgresql://user:password@db-host:5432/wire2"
  echo ""
  exit 1
fi

echo "✓ DATABASE_URL is set (hidden for security)"

# Test database connection
echo ""
echo "Testing database connection..."
if ! npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
  echo "⚠ Warning: Could not verify database connection"
  echo "Continuing anyway..."
else
  echo "✓ Database connection verified"
fi

# Check if FastWire model exists in schema
if ! grep -q "model FastWire" prisma/schema.prisma; then
  echo ""
  echo "ERROR: FastWire model not found in schema.prisma"
  echo "Make sure you have the latest code with Fast Wire changes"
  exit 1
fi

echo "✓ FastWire model found in schema"

# Run migration
echo ""
echo "=== Running Prisma Migration ==="
npx prisma migrate dev --name add_fast_wire || {
  echo ""
  echo "Migration failed. Common issues:"
  echo "1. Database connection failed - check DATABASE_URL"
  echo "2. Migration conflicts - check prisma/migrations/ directory"
  echo "3. Database permissions - ensure user has CREATE TABLE permissions"
  exit 1
}

echo ""
echo "=== Generating Prisma Client ==="
npx prisma generate

echo ""
echo "=== Migration Complete ==="
echo ""
echo "Next steps:"
echo "1. Restart your wire2 backend service"
echo "2. Verify FastWire table exists:"
echo "   npx prisma studio"
echo "   # Or directly:"
echo "   psql \$DATABASE_URL -c '\\dt \"FastWire\"'"
echo ""
echo "Fast Wire endpoints are now available at:"
echo "  POST /api/fast-wire/request"
echo "  GET  /api/fast-wire/:token"
echo "  POST /api/fast-wire/:token/approve"
echo "  POST /api/fast-wire/verify-email"
echo ""
