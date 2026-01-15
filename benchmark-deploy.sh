#!/bin/bash
# Benchmark deploy speed on the droplet (proves caching works).
set -euo pipefail

cd /opt/wire2

echo "== WIRE2 deploy benchmark =="
echo "1) Warm build (first build after changes or cache clear)"
time ./deploy.sh

echo ""
echo "2) Cached rebuild (no dependency changes)"
time ./deploy.sh

echo ""
echo "3) Restart only (no build)"
time ./deploy.sh --skip-build

echo ""
echo "Tip: to simulate a tiny code change, edit a .ts file and rerun step (2)."

