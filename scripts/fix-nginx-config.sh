#!/bin/bash
# Fix nginx config to match deployment script
# This ensures SPA routing works correctly

NGINX_SITE="/etc/nginx/sites-available/wire.pose.xyz"
WIRE2_PATH="${WIRE2_PATH:-/opt/wire2}"

if [ ! -f "$NGINX_SITE" ]; then
  echo "Error: nginx config not found at $NGINX_SITE"
  exit 1
fi

# Backup
cp "$NGINX_SITE" "${NGINX_SITE}.backup.$(date +%s)"

# Fix the /v2/ location block to use alias (not root) and correct try_files
# Replace root with alias
sed -i 's|root /opt/wire2/frontend/dist-wire;|alias /opt/wire2/frontend/dist-wire/;|g' "$NGINX_SITE"

# Fix try_files to use /v2/index.html (for alias)
sed -i 's|try_files \$uri \$uri/ /index.html;|try_files \$uri \$uri/ /v2/index.html;|g' "$NGINX_SITE"

# Test and reload
nginx -t && systemctl reload nginx

echo "Nginx config fixed and reloaded"
