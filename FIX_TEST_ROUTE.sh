#!/bin/bash
# Fix /v2/test route - Extract files and fix nginx config

set -e

echo "🔧 Fixing /v2/test route..."

# Step 1: Extract built files from container
echo ""
echo "📦 Step 1: Extracting files from container..."
docker create --name wire-frontend-tmp wire2-frontend:latest 2>/dev/null || (docker rm -f wire-frontend-tmp && docker create --name wire-frontend-tmp wire2-frontend:latest)
docker cp wire-frontend-tmp:/usr/share/nginx/html/. /opt/wire2/frontend/dist-wire/
docker rm wire-frontend-tmp
echo "✅ Files extracted"

# Step 2: Verify route is in the build
echo ""
echo "🔍 Step 2: Verifying route in build..."
if grep -q "WireFastWireTestPage\|/test" /opt/wire2/frontend/dist-wire/assets/*.js 2>/dev/null; then
    echo "✅ Route found in build!"
else
    echo "❌ Route NOT found - need to rebuild"
    exit 1
fi

# Step 3: Fix nginx config for SPA routing
echo ""
echo "⚙️  Step 3: Fixing nginx config..."
NGINX_CONFIG="/etc/nginx/sites-enabled/wire.pose.xyz"

# Backup current config
sudo cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"

# Create fixed config
sudo tee "$NGINX_CONFIG" > /dev/null << 'NGINX_EOF'
server {
    listen 80;
    server_name wire.pose.xyz;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wire.pose.xyz;

    ssl_certificate     /etc/letsencrypt/live/wire.pose.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wire.pose.xyz/privkey.pem;

    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 15m;

    root /opt/wire2/frontend/dist-wire;
    index index-wire.html;

    # Redirect root to /v2/
    location = / {
        return 302 /v2/;
    }

    # Static assets - serve directly
    location ~* ^/v2/.*\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webmanifest)$ {
        rewrite ^/v2/(.*)$ /$1 break;
        expires 30d;
        add_header Cache-Control "public";
        try_files $uri =404;
    }

    # SPA routing - all /v2/* routes serve index-wire.html for React Router
    location ^~ /v2/ {
        rewrite ^/v2/(.*)$ /$1 break;
        try_files $uri $uri/ /index-wire.html;
    }
    
    # Redirect /wire to /v2
    location /wire {
        return 308 /v2/;
    }
}
NGINX_EOF

# Test nginx config
echo ""
echo "🧪 Testing nginx config..."
if sudo nginx -t; then
    echo "✅ Nginx config is valid"
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
else
    echo "❌ Nginx config error - restoring backup"
    sudo cp "${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)" "$NGINX_CONFIG"
    exit 1
fi

# Step 4: Verify
echo ""
echo "✅ Fix complete!"
echo ""
echo "Test the route:"
echo "  curl -I https://wire.pose.xyz/v2/test"
echo ""
echo "Or visit in browser: https://wire.pose.xyz/v2/test"
