# Deploy WIREv2 Now - Step by Step

Code has been uploaded! Now complete the deployment:

## Step 1: SSH into Server

```bash
ssh root@165.227.68.201
```

## Step 2: Create Environment File

```bash
cd /opt/wire2
nano .env.production
```

Paste this configuration:

```bash
# Database
POSTGRES_DB=wire2
POSTGRES_USER=wire2_user
POSTGRES_PASSWORD=wire2_secure_password_123!

# Authentication
AUTH_MODE=demo

# CORS
CORS_ORIGIN=https://wire.pose.xyz

# POSE V2 Voice Service (disable for now)
POSE_V2_SERVICE_URL=http://localhost:8000
POSE_V2_ENABLED=false

# Signing Keys (optional for now - can skip)
SIGNING_PRIVATE_KEY=
SIGNING_PUBLIC_KEY=
SIGNING_KEY_ID=dev_key_1

# Storage
STORAGE_TYPE=local

# Redis
REDIS_URL=redis://redis:6379

# App Version
APP_VERSION=1.0.0
```

Save: `Ctrl+O`, Enter, `Ctrl+X`

## Step 3: Deploy Backend

```bash
cd /opt/wire2
./deploy.sh
```

This will:
- Build Docker images
- Start PostgreSQL, Redis, and backend
- Run database migrations
- Check health

**Wait for it to complete** (takes 2-5 minutes)

## Step 4: Verify Backend

```bash
# Check backend is running
curl http://localhost:8000/health

# Check containers
docker ps

# View logs if needed
docker compose -f docker-compose.prod.yml logs -f wire-backend
```

## Step 5: Build Frontend

```bash
cd /opt/wire2/frontend

# Install Node.js if not installed
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install dependencies
npm ci

# Create production env
cat > .env.production << 'EOF'
VITE_API_MODE=real
VITE_API_BASE_URL=https://wire.pose.xyz
VITE_AUTH_MODE=demo
EOF

# Build frontend
npm run build

# Verify build
ls -la dist-wire/
```

## Step 6: Configure Nginx

```bash
# Create Nginx config
cat > /etc/nginx/sites-available/wire.pose.xyz << 'EOF'
upstream wire_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name wire.pose.xyz;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wire.pose.xyz;

    # SSL (will be added by certbot)
    ssl_certificate /etc/letsencrypt/live/wire.pose.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wire.pose.xyz/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend
    # Canonical base: /v2 (Wire2 router basename + build base)
    # Supported alias: /wire/* -> /v2/*
        root /opt/wire2/frontend/dist-wire;
    index index-wire.html;
        
    location = / {
        return 308 /v2/;
    }

    # /wire alias (customer-facing compatibility)
    location = /wire {
        return 308 /v2/;
    }
    location ~ ^/wire/(.*)$ {
        return 308 /v2/$1;
    }

    # Canonicalize /v2 -> /v2/
    location = /v2 {
        return 308 /v2/;
    }

    # Cache static assets under /v2/* (the build emits /v2/assets/* etc)
    location ^~ /v2/assets/ {
        rewrite ^/v2/(.*)$ /$1 break;
            expires 1y;
            add_header Cache-Control "public, immutable";
        try_files $uri =404;
        }

    # SPA routing under /v2/*
    location ^~ /v2/ {
        rewrite ^/v2/(.*)$ /$1 break;
        try_files $uri $uri/ /index-wire.html;
    }

    # Backend API
    location /api {
        proxy_pass http://wire_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        client_max_body_size 10M;
    }

    # Health check
    location /health {
        proxy_pass http://wire_backend/health;
        access_log off;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/wire.pose.xyz /etc/nginx/sites-enabled/

# Test config (will fail SSL for now, that's OK)
nginx -t

# Start with HTTP only first (temporarily comment SSL lines)
# Edit config to remove SSL lines temporarily:
sed -i 's/listen 443 ssl http2;/listen 80;/' /etc/nginx/sites-available/wire.pose.xyz
sed -i '/ssl_certificate/d' /etc/nginx/sites-available/wire.pose.xyz
sed -i '/ssl_protocols/d' /etc/nginx/sites-available/wire.pose.xyz
sed -i '/return 301 https/d' /etc/nginx/sites-available/wire.pose.xyz

# Reload
systemctl reload nginx
```

## Step 7: Setup SSL Certificate

```bash
# Install certbot if not installed
apt-get update
apt-get install -y certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d wire.pose.xyz

# This will automatically update nginx config with SSL
```

## Step 8: Final Verification

```bash
# Test backend API
curl https://wire.pose.xyz/api/wire/health

# Test frontend (canonical base is /v2)
curl -I https://wire.pose.xyz/v2/
curl -I https://wire.pose.xyz/wire/login

# Check all services
docker ps
```

## Success!

Open in browser: **https://wire.pose.xyz** 🎉

---

## Troubleshooting

### Backend not starting?
```bash
cd /opt/wire2
docker compose -f docker-compose.prod.yml logs wire-backend
```

### Frontend build fails?
```bash
# Check Node version (need 18+)
node --version

# Reinstall dependencies
cd /opt/wire2/frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Nginx errors?
```bash
# Check config
nginx -t

# Check logs
tail -f /var/log/nginx/error.log
```

### SSL certificate fails?
- Make sure DNS is resolving: `dig wire.pose.xyz`
- Make sure port 80 is open
- Wait a few minutes after DNS setup

---

**Quick Command Summary:**

```bash
# 1. SSH in
ssh root@165.227.68.201

# 2. Create env file
cd /opt/wire2 && nano .env.production

# 3. Deploy backend
cd /opt/wire2 && ./deploy.sh

# 4. Build frontend
cd /opt/wire2/frontend && npm ci && npm run build

# 5. Setup Nginx (see Step 6 above)

# 6. Get SSL
certbot --nginx -d wire.pose.xyz
```
