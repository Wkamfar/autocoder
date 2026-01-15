# WIRE2 Production Deployment Guide

## Overview

This guide ensures a **seamless, repeatable deployment** from GitHub to the production droplet. All code comes from GitHub - no local modifications.

## Prerequisites

1. **SSH access** to the droplet
2. **GitHub repository** with code pushed to `main` branch
3. **Environment file** at `/etc/wire2/.env.production` with all required variables

## Required Environment Variables

Create `/etc/wire2/.env.production` with:

```bash
# Database
POSTGRES_DB=wire2
POSTGRES_USER=wire2_user
POSTGRES_PASSWORD=<strong-password>

# Backend
DATABASE_URL=postgresql://wire2_user:<password>@postgres:5432/wire2?schema=public
REDIS_URL=redis://redis:6379
NODE_ENV=production
PORT=8000

# Frontend Build
VITE_API_MODE=real
VITE_API_BASE_URL=https://wire.pose.xyz
VITE_AUTH_MODE=demo

# Email (optional but recommended)
EMAIL_PROVIDER=mailgun  # or sendgrid, ses, smtp, console
MAILGUN_API_KEY=<your-key>
MAILGUN_DOMAIN=<your-domain>
FROM_EMAIL=noreply@wire.pose.xyz
FROM_NAME=WIRE

# POSE Network (optional)
POSE_ANCHORING_ENABLED=true
POSE_ANCHOR_API_URL=https://api.testnet.pose.xyz/api/pose/anchors/intent-event
POSE_EXPLORER_URL=https://explorer.testnet.pose.xyz

# Security
SIGNING_PRIVATE_KEY=<base64url-encoded-ed25519-private-key>
SIGNING_PUBLIC_KEY=<base64url-encoded-ed25519-public-key>

# Frontend URL
FRONTEND_URL=https://wire.pose.xyz
```

## Deployment Steps

### 1. SSH into the Droplet

```bash
ssh root@<droplet-ip>
```

### 2. Navigate to WIRE2 Directory

```bash
cd /opt/wire2
```

### 3. Run Deployment Script

```bash
bash scripts/deploy_prod_droplet.sh
```

The script will:
1. ✅ Pull latest code from GitHub (`origin/main`)
2. ✅ Reset any local changes (ensures clean state)
3. ✅ Validate environment configuration
4. ✅ Start PostgreSQL and Redis
5. ✅ Run database migrations
6. ✅ Build and start backend + worker
7. ✅ Wait for backend health checks
8. ✅ Build and deploy frontend
9. ✅ Configure and reload Nginx
10. ✅ Verify deployment

## What the Deployment Script Does

### Step 1: Git Pull
- Fetches from `origin/main`
- Resets to match GitHub exactly (no local modifications)
- Stashes any local changes if present

### Step 2: Environment Validation
- Ensures `/etc/wire2/.env.production` exists
- Validates critical variables (DATABASE_URL, POSTGRES_PASSWORD)

### Step 3: Docker Network
- Creates `wire2-network-prod` if it doesn't exist

### Step 4: Database & Cache
- Starts PostgreSQL and Redis containers
- Waits for both to be healthy

### Step 5: Migrations
- Builds migration image
- Runs `prisma migrate deploy`
- Fails deployment if migrations fail

### Step 6: Backend & Worker
- Builds backend Docker image
- Starts backend and worker containers
- Waits for backend health endpoint

### Step 7: Frontend
- Builds frontend Docker image
- Extracts static files to `/opt/wire2/frontend/dist-wire/`
- Normalizes `index.html`

### Step 8: Nginx
- Generates Nginx configuration
- Tests configuration
- Reloads Nginx

### Step 9: Verification
- Checks backend health endpoint
- Checks frontend accessibility
- Generates deployment fingerprint

## Troubleshooting

### Database Issues

**Problem**: Migrations fail
```bash
# Check migration logs
docker logs wire2-migrate-prod

# Check database connection
docker exec -it wire2-postgres-prod psql -U wire2_user -d wire2 -c "\dt"

# Manual migration (if needed)
docker compose -f docker-compose.prod.yml run --rm wire-migrate
```

**Problem**: Database connection errors
```bash
# Verify DATABASE_URL in .env.production
cat /etc/wire2/.env.production | grep DATABASE_URL

# Test connection
docker exec -it wire2-postgres-prod psql -U wire2_user -d wire2
```

### Backend Issues

**Problem**: Backend won't start
```bash
# Check logs
docker logs --tail 200 wire2-backend-prod

# Check health endpoint
curl http://127.0.0.1:8000/api/wire/health

# Check readiness
curl http://127.0.0.1:8000/api/wire/health/ready
```

**Problem**: Login fails
```bash
# Check backend logs for errors
docker logs --tail 100 wire2-backend-prod | grep -i error

# Verify DATABASE_URL is correct
docker exec wire2-backend-prod env | grep DATABASE_URL

# Check if database tables exist
docker exec -it wire2-postgres-prod psql -U wire2_user -d wire2 -c "\dt"
```

### Frontend Issues

**Problem**: Frontend not loading
```bash
# Check if files exist
ls -la /opt/wire2/frontend/dist-wire/

# Check Nginx configuration
nginx -t

# Check Nginx logs
tail -f /var/log/nginx/error.log
```

### Email Issues

**Problem**: Emails not sending
```bash
# Check EMAIL_PROVIDER setting
docker exec wire2-backend-prod env | grep EMAIL_PROVIDER

# If using console mode, check logs
docker logs wire2-backend-prod | grep EMAIL

# Verify email credentials in .env.production
cat /etc/wire2/.env.production | grep -i mail
```

## Manual Recovery

If deployment fails, you can manually recover:

### 1. Stop All Services
```bash
cd /opt/wire2
docker compose -f docker-compose.prod.yml down
```

### 2. Check Git Status
```bash
cd /opt/wire2
git status
git log --oneline -5
```

### 3. Reset to Clean State
```bash
cd /opt/wire2
git fetch origin main
git reset --hard origin/main
git clean -fd
```

### 4. Re-run Deployment
```bash
bash scripts/deploy_prod_droplet.sh
```

## Verification Checklist

After deployment, verify:

- [ ] Backend health: `curl https://wire.pose.xyz/api/wire/health`
- [ ] Frontend loads: `curl https://wire.pose.xyz/v2/`
- [ ] Login works: Try logging in at `https://wire.pose.xyz/v2/login`
- [ ] Database connected: Check backend logs for connection errors
- [ ] Migrations applied: `docker exec wire2-postgres-prod psql -U wire2_user -d wire2 -c "\dt"`
- [ ] Emails configured: Check `EMAIL_PROVIDER` in environment

## Best Practices

1. **Always deploy from GitHub** - Never modify code directly on the droplet
2. **Test migrations first** - Run migrations in a test environment if possible
3. **Monitor logs** - Watch backend logs during deployment
4. **Backup database** - Before major deployments, backup the database
5. **Deploy during low traffic** - Schedule deployments during maintenance windows

## Quick Deploy Command

For a quick deploy after pushing to GitHub:

```bash
ssh root@<droplet-ip> "cd /opt/wire2 && bash scripts/deploy_prod_droplet.sh"
```

## Support

If deployment fails:
1. Check the deployment script output for the failing step
2. Review logs for the failing service
3. Verify environment variables are correct
4. Ensure database is accessible
5. Check Nginx configuration
