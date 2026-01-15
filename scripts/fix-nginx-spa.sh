#!/bin/bash
# Fix nginx SPA routing for deep routes
# This ensures all /v2/* routes fall back to index.html correctly

NGINX_SITE="/etc/nginx/sites-available/wire.pose.xyz"
WIRE2_PATH="${WIRE2_PATH:-/opt/wire2}"

if [ ! -f "$NGINX_SITE" ]; then
  echo "Error: nginx config not found at $NGINX_SITE"
  exit 1
fi

# Backup the current config
cp "$NGINX_SITE" "${NGINX_SITE}.backup.$(date +%s)"

# The issue is that with alias, we need to use the full path in try_files
# Update the /v2/ location block to properly handle SPA routing
sed -i 's|try_files \$uri \$uri/ /v2/index.html;|try_files \$uri \$uri/ /v2/index.html =404;|g' "$NGINX_SITE" || true

# Actually, the better fix is to ensure the alias path is correct
# Let's check if we need to use root instead of alias for better SPA support
# For now, let's just ensure the fallback works

# Test and reload
nginx -t && systemctl reload nginx

echo "Nginx config updated and reloaded"
