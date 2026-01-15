#!/bin/bash
# WIRE2 Production Deployment Script - Optimized for Speed
# Uses Docker BuildKit for better caching and parallel builds
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Enable Docker BuildKit for better caching
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo -e "${GREEN}🚀 Deploying WIRE2 to Production (Optimized)...${NC}"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ .env.production not found${NC}"
    echo "Please create .env.production with required environment variables"
    exit 1
fi

# Parse command line arguments
SKIP_BUILD=false
# If SERVICE is empty, we build all services (recommended).
SERVICE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --service)
            SERVICE="$2"
            shift 2
            ;;
        *)
            echo -e "${YELLOW}Unknown option: $1${NC}"
            shift
            ;;
    esac
done

# Build services (with BuildKit cache)
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${BLUE}📦 Building services with BuildKit cache...${NC}"
    
    # Build with cache optimization
    if [ -n "$SERVICE" ]; then
    docker compose \
        --env-file .env.production \
        -f docker-compose.prod.yml \
        build \
        --progress=plain \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        "$SERVICE"
    else
        docker compose \
        --env-file .env.production \
        -f docker-compose.prod.yml \
        build \
        --progress=plain \
        --build-arg BUILDKIT_INLINE_CACHE=1
    fi
    
    echo -e "${GREEN}✅ Build complete${NC}"
else
    echo -e "${YELLOW}⏭️  Skipping build (using existing images)${NC}"
fi

# Start services
echo -e "${BLUE}🚀 Starting services...${NC}"
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres redis

echo -e "${BLUE}🗄️  Running database migrations...${NC}"
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm wire-migrate

echo -e "${BLUE}🚀 Starting application services (backend + worker)...${NC}"
docker compose --env-file .env.production -f docker-compose.prod.yml up -d wire-backend wire-worker

# Wait for services with better health checking
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"

MAX_RETRIES=30
RETRY_COUNT=0
HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
    echo -n "."
done

echo ""

if [ "$HEALTHY" = true ]; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed after ${MAX_RETRIES}s${NC}"
    echo -e "${YELLOW}Checking logs...${NC}"
    docker compose -f docker-compose.prod.yml logs --tail=50 "$SERVICE"
    exit 1
fi

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Backend: http://localhost:8000"
echo "Health: http://localhost:8000/health"
echo ""
echo "View logs:"
echo "  - backend: docker compose -f docker-compose.prod.yml logs -f wire-backend"
echo "  - worker:  docker compose -f docker-compose.prod.yml logs -f wire-worker"
echo ""
echo -e "${BLUE}💡 Tips:${NC}"
echo "  - Use --skip-build to restart without rebuilding"
echo "  - Use --service <name> to deploy specific service"
