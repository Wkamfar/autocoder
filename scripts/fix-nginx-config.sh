#!/usr/bin/env bash
set -euo pipefail

# Quick fix script to ensure Nginx is serving wire2 correctly

echo "=== Fixing Nginx Configuration ==="

# 1. Disable default site
if [[ -f /etc/nginx/sites-enabled/default ]]; then
  echo "Removing default site..."
  rm -f /etc/nginx/sites-enabled/default
fi

# 2. Ensure wire.pose.xyz site is enabled
NGINX_SITE="/etc/nginx/sites-available/wire.pose.xyz"
if [[ ! -f "$NGINX_SITE" ]]; then
  echo "ERROR: $NGINX_SITE not found!"
  echo "Run the deployment script first: bash scripts/deploy_prod_droplet.sh"
  exit 1
fi

# 3. Enable wire.pose.xyz site
if [[ ! -L /etc/nginx/sites-enabled/wire.pose.xyz ]]; then
  echo "Enabling wire.pose.xyz site..."
  ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/wire.pose.xyz
fi

# 4. Check for other enabled sites that might conflict
echo ""
echo "Currently enabled Nginx sites:"
ls -la /etc/nginx/sites-enabled/ | grep -v "^total" || echo "  (none)"

# 5. Test configuration
echo ""
echo "Testing Nginx configuration..."
if nginx -t; then
  echo "✓ Nginx configuration is valid"
else
  echo "✗ Nginx configuration has errors!"
  exit 1
fi

# 6. Reload Nginx
echo ""
echo "Reloading Nginx..."
systemctl reload nginx || systemctl restart nginx

echo ""
echo "=== Done ==="
echo "Nginx should now serve wire.pose.xyz"
echo ""
echo "Verify:"
echo "  curl -I https://wire.pose.xyz/v2/"
echo "  curl -I http://localhost/v2/"
