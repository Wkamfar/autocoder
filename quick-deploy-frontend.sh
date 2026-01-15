#!/bin/bash
# Quick script to rebuild and deploy wire2 frontend with /test route

set -e

cd "$(dirname "$0")/frontend"

echo "🔨 Building frontend..."
docker build -t wire2-frontend:latest -f Dockerfile .

echo "🛑 Stopping old container..."
docker stop wire2-frontend-prod 2>/dev/null || true
docker rm wire2-frontend-prod 2>/dev/null || true

echo "🚀 Starting new container..."
docker run -d \
  --name wire2-frontend-prod \
  --network wire2-network-prod \
  -p 8080:80 \
  --restart unless-stopped \
  wire2-frontend:latest

echo "✅ Frontend deployed!"
echo "   Test at: http://localhost:8080/v2/test"
echo ""
echo "To verify the route is in the build:"
echo "  docker exec wire2-frontend-prod grep -i 'WireFastWireTestPage' /usr/share/nginx/html/assets/*.js | head -1"
