# Next Steps: Deploy WIREv2 to Pose Core Droplet

Based on your resource check, your pose core droplet has **plenty of resources**:
- ✅ **3.3GB available RAM** (WIREv2 needs ~600MB-1.1GB)
- ✅ **Low system load** (0.16)
- ✅ **Only 1 container running** (pose-backend: 77MB)
- ✅ **Plenty of disk space** (31.5% used)

## Deployment Steps

### Option A: Automated Upload (Recommended)

From your local machine:

```bash
cd /Users/lmnop/Desktop/pose-os
./wire2/deploy-to-pose-core.sh
```

This will:
1. Upload WIREv2 code to `/opt/wire2` on the server
2. Install Docker/Docker Compose if needed
3. Setup basic structure

### Option B: Manual Upload

From your local machine:

```bash
# Upload wire2 directory
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    wire2/ root@165.227.68.201:/opt/wire2/
```

### Step 2: SSH and Configure

```bash
ssh root@165.227.68.201
cd /opt/wire2
```

### Step 3: Create Environment File

```bash
nano .env.production
```

Add this configuration (adjust as needed):

```bash
# Database
POSTGRES_DB=wire2
POSTGRES_USER=wire2_user
POSTGRES_PASSWORD=CHANGE_THIS_TO_STRONG_PASSWORD_123!

# Authentication
AUTH_MODE=demo

# CORS (important: use your domain)
CORS_ORIGIN=https://wire.pose.xyz

# POSE V2 Voice Service (if you have it)
POSE_V2_SERVICE_URL=http://localhost:8000
POSE_V2_ENABLED=false

# Signing Keys (generate with OpenSSL)
SIGNING_PRIVATE_KEY=
SIGNING_PUBLIC_KEY=
SIGNING_KEY_ID=prod_key_1

# Storage
STORAGE_TYPE=local

# Redis
REDIS_URL=redis://redis:6379
```

### Step 4: Generate Signing Keys

```bash
# Generate Ed25519 keys
openssl genpkey -algorithm Ed25519 -out private.pem
openssl pkey -in private.pem -pubout -out public.pem

# Extract keys (you'll need to manually copy the values)
# For now, you can skip this if not using audit bundles
```

### Step 5: Deploy Backend

```bash
cd /opt/wire2

# Deploy
./deploy.sh

# Or manually:
docker compose -f docker-compose.prod.yml up -d --build

# Check logs
docker compose -f docker-compose.prod.yml logs -f wire-backend

# Verify health
curl http://localhost:8000/health
```

### Step 6: Build Frontend

```bash
cd /opt/wire2/frontend

# Install dependencies
npm ci

# Create production env
cat > .env.production << EOF
VITE_API_MODE=real
VITE_API_BASE_URL=https://wire.pose.xyz
VITE_AUTH_MODE=demo
EOF

# Build
npm run build

# Verify build
ls -la dist-wire/
```

### Step 7: Configure Nginx

```bash
# Create new Nginx config
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

    # SSL (will be added by Let's Encrypt)
    # ssl_certificate /etc/letsencrypt/live/wire.pose.xyz/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/wire.pose.xyz/privkey.pem;
    # ssl_protocols TLSv1.2 TLSv1.3;

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
        
        # Increase timeouts for voice uploads
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

# Test config
nginx -t

# Reload (without SSL first)
systemctl reload nginx
```

### Step 8: Setup SSL with Let's Encrypt

```bash
# Install certbot if not installed
apt-get update
apt-get install certbot python3-certbot-nginx -y

# Get certificate
certbot --nginx -d wire.pose.xyz

# Test auto-renewal
certbot renew --dry-run
```

### Step 9: Verify Deployment

```bash
# Test backend
curl https://wire.pose.xyz/api/wire/health

# Test frontend (canonical base is /v2)
curl -I https://wire.pose.xyz/v2/
curl -I https://wire.pose.xyz/wire/login

# Check Docker containers
docker ps

# Check logs if needed
docker compose -f /opt/wire2/docker-compose.prod.yml logs -f
```

## Important Notes

### Ports
- **Pose Core API**: Port 3001 (existing, keep as-is)
- **WIREv2 Backend**: Port 8000 (new, internal only)
- **Nginx**: Ports 80, 443 (handles both domains)

### Domains
- **Existing**: `api.testnet.pose.xyz` → Pose Core API
- **New**: `wire.pose.xyz` → WIREv2 (frontend + API)

### Docker Networks
- WIREv2 uses its own Docker network (`wire2-network-prod`)
- Won't conflict with pose-core containers

## Troubleshooting

### Backend not starting
```bash
cd /opt/wire2
docker compose -f docker-compose.prod.yml logs wire-backend
```

### Port conflict
```bash
# Check what's using port 8000
netstat -tulpn | grep 8000

# Change port in docker-compose.prod.yml if needed
```

### Nginx errors
```bash
# Check Nginx logs
tail -f /var/log/nginx/error.log

# Test config
nginx -t
```

### Database connection issues
```bash
# Check postgres container
docker compose -f /opt/wire2/docker-compose.prod.yml ps postgres

# Check connection
docker compose -f /opt/wire2/docker-compose.prod.yml exec wire-backend sh -c "psql \$DATABASE_URL -c 'SELECT 1'"
```

## Quick Commands Reference

```bash
# View all containers
docker ps

# View WIREv2 containers
docker compose -f /opt/wire2/docker-compose.prod.yml ps

# Restart WIREv2
cd /opt/wire2 && docker compose -f docker-compose.prod.yml restart

# View logs
docker compose -f /opt/wire2/docker-compose.prod.yml logs -f

# Stop WIREv2
cd /opt/wire2 && docker compose -f docker-compose.prod.yml down

# Start WIREv2
cd /opt/wire2 && docker compose -f docker-compose.prod.yml up -d
```

## Success Checklist

- [ ] WIREv2 code uploaded to `/opt/wire2`
- [ ] `.env.production` created and configured
- [ ] Backend deployed and healthy (`curl http://localhost:8000/health`)
- [ ] Frontend built (`ls /opt/wire2/frontend/dist-wire`)
- [ ] Nginx configured for `wire.pose.xyz`
- [ ] SSL certificate installed
- [ ] Domain DNS pointing to `165.227.68.201`
- [ ] `https://wire.pose.xyz` loads in browser

---

**You're all set!** Your pose core droplet has plenty of resources for WIREv2. 🚀
