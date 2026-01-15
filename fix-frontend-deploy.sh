#!/bin/bash
# Fix frontend deployment - create network if needed

set -e

echo "🔍 Checking for existing networks..."
docker network ls | grep -E "wire2|wire" || echo "No wire networks found"

# Create the network if it doesn't exist
echo "🌐 Creating wire2-network-prod if needed..."
docker network create wire2-network-prod 2>/dev/null || echo "Network already exists or error occurred"

# Check if wire2 services are running
echo ""
echo "🔍 Checking for running wire2 services..."
docker ps | grep wire2 || echo "No wire2 containers running"

# Deploy frontend
echo ""
echo "🚀 Deploying frontend..."
cd /opt/wire2/frontend

# Stop old container
docker stop wire2-frontend-prod 2>/dev/null || true
docker rm wire2-frontend-prod 2>/dev/null || true

# Run new container
docker run -d \
  --name wire2-frontend-prod \
  --network wire2-network-prod \
  -p 8080:80 \
  --restart unless-stopped \
  wire2-frontend:latest

echo "✅ Frontend deployed!"
echo ""
echo "Verify:"
echo "  docker ps | grep wire2-frontend"
echo "  curl http://localhost:8080/v2/test"
