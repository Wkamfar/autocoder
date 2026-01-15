#!/bin/bash
set -euo pipefail

# Script to check and add FastWire to container's schema

echo "=== Checking FastWire in Container Schema ==="

# Check if FastWire model exists in container's schema
echo "Checking schema.prisma in container..."
docker exec wire2-backend-prod cat /app/prisma/schema.prisma | grep -A 5 "model FastWire" || echo "FastWire model NOT found in container schema"

echo ""
echo "Checking for FastWireStatus enum..."
docker exec wire2-backend-prod cat /app/prisma/schema.prisma | grep -A 5 "enum FastWireStatus" || echo "FastWireStatus enum NOT found in container schema"

echo ""
echo "=== Next Steps ==="
echo ""
echo "The container's schema.prisma doesn't have FastWire yet."
echo "You need to:"
echo ""
echo "1. Update the container with the new schema (rebuild/redeploy)"
echo "   OR"
echo "2. Manually add FastWire to the container's schema.prisma"
echo "   OR"
echo "3. Create the table manually via SQL"
echo ""
