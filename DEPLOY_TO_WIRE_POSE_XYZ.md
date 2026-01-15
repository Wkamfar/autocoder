# Deploy WIREv2 to wire.pose.xyz

Complete deployment guide for production deployment to wire.pose.xyz

## Prerequisites

1. **Server/VPS** with:
   - Ubuntu 20.04+ or similar
   - Docker and Docker Compose installed
   - Nginx installed
   - Domain `wire.pose.xyz` pointing to server IP
   - Ports 80, 443 open

2. **Required Services:**
   - PostgreSQL (can use Docker or managed service)
   - Redis (optional, can use Docker or managed service)
   - POSE V2 Voice Service URL (if using real voice verification)

## Quick Deployment (Recommended)

### Option 1: Single Server Deployment (Docker Compose)

This deploys everything on one server with Nginx as reverse proxy.

#### Step 1: Prepare Server

```bash
# SSH into your server
ssh root@your-server-ip

# Install Docker & Docker Compose (if not installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt-get install docker-compose-plugin -y

# Install Nginx
apt-get update
apt-get install nginx certbot python3-certbot-nginx -y
```

#### Step 2: Clone/Upload Code

```bash
# Create app directory
mkdir -p /opt/wire2
cd /opt/wire2

# Upload your wire2 directory here (or clone from git)
# Make sure you have the full wire2/ directory structure
```

#### Step 3: Create Environment Files

Create `/opt/wire2/.env.production`:

```bash
# Database
DATABASE_URL=postgresql://wire2_user:CHANGE_THIS_PASSWORD@postgres:5432/wire2?schema=public

# PostgreSQL (for docker-compose)
POSTGRES_DB=wire2
POSTGRES_USER=wire2_user
POSTGRES_PASSWORD=CHANGE_THIS_PASSWORD

# Authentication
AUTH_MODE=demo  # Change to 'oidc' for production OIDC
# OIDC_ISSUER=https://your-oidc-provider.com
# OIDC_CLIENT_ID=your-client-id
# OIDC_CLIENT_SECRET=your-client-secret

# POSE V2 Voice Service
POSE_V2_SERVICE_URL=http://your-pose-v2-service:8000
POSE_V2_ENABLED=true

# CORS
CORS_ORIGIN=https://wire.pose.xyz

# Signing Keys (generate with script below)
SIGNING_PRIVATE_KEY=your_base64url_private_key_here
SIGNING_PUBLIC_KEY=your_base64url_public_key_here
SIGNING_KEY_ID=prod_key_1

# App Version
APP_VERSION=1.0.0

# Storage (for audit bundles - use S3 in production)
STORAGE_TYPE=s3
STORAGE_BUCKET=wire-audit-bundles
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret

# Redis (optional)
REDIS_URL=redis://redis:6379
```

Generate signing keys:

```bash
# Generate Ed25519 key pair
openssl genpkey -algorithm Ed25519 -out private.pem
openssl pkey -in private.pem -pubout -out public.pem

# Convert to base64url (for private key, extract 32 bytes after header)
# Private key (32 bytes seed)
dd if=private.pem bs=1 skip=16 count=32 2>/dev/null | base64 -w 0 | tr '+/' '-_' | tr -d '='
# Public key (32 bytes)
dd if=public.pem bs=1 skip=12 count=32 2>/dev/null | base64 -w 0 | tr '+/' '-_' | tr -d '='
```

#### Step 4: Create Production Docker Compose

Create `/opt/wire2/docker-compose.prod.yml` (or use the existing one with modifications):

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: wire2-postgres-prod
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-wire2}
      POSTGRES_USER: ${POSTGRES_USER:-wire2_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data_prod:/var/lib/postgresql/data
      - ./backups:/backups:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-wire2_user} -d ${POSTGRES_DB:-wire2}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - wire2-network-prod
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    image: redis:7-alpine
    container_name: wire2-redis-prod
    volumes:
      - redis_data_prod:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - wire2-network-prod
    restart: unless-stopped

  wire-backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: wire2-backend-prod
    env_file:
      - .env.production
    environment:
      NODE_ENV: production
      PORT: 8000
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - wire2-network-prod
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:8000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G

volumes:
  postgres_data_prod:
  redis_data_prod:

networks:
  wire2-network-prod:
    driver: bridge
```

#### Step 5: Build and Start Backend

```bash
cd /opt/wire2

# Load environment variables
export $(cat .env.production | xargs)

# Build and start
docker compose -f docker-compose.prod.yml up -d --build

# Check logs
docker compose -f docker-compose.prod.yml logs -f wire-backend

# Verify health
curl http://localhost:8000/health
```

#### Step 6: Build Frontend

```bash
cd /opt/wire2/frontend

# Install dependencies
npm ci

# Create production .env
cat > .env.production << EOF
VITE_API_MODE=real
VITE_API_BASE_URL=https://wire.pose.xyz
VITE_AUTH_MODE=demo
VITE_DEMO_USER_ID=user_1
EOF

# Build frontend
npm run build

# The output will be in dist-wire/
```

#### Step 7: Configure Nginx

Create `/etc/nginx/sites-available/wire.pose.xyz`:

```nginx
# Backend API
upstream wire_backend {
    server 127.0.0.1:8000;
}

