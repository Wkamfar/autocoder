#!/usr/bin/env bash
set -euo pipefail

# Production deploy for wire.pose.xyz (runs on the droplet)
# - Pulls latest code from GitHub (origin/main)
# - Keeps secrets out of git by using /etc/wire2/.env.production as source of truth
# - Ensures /opt/wire2 matches origin/main
# - Brings up docker compose (postgres/redis/backend/worker)
# - Runs database migrations safely
# - Builds & deploys frontend static bundle to /opt/wire2/frontend/dist-wire
# - Installs a safe nginx config for /v2/* + /api/* and reloads nginx
# - Emits a deployment fingerprint and runs a health check

WIRE2_PATH="${WIRE2_PATH:-/opt/wire2}"
ENV_SOURCE="${ENV_SOURCE:-/etc/wire2/.env.production}"
BRANCH="${BRANCH:-main}"
BASE_URL="${BASE_URL:-https://wire.pose.xyz}"
# Use HTTPS by default (works without SSH keys)
# If GITHUB_TOKEN is set, use it for authentication
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  GITHUB_REPO="${GITHUB_REPO:-https://${GITHUB_TOKEN}@github.com/a0ix/wire.git}"
else
  GITHUB_REPO="${GITHUB_REPO:-https://github.com/a0ix/wire.git}"
fi

