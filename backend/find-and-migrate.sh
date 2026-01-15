#!/bin/bash
set -euo pipefail

# Script to find wire2 backend and run Prisma migration for Fast Wire

echo "=== Finding wire2 Backend ==="

# Common locations to check
LOCATIONS=(
  "/opt/wire2/backend"
  "/opt/pose-wire2/backend"
  "/root/wire2/backend"
  "/root/pose-wire2/backend"
  "$(pwd)/backend"
  "$(pwd)"
)

WIRE2_BACKEND=""

# Try to find wire2 backend
for loc in "${LOCATIONS[@]}"; do
  if [ -f "$loc/prisma/schema.prisma" ]; then
    WIRE2_BACKEND="$loc"
    echo "Found wire2 backend at: $WIRE2_BACKEND"
    break
  fi
done

# If not found, try searching
if [ -z "$WIRE2_BACKEND" ]; then
  echo "Searching for wire2 backend..."
  WIRE2_BACKEND=$(find /opt /root -type f -name "schema.prisma" 2>/dev/null | grep -E "(wire2|pose-wire2)" | head -1 | xargs dirname | xargs dirname)
  
  if [ -n "$WIRE2_BACKEND" ] && [ -f "$WIRE2_BACKEND/prisma/schema.prisma" ]; then
    echo "Found wire2 backend at: $WIRE2_BACKEND"
  else
    echo "Error: Could not find wire2 backend with Prisma schema"
    echo ""
    echo "Please either:"
    echo "1. Clone wire2 repository to the server"
    echo "2. Navigate to the wire2/backend directory manually"
    echo "3. Run this script from the wire2/backend directory"
    echo ""
    echo "Common commands:"
    echo "  cd /opt"
    echo "  git clone <wire2-repo-url> wire2"
    echo "  cd wire2/backend"
    echo "  bash find-and-migrate.sh"
    exit 1
  fi
fi

cd "$WIRE2_BACKEND"

echo ""
echo "=== Checking Prisma Schema ==="
if [ ! -f "prisma/schema.prisma" ]; then
  echo "Error: prisma/schema.prisma not found in $WIRE2_BACKEND"
  exit 1
fi

echo "Schema found: prisma/schema.prisma"
echo "Checking for FastWire model..."

if grep -q "model FastWire" prisma/schema.prisma; then
  echo "✓ FastWire model found in schema"
else
  echo "✗ FastWire model not found in schema"
  echo "Make sure you have the latest code with Fast Wire changes"
  exit 1
fi

echo ""
echo "=== Checking Database Connection ==="
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f ".env" ]; then
    echo "Loading DATABASE_URL from .env file..."
    export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
  else
    echo "Error: DATABASE_URL not set and .env file not found"
    echo "Please set DATABASE_URL environment variable or create .env file"
    exit 1
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL still not set"
  exit 1
fi

echo "DATABASE_URL is set (hiding connection string for security)"

echo ""
echo "=== Installing Dependencies ==="
if [ ! -d "node_modules" ]; then
  echo "Installing npm dependencies..."
  npm install
else
  echo "node_modules exists, skipping install"
fi

echo ""
echo "=== Running Prisma Migration ==="
echo "Creating migration: add_fast_wire"
npx prisma migrate dev --name add_fast_wire

echo ""
echo "=== Generating Prisma Client ==="
npx prisma generate

echo ""
echo "=== Migration Complete ==="
echo ""
echo "Next steps:"
echo "1. Restart your wire2 backend service"
echo "2. Test Fast Wire endpoints at /api/fast-wire/*"
echo "3. Verify FastWire table exists in database"
echo ""
echo "To verify:"
echo "  npx prisma studio  # Open Prisma Studio to view data"
echo "  # Or check directly:"
echo "  psql \$DATABASE_URL -c 'SELECT COUNT(*) FROM \"FastWire\";'"
