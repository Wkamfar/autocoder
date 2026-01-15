# WIRE2 Troubleshooting Quick Reference

## Common Issues and Fixes

### 1. Login Fails with "Request failed"

**Symptoms**: Login page shows "Request failed" error

**Diagnosis**:
```bash
# Check backend logs
docker logs --tail 100 wire2-backend-prod

# Check if backend is running
docker ps | grep wire2-backend-prod

# Test health endpoint
curl http://127.0.0.1:8000/api/wire/health
```

**Common Causes**:
- Backend not running
- Database connection failed
- Missing environment variables
- Database migrations not applied

**Fix**:
```bash
cd /opt/wire2
# Check backend status
docker compose -f docker-compose.prod.yml ps

# Restart backend
docker compose -f docker-compose.prod.yml restart wire-backend

# Check logs
docker logs --tail 200 wire2-backend-prod
```

### 2. Database Connection Errors

**Symptoms**: Backend logs show "Can't reach database server" or "Connection refused"

**Diagnosis**:
```bash
# Check if postgres is running
docker ps | grep wire2-postgres-prod

# Test database connection
docker exec -it wire2-postgres-prod psql -U wire2_user -d wire2 -c "SELECT 1;"

# Check DATABASE_URL
docker exec wire2-backend-prod env | grep DATABASE_URL
```

**Fix**:
```bash
cd /opt/wire2
# Restart postgres
docker compose -f docker-compose.prod.yml restart postgres

# Wait for postgres to be ready
sleep 5

# Restart backend
docker compose -f docker-compose.prod.yml restart wire-backend
```

### 3. Database Migrations Failed

**Symptoms**: Deployment fails at migration step, or tables missing

**Diagnosis**:
```bash
# Check migration logs
docker logs wire2-migrate-prod

# Check what tables exist
docker exec -it wire2-postgres-prod psql -U wire2_user -d wire2 -c "\dt"

# Check migration status
docker exec -it wire2-postgres-prod psql -U wire2_user -d wire2 -c "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"
```

**Fix**:
```bash
cd /opt/wire2
# Run migrations manually
docker compose -f docker-compose.prod.yml run --rm wire-migrate

# If that fails, check database connection
docker exec -it wire2-postgres-prod psql -U wire2_user -d wire2
```

### 4. Emails Not Sending

**Symptoms**: No emails received for password reset, approvals, etc.

**Diagnosis**:
```bash
# Check EMAIL_PROVIDER setting
docker exec wire2-backend-prod env | grep EMAIL_PROVIDER

# Check email logs (if console mode)
docker logs wire2-backend-prod | grep -i email

# Check email configuration
cat /etc/wire2/.env.production | grep -i mail
```

**Fix**:
```bash
# If EMAIL_PROVIDER=console, emails only log to console
# To enable real emails, set in /etc/wire2/.env.production:
# EMAIL_PROVIDER=mailgun
# MAILGUN_API_KEY=<your-key>
# MAILGUN_DOMAIN=<your-domain>

# Then restart backend
cd /opt/wire2
docker compose -f docker-compose.prod.yml restart wire-backend
```

### 5. Frontend Not Loading

**Symptoms**: 404 or blank page when accessing `/v2/`

**Diagnosis**:
```bash
# Check if frontend files exist
ls -la /opt/wire2/frontend/dist-wire/

# Check Nginx configuration
nginx -t

# Check Nginx error logs
tail -f /var/log/nginx/error.log

# Test Nginx directly
curl -I http://127.0.0.1/v2/
```

**Fix**:
```bash
cd /opt/wire2
# Rebuild and deploy frontend
bash deploy-frontend.sh

# Or manually
cd frontend
docker build -t wire2-frontend:latest -f Dockerfile .
docker create --name wire-frontend-tmp wire2-frontend:latest
docker cp wire-frontend-tmp:/usr/share/nginx/html/. /opt/wire2/frontend/dist-wire/
docker rm wire-frontend-tmp

# Reload Nginx
nginx -t && systemctl reload nginx
```

### 6. System Feels "Janky" or Unresponsive

**Symptoms**: Slow responses, timeouts, intermittent failures

**Diagnosis**:
```bash
# Check resource usage
docker stats --no-stream

# Check backend logs for errors
docker logs --tail 200 wire2-backend-prod | grep -i error

# Check database performance
docker exec -it wire2-postgres-prod psql -U wire2_user -d wire2 -c "SELECT count(*) FROM \"Intent\";"

# Check Redis
docker exec -it wire2-redis-prod redis-cli ping
```

**Fix**:
```bash
# Restart all services
cd /opt/wire2
docker compose -f docker-compose.prod.yml restart

# Or full redeploy
bash scripts/deploy_prod_droplet.sh
```

### 7. Code Not Updating After Git Pull

**Symptoms**: Changes pushed to GitHub but not reflected on droplet

**Diagnosis**:
```bash
# Check current commit
cd /opt/wire2
git log --oneline -1

# Check if there are local changes
git status

# Check what's actually running
docker inspect wire2-backend-prod | grep -i image
```

**Fix**:
```bash
cd /opt/wire2
# Force pull and reset
git fetch origin main
git reset --hard origin/main
git clean -fd

# Rebuild and restart
docker compose -f docker-compose.prod.yml build wire-backend
docker compose -f docker-compose.prod.yml up -d wire-backend
```

## Quick Health Check Script

Save this as `/opt/wire2/health-check.sh`:

```bash
#!/bin/bash
echo "=== WIRE2 Health Check ==="
echo ""
echo "Backend Health:"
curl -s http://127.0.0.1:8000/api/wire/health | head -c 200
echo ""
echo ""
echo "Database:"
docker exec wire2-postgres-prod psql -U wire2_user -d wire2 -c "SELECT 1;" >/dev/null 2>&1 && echo "✓ Connected" || echo "✗ Failed"
echo ""
echo "Redis:"
docker exec wire2-redis-prod redis-cli ping >/dev/null 2>&1 && echo "✓ Connected" || echo "✗ Failed"
echo ""
echo "Frontend Files:"
[ -f /opt/wire2/frontend/dist-wire/index.html ] && echo "✓ Present" || echo "✗ Missing"
echo ""
echo "Nginx:"
nginx -t >/dev/null 2>&1 && echo "✓ Config valid" || echo "✗ Config invalid"
echo ""
echo "Git Status:"
cd /opt/wire2 && git log --oneline -1
```

## Emergency Reset

If everything is broken:

```bash
cd /opt/wire2

# Stop everything
docker compose -f docker-compose.prod.yml down

# Clean git state
git fetch origin main
git reset --hard origin/main
git clean -fd

# Re-run deployment
bash scripts/deploy_prod_droplet.sh
```

## Getting Help

1. **Check logs first**: `docker logs <container-name>`
2. **Verify environment**: `cat /etc/wire2/.env.production`
3. **Check git status**: `cd /opt/wire2 && git status`
4. **Review deployment guide**: See `DEPLOYMENT_GUIDE.md`
