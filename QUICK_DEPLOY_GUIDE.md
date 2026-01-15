# Quick Deploy Guide: wire.pose.xyz

## TL;DR - What You Need to Do

1. **Server Setup**: Get a VPS (DigitalOcean, AWS, etc.) with Docker installed
2. **Upload Code**: Copy `wire2/` directory to `/opt/wire2` on server
3. **Configure Environment**: Create `.env.production` with your settings
4. **Start Services**: Run `./deploy.sh` or `docker compose -f docker-compose.prod.yml up -d`
5. **Configure Nginx**: Setup reverse proxy and SSL
6. **Point Domain**: Point `wire.pose.xyz` to your server IP

## Step-by-Step

### 1. Server Requirements

- Ubuntu 20.04+ server
- Docker & Docker Compose installed
- Nginx installed
- Domain `wire.pose.xyz` DNS pointing to server IP
- Ports 80, 443 open in firewall

### 2. Initial Server Setup

```bash
# SSH into server
ssh root@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh

# Install Docker Compose
apt-get install docker-compose-plugin -y

# Install Nginx
apt-get update && apt-get install nginx certbot python3-certbot-nginx -y
```

### 3. Upload Code

```bash
# Create directory
mkdir -p /opt/wire2
cd /opt/wire2

# Upload your wire2 directory here (scp, rsync, git clone, etc.)
# Example with rsync from local machine:
# rsync -avz wire2/ root@your-server:/opt/wire2/
```

### 4. Create Environment File

Create `/opt/wire2/.env.production`:

```bash
# Database
POSTGRES_DB=wire2
POSTGRES_USER=wire2_user
POSTGRES_PASSWORD=CHANGE_THIS_TO_STRONG_PASSWORD

# Authentication (start with demo, change to oidc later)
AUTH_MODE=demo

# CORS
CORS_ORIGIN=https://wire.pose.xyz

# POSE V2 Voice Service
POSE_V2_SERVICE_URL=http://your-pose-v2-service:8000
POSE_V2_ENABLED=true

# Signing Keys (generate below)
SIGNING_PRIVATE_KEY=your_key_here
SIGNING_PUBLIC_KEY=your_key_here
SIGNING_KEY_ID=prod_key_1

# Storage (use local for now, S3 later)
STORAGE_TYPE=local
```

### 5. Generate Signing Keys

```bash
cd /opt/wire2

# Generate Ed25519 keys
openssl genpkey -algorithm Ed25519 -out private.pem
openssl pkey -in private.pem -pubout -out public.pem

# Extract keys (you'll need to manually extract the 32-byte values)
# Add them to .env.production as SIGNING_PRIVATE_KEY and SIGNING_PUBLIC_KEY
```

### 6. Deploy Backend

```bash
cd /opt/wire2

# Make deploy script executable
chmod +x deploy.sh

# Deploy
./deploy.sh

# Or manually:
# docker compose -f docker-compose.prod.yml up -d --build
```

### 7. Build Frontend

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

# Output is in dist-wire/
```

### 8. Configure Nginx

Create `/etc/nginx/sites-available/wire.pose.xyz`:

```nginx
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

    ssl_certificate /etc/letsencrypt/live/wire.pose.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wire.pose.xyz/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Frontend
    location / {
        root /opt/wire2/frontend/dist-wire;
        try_files $uri $uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://wire_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;
    }

    location /health {
        proxy_pass http://wire_backend/health;
    }
}
```

Enable and test:

```bash
ln -s /etc/nginx/sites-available/wire.pose.xyz /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 9. Setup SSL

```bash
# Get Let's Encrypt certificate
certbot --nginx -d wire.pose.xyz

# Test auto-renewal
certbot renew --dry-run
```

### 10. Verify

```bash
# Test backend
curl https://wire.pose.xyz/api/wire/health

# Test frontend
curl -I https://wire.pose.xyz/

# Open in browser
open https://wire.pose.xyz
```

## Common Issues

**Backend not starting?**
```bash
docker compose -f docker-compose.prod.yml logs wire-backend
```

**Database connection error?**
- Check `POSTGRES_PASSWORD` in `.env.production`
- Verify postgres container is running: `docker compose -f docker-compose.prod.yml ps`

**Frontend 404?**
- Verify build output exists: `ls -la /opt/wire2/frontend/dist-wire`
- Check Nginx root path matches build output

**SSL certificate issues?**
- Ensure DNS is pointing to server: `dig wire.pose.xyz`
- Check port 80 is open for Let's Encrypt validation

## Next Steps

1. Change `AUTH_MODE=oidc` and configure OIDC
2. Setup database backups
3. Configure S3 for audit bundle storage
4. Setup monitoring (Prometheus/Grafana)
5. Enable firewall: `ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable`

## Files Reference

- **Deployment Guide**: `DEPLOY_TO_WIRE_POSE_XYZ.md` (detailed guide)
- **Production Compose**: `docker-compose.prod.yml`
- **Deploy Script**: `deploy.sh`
- **Backend Dockerfile**: `backend/Dockerfile`
- **Frontend Dockerfile**: `frontend/Dockerfile`
