#!/usr/bin/env bash
set -euo pipefail

# Prints a "deployment fingerprint" for Wire2 so you can prove the droplet
# is running a specific git commit + container images.
#
# Run on droplet:  /opt/wire2/scripts/deploy_fingerprint.sh

WIRE2_PATH="${WIRE2_PATH:-/opt/wire2}"

cd "$WIRE2_PATH"

echo "== wire2 fingerprint =="
echo "path=$WIRE2_PATH"
date -u +"utc=%Y-%m-%dT%H:%M:%SZ"

if command -v git >/dev/null 2>&1 && [ -d .git ]; then
  echo "git_commit=$(git rev-parse HEAD)"
  echo "git_branch=$(git rev-parse --abbrev-ref HEAD || true)"
  echo "git_status_porcelain_count=$(git status --porcelain | wc -l | tr -d ' ')"
else
  echo "git_commit=<none>"
fi

if command -v docker >/dev/null 2>&1; then
  echo ""
  echo "== docker compose (resolved) =="
  if [ -f .env.production ]; then
    docker compose --env-file .env.production -f docker-compose.prod.yml config 2>/dev/null | sha256sum | awk '{print "compose_config_sha256="$1}'
  else
    docker compose -f docker-compose.prod.yml config 2>/dev/null | sha256sum | awk '{print "compose_config_sha256="$1}'
  fi

  echo ""
  echo "== container images =="
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | sed 's/\t/  /g'
else
  echo "docker=<missing>"
fi