log() { echo "[wire2-deploy] $(date '+%Y-%m-%d %H:%M:%S') $*"; }
fail() { echo "[wire2-deploy] FAIL: $*" >&2; exit 1; }
warn() { echo "[wire2-deploy] WARN: $*" >&2; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"; }

require_cmd docker
require_cmd nginx
require_cmd git

if [[ ! -d "$WIRE2_PATH" ]]; then
  fail "WIRE2_PATH not found: $WIRE2_PATH"
fi

cd "$WIRE2_PATH"

# ============================================================================
# STEP 1: Ensure we have a git repo and pull latest from GitHub
# ============================================================================
log "STEP 1: Pulling latest code from GitHub"

if [[ ! -d .git ]]; then
  log "No .git directory found. Initializing git repo..."
  git init
  git remote add origin "$GITHUB_REPO" 2>/dev/null || git remote set-url origin "$GITHUB_REPO"
  git fetch origin
  git checkout -b "$BRANCH" "origin/$BRANCH" || git checkout "$BRANCH"
else
  log "Git repo found. Fetching and pulling latest..."
  git remote set-url origin "$GITHUB_REPO" 2>/dev/null || true
  git fetch origin "$BRANCH"
  
  # Check if we have local changes
  if ! git diff-index --quiet HEAD --; then
    warn "Local changes detected. Stashing them..."
    git stash save "Deployment stash $(date '+%Y%m%d-%H%M%S')"
  fi
  
  # Reset to match origin/main exactly (no local modifications)
  git reset --hard "origin/$BRANCH"
  git clean -fd
fi

log "Current commit: $(git rev-parse HEAD)"
log "Current branch: $(git branch --show-current)"

# ============================================================================
# STEP 2: Validate environment file exists
# ============================================================================
log "STEP 2: Validating environment configuration"

if [[ ! -f "$ENV_SOURCE" ]]; then
  if [[ -f "$WIRE2_PATH/.env.production" ]]; then
    log "ENV_SOURCE missing; seeding it from existing $WIRE2_PATH/.env.production"
    mkdir -p "$(dirname "$ENV_SOURCE")"
    cp -av "$WIRE2_PATH/.env.production" "$ENV_SOURCE"
  else
    fail "missing $ENV_SOURCE (and no $WIRE2_PATH/.env.production to seed from)"
  fi
fi

# Validate critical environment variables
source "$ENV_SOURCE" || true
if [[ -z "${DATABASE_URL:-}" && -z "${POSTGRES_PASSWORD:-}" ]]; then
  fail "DATABASE_URL or POSTGRES_PASSWORD must be set in $ENV_SOURCE"
fi

log "install env into repo working dir (for docker compose)"
cp -av "$ENV_SOURCE" "$WIRE2_PATH/.env.production"

# ============================================================================
# STEP 3: Ensure Docker network exists
# ============================================================================
log "STEP 3: Ensuring Docker network exists"
docker network create wire2-network-prod 2>/dev/null || log "Network already exists"

# ============================================================================
# STEP 4: Start database and cache
# ============================================================================
log "STEP 4: Starting database and cache services"
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres redis

# Wait for postgres to be ready
log "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  if docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres pg_isready -U "${POSTGRES_USER:-wire2_user}" -d "${POSTGRES_DB:-wire2}" >/dev/null 2>&1; then
    log "PostgreSQL is ready"
    break
  fi
  sleep 1
  if [[ "$i" == "30" ]]; then
    fail "PostgreSQL did not become ready"
  fi
done

# Wait for redis to be ready
log "Waiting for Redis to be ready..."
for i in $(seq 1 30); do
  if docker compose --env-file .env.production -f docker-compose.prod.yml exec -T redis redis-cli ping >/dev/null 2>&1; then
    log "Redis is ready"
    break
  fi
  sleep 1
  if [[ "$i" == "30" ]]; then
    fail "Redis did not become ready"
  fi
done

# ============================================================================
# STEP 5: Run database migrations
# ============================================================================
log "STEP 5: Running database migrations"

# Build the migration image first
log "Building migration image..."
docker compose --env-file .env.production -f docker-compose.prod.yml build wire-migrate

# Check migration status first
log "Checking migration status..."
MIGRATION_STATUS=$(docker compose --env-file .env.production -f docker-compose.prod.yml run --rm wire-migrate npx prisma migrate status --schema=./prisma/schema.prisma 2>&1 || true)

if echo "$MIGRATION_STATUS" | grep -qi "failed"; then
  log "WARNING: Found failed migrations. Attempting to fix..."
  
  # Try to fix failed migrations
  if docker compose --env-file .env.production -f docker-compose.prod.yml run --rm wire-migrate bash -c "
    cd /app && \
    FAILED_ID=\$(psql \"\$DATABASE_URL\" -t -c \"SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1;\" 2>/dev/null | xargs || echo '') && \
    if [ -n \"\$FAILED_ID\" ]; then
      echo \"Resolving failed migration: \$FAILED_ID\"
      # Check if tables exist (migration might have actually succeeded)
      TABLE_COUNT=\$(psql \"\$DATABASE_URL\" -t -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT LIKE '_prisma%';\" 2>/dev/null | xargs || echo '0')
      if [ \"\$TABLE_COUNT\" -gt \"0\" ]; then
        echo \"Database has tables - marking migration as applied\"
        npx prisma migrate resolve --applied \"\$FAILED_ID\" --schema=./prisma/schema.prisma || \
        psql \"\$DATABASE_URL\" -c \"UPDATE _prisma_migrations SET finished_at = NOW(), logs = 'Manually resolved' WHERE migration_name = '\$FAILED_ID' AND finished_at IS NULL;\" || true
      else
        echo \"Database empty - rolling back failed migration\"
        npx prisma migrate resolve --rolled-back \"\$FAILED_ID\" --schema=./prisma/schema.prisma || \
        psql \"\$DATABASE_URL\" -c \"DELETE FROM _prisma_migrations WHERE migration_name = '\$FAILED_ID' AND finished_at IS NULL;\" || true
      fi
    fi
  "; then
    log "Migration state fixed. Continuing..."
  else
    warn "Could not automatically fix migration state. Manual intervention may be required."
  fi
fi

# Run migrations with proper error handling
log "Executing migrations..."
if ! docker compose --env-file .env.production -f docker-compose.prod.yml run --rm wire-migrate; then
  log "Migration failed. Checking status..."
  docker compose --env-file .env.production -f docker-compose.prod.yml run --rm wire-migrate npx prisma migrate status --schema=./prisma/schema.prisma || true
  docker compose --env-file .env.production -f docker-compose.prod.yml logs wire-migrate || true
  fail "Database migration failed. See logs above for details."
fi

log "Migrations completed successfully"

# ============================================================================
# STEP 6: Build and start backend + worker
# ============================================================================
log "STEP 6: Building and starting backend + worker"

# Build backend image
log "Building backend image..."
docker compose --env-file .env.production -f docker-compose.prod.yml build wire-backend wire-worker

# Start backend and worker
log "Starting backend and worker..."
docker compose --env-file .env.production -f docker-compose.prod.yml up -d wire-backend wire-worker

# ============================================================================
# STEP 7: Wait for backend health
# ============================================================================
log "STEP 7: Waiting for backend to become healthy"

for i in $(seq 1 60); do
  # Try both health endpoints (root and wire-specific)
  if curl -fsS --max-time 3 http://127.0.0.1:8000/health >/dev/null 2>&1 || \
     curl -fsS --max-time 3 http://127.0.0.1:8000/api/wire/health >/dev/null 2>&1; then
    log "Backend is healthy"
    break
  fi
  sleep 2
  if [[ "$i" == "60" ]]; then
    log "Backend health check failed. Checking logs..."
    docker compose --env-file .env.production -f docker-compose.prod.yml ps || true
    docker logs --tail 200 wire2-backend-prod || true
    fail "Backend did not become healthy after 120 seconds"
  fi
done

# Additional readiness check
log "Checking backend readiness endpoint..."
if ! curl -fsS --max-time 5 http://127.0.0.1:8000/api/wire/health/ready >/dev/null 2>&1; then
  warn "Backend readiness check failed, but health check passed. Continuing..."
fi

# ============================================================================
# STEP 8: Build and deploy frontend
# ============================================================================
log "STEP 8: Building and deploying frontend"

# Build frontend
if [[ -f "$WIRE2_PATH/deploy-frontend.sh" ]]; then
  chmod +x "$WIRE2_PATH/deploy-frontend.sh"
  "$WIRE2_PATH/deploy-frontend.sh"
else
  log "deploy-frontend.sh not found, building frontend manually..."
  cd "$WIRE2_PATH/frontend"
  docker build \
    --build-arg VITE_API_MODE="${VITE_API_MODE:-real}" \
    --build-arg VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://wire.pose.xyz}" \
    --build-arg VITE_AUTH_MODE="${VITE_AUTH_MODE:-demo}" \
    -t wire2-frontend:latest \
    -f Dockerfile \
    .
  cd "$WIRE2_PATH"
fi

# Extract frontend files
docker rm -f wire-frontend-tmp >/dev/null 2>&1 || true
docker create --name wire-frontend-tmp wire2-frontend:latest >/dev/null
mkdir -p "$WIRE2_PATH/frontend/dist-wire"
rm -rf "$WIRE2_PATH/frontend/dist-wire"/*
docker cp wire-frontend-tmp:/usr/share/nginx/html/. "$WIRE2_PATH/frontend/dist-wire/"
docker rm wire-frontend-tmp >/dev/null

# Normalize index.html
if [[ ! -f "$WIRE2_PATH/frontend/dist-wire/index.html" && -f "$WIRE2_PATH/frontend/dist-wire/index-wire.html" ]]; then
  log "frontend dist has index-wire.html but not index.html; copying to index.html"
  cp -av "$WIRE2_PATH/frontend/dist-wire/index-wire.html" "$WIRE2_PATH/frontend/dist-wire/index.html"
fi

if [[ ! -f "$WIRE2_PATH/frontend/dist-wire/index.html" ]]; then
  fail "frontend dist missing index.html at $WIRE2_PATH/frontend/dist-wire/"
fi

log "Frontend deployed successfully"

# ============================================================================
# STEP 9: Configure Nginx
# ============================================================================
log "STEP 9: Configuring Nginx"

NGINX_SITE="/etc/nginx/sites-available/wire.pose.xyz"
SSL_FULLCHAIN="/etc/letsencrypt/live/wire.pose.xyz/fullchain.pem"
SSL_PRIVKEY="/etc/letsencrypt/live/wire.pose.xyz/privkey.pem"

if [[ ! -f "$SSL_FULLCHAIN" || ! -f "$SSL_PRIVKEY" ]]; then
  fail "missing TLS cert files for wire.pose.xyz (expected $SSL_FULLCHAIN and $SSL_PRIVKEY). Run certbot first."
fi

OPTIONS_SSL="/etc/letsencrypt/options-ssl-nginx.conf"
DH_PARAM="/etc/letsencrypt/ssl-dhparams.pem"
INCLUDE_OPTIONS=""
INCLUDE_DH=""
if [[ -f "$OPTIONS_SSL" ]]; then
  INCLUDE_OPTIONS="include $OPTIONS_SSL;"
fi
if [[ -f "$DH_PARAM" ]]; then
  INCLUDE_DH="ssl_dhparam $DH_PARAM;"
fi

cat > "$NGINX_SITE" <<EOF
upstream wire2_backend {
  server 127.0.0.1:8000;
  keepalive 32;
}

server {
  listen 80;
  server_name wire.pose.xyz;
  return 301 https://\$host\$request_uri;
}

server {
  listen 443 ssl http2;
  server_name wire.pose.xyz;

  ssl_certificate     ${SSL_FULLCHAIN};
  ssl_certificate_key ${SSL_PRIVKEY};

  ${INCLUDE_OPTIONS}
  ${INCLUDE_DH}

  client_max_body_size 15m;

  # App root: redirect to /v2/
  location = / {
    return 302 /v2/;
  }

  # Static asset caching (served from dist-wire) - must come BEFORE the general /v2/ block
  location ~* ^/v2/.*\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webmanifest)$ {
    alias ${WIRE2_PATH}/frontend/dist-wire/;
    rewrite ^/v2/(.*)$ /\$1 break;
    expires 30d;
    add_header Cache-Control "public";
    try_files \$uri =404;
  }

  # Serve the Wire2 SPA under /v2/*
  location ^~ /v2/ {
    alias ${WIRE2_PATH}/frontend/dist-wire/;
    rewrite ^/v2/(.*)$ /\$1 break;
    try_files \$uri \$uri/ /index.html;
  }

  # /wire/* legacy alias -> /v2/* (customer-facing compatibility)
  location = /wire {
    return 308 /v2/;
  }
  location ^~ /wire/ {
    return 308 /v2\$request_uri;
  }

  # API proxy
  location ^~ /api/ {
    proxy_pass http://wire2_backend;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_connect_timeout 5s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }

  # Healthz for external monitoring
  location = /healthz {
    add_header Content-Type text/plain;
    return 200 "ok\\n";
  }
}
EOF

ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/wire.pose.xyz

# Disable default nginx site if it exists
if [[ -f /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
  log "disabled default nginx site"
fi

# Test and reload nginx
nginx -t || fail "Nginx configuration test failed"
systemctl reload nginx || fail "Failed to reload nginx"

log "Nginx configured and reloaded"

# ============================================================================
# STEP 10: Verification and fingerprint
# ============================================================================
log "STEP 10: Verifying deployment"

# Deployment fingerprint
if [[ -f "$WIRE2_PATH/scripts/deploy_fingerprint.sh" ]]; then
  chmod +x "$WIRE2_PATH/scripts/deploy_fingerprint.sh" || true
  "$WIRE2_PATH/scripts/deploy_fingerprint.sh" || true
fi

# External verification
log "Verifying external endpoints..."
if curl -fsS --max-time 10 "$BASE_URL/api/wire/health" >/dev/null 2>&1 || \
   curl -fsS --max-time 10 "$BASE_URL/health" >/dev/null 2>&1; then
  log "✓ Backend health check passed"
else
  warn "Backend health check failed (may need a moment to propagate)"
fi

# Check frontend
if curl -fsS --max-time 10 "$BASE_URL/v2/" >/dev/null 2>&1; then
  log "✓ Frontend is accessible"
else
  warn "Frontend check failed"
fi

# ============================================================================
# STEP 11: Summary
# ============================================================================
log "=========================================="
log "DEPLOYMENT COMPLETE"
log "=========================================="
log "Git commit: $(git rev-parse HEAD)"
log "Git branch: $(git branch --show-current)"
log "Deployed at: $(date)"
log "Backend URL: $BASE_URL/api/wire/health"
log "Frontend URL: $BASE_URL/v2/"
log "=========================================="

log "DONE"
