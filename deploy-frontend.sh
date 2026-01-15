#!/bin/bash
# WIRE2 Frontend Deployment Script - Fast Builds
# Deploys frontend separately for faster iteration
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Enable Docker BuildKit
export DOCKER_BUILDKIT=1

echo -e "${GREEN}🎨 Deploying WIRE2 Frontend...${NC}"

cd "$(dirname "$0")/frontend"

# Check if .env.production exists (optional)
if [ -f ".env.production" ]; then
    echo -e "${BLUE}📄 Using .env.production${NC}"
    source .env.production
fi

# Build arguments (can be overridden via environment)
VITE_API_MODE=${VITE_API_MODE:-real}
VITE_API_BASE_URL=${VITE_API_BASE_URL:-https://wire.pose.xyz}
VITE_AUTH_MODE=${VITE_AUTH_MODE:-demo}

echo -e "${BLUE}📦 Building frontend with BuildKit...${NC}"
echo -e "${YELLOW}  API Mode: $VITE_API_MODE${NC}"
echo -e "${YELLOW}  API URL: $VITE_API_BASE_URL${NC}"

# Build the frontend Docker image
docker build \
    --progress=plain \
    --build-arg VITE_API_MODE="$VITE_API_MODE" \
    --build-arg VITE_API_BASE_URL="$VITE_API_BASE_URL" \
    --build-arg VITE_AUTH_MODE="$VITE_AUTH_MODE" \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    -t wire2-frontend:latest \
    -f Dockerfile \
    .

echo -e "${GREEN}✅ Frontend build complete${NC}"
echo ""
echo -e "${BLUE}💡 Next steps:${NC}"
echo "  1. If using Docker: docker run -d -p 8080:80 wire2-frontend:latest"
echo "  2. If using Nginx: Copy dist-wire/ contents to /opt/wire2/frontend/dist-wire/"
echo ""
echo "To extract built files:"
echo "  docker create --name wire-frontend-tmp wire2-frontend:latest"
echo "  docker cp wire-frontend-tmp:/usr/share/nginx/html ./dist-wire"
echo "  docker rm wire-frontend-tmp"