# Frontend
server {
    listen 80;
    server_name wire.pose.xyz;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wire.pose.xyz;

    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/wire.pose.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wire.pose.xyz/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend (SPA)
    location / {
        root /opt/wire2/frontend/dist-wire;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
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

    # Health check (no auth required)
    location /health {
        proxy_pass http://wire_backend/health;
        access_log off;
    }

    # Metrics (optional, protect with auth in production)
    location /metrics {
        proxy_pass http://wire_backend/metrics;
        # Add IP whitelist or basic auth here
    }
}
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/wire.pose.xyz /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

#### Step 8: Setup SSL with Let's Encrypt

```bash
# Temporarily disable HTTPS redirect in nginx
# Edit /etc/nginx/sites-available/wire.pose.xyz and comment out the redirect

# Get certificate
certbot --nginx -d wire.pose.xyz

# Re-enable HTTPS redirect
# Edit nginx config again and uncomment redirect

# Test auto-renewal
certbot renew --dry-run

# Reload nginx
systemctl reload nginx
```

#### Step 9: Verify Deployment

```bash
# Test backend API
curl https://wire.pose.xyz/api/wire/health

# Test frontend
curl -I https://wire.pose.xyz/

# Check in browser
open https://wire.pose.xyz
```

## Option 2: Separate Frontend/Backend Deployment

### Frontend: Deploy to Netlify/Vercel

1. **Netlify:**
   ```bash
   cd wire2/frontend
   
   # Create netlify.toml
   cat > netlify.toml << EOF
   [build]
     publish = "dist-wire"
     command = "npm ci && npm run build"
   
   [build.environment]
     VITE_API_MODE=real
     VITE_API_BASE_URL=https://api.wire.pose.xyz
     VITE_AUTH_MODE=demo
   
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   EOF
   
   # Deploy
   netlify deploy --prod
   ```

2. **Vercel:**
   ```bash
   cd wire2/frontend
   vercel --prod
   ```

### Backend: Deploy to Server

Follow steps 1-5 from Option 1, but update Nginx to only serve API:

```nginx
server {
    listen 443 ssl http2;
    server_name api.wire.pose.xyz;

    # ... SSL config ...

    location / {
        proxy_pass http://wire_backend;
        # ... proxy settings ...
    }
}
```

## Environment Variables Checklist

### Backend (`.env.production`)
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `POSTGRES_PASSWORD` - Strong password
- [ ] `AUTH_MODE` - Set to `oidc` for production
- [ ] `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` (if using OIDC)
- [ ] `CORS_ORIGIN` - Set to `https://wire.pose.xyz`
- [ ] `POSE_V2_SERVICE_URL` - Your POSE V2 service URL
- [ ] `SIGNING_PRIVATE_KEY` - Ed25519 private key (base64url)
- [ ] `SIGNING_PUBLIC_KEY` - Ed25519 public key (base64url)
- [ ] `STORAGE_TYPE` - `s3` for production
- [ ] `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `STORAGE_BUCKET`

### Frontend (`.env.production`)
- [ ] `VITE_API_MODE=real`
- [ ] `VITE_API_BASE_URL=https://wire.pose.xyz` (or `https://api.wire.pose.xyz` if separate)
- [ ] `VITE_AUTH_MODE` - Match backend AUTH_MODE

## Security Checklist

- [ ] Change all default passwords
- [ ] Set `AUTH_MODE=oidc` for production (disable demo mode)
- [ ] Configure `CORS_ORIGIN` to specific domain (no wildcards)
- [ ] Use strong `POSTGRES_PASSWORD`
- [ ] Store signing keys securely (use KMS in production)
- [ ] Enable firewall (UFW): `ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable`
- [ ] Don't expose backend port 8000 publicly (use Nginx reverse proxy)
- [ ] Setup database backups
- [ ] Monitor logs: `docker compose -f docker-compose.prod.yml logs -f`

## Monitoring

### Health Checks

```bash
# Backend health
curl https://wire.pose.xyz/api/wire/health

# Readiness (checks dependencies)
curl https://wire.pose.xyz/api/wire/health/ready

# Metrics (protect this endpoint)
curl https://wire.pose.xyz/metrics
```

### Logs

```bash
# Backend logs
docker compose -f docker-compose.prod.yml logs -f wire-backend

# All services
docker compose -f docker-compose.prod.yml logs -f

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Backend not starting
```bash
docker compose -f docker-compose.prod.yml logs wire-backend
docker compose -f docker-compose.prod.yml ps
```

### Database connection issues
```bash
# Check postgres is running
docker compose -f docker-compose.prod.yml ps postgres

# Check connection from backend container
docker compose -f docker-compose.prod.yml exec wire-backend sh -c "psql $DATABASE_URL -c 'SELECT 1'"
```

### Frontend can't connect to backend
- Check `VITE_API_BASE_URL` matches your domain
- Check CORS settings in backend
- Check Nginx is proxying `/api` correctly

### SSL certificate issues
```bash
# Renew certificate
certbot renew

# Check certificate
certbot certificates
```

## Quick Deploy Script

Create `/opt/wire2/deploy.sh`:

```bash
#!/bin/bash
set -e

cd /opt/wire2

echo "🔨 Building backend..."
docker compose -f docker-compose.prod.yml build

echo "🚀 Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for backend..."
sleep 10

echo "✅ Checking health..."
curl -f http://localhost:8000/health || exit 1

echo "✅ Deployment complete!"
```

Make it executable:
```bash
chmod +x /opt/wire2/deploy.sh
```

## Next Steps

1. **Database Backups**: Setup automated backups
2. **Monitoring**: Setup Prometheus + Grafana
3. **Logging**: Setup centralized logging (ELK stack or similar)
4. **CDN**: Use CloudFlare or similar for frontend assets
5. **Load Balancing**: If scaling, add load balancer
6. **OIDC Setup**: Configure OIDC provider for production auth

---

**Deployment Complete!** 🎉

Your WIREv2 app should now be live at `https://wire.pose.xyz`
