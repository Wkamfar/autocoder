# WIREv2 Deployment Options - Which Droplet?

## Your Current Setup

- **Pose Core Droplet**: `165.227.68.201` (4GB RAM, 2 vCPUs)
  - Running: Backend API, PostgreSQL, possibly Hardhat node
  - Domain: `api.testnet.pose.xyz`

- **Tavern v2 Droplet**: `159.65.240.95` (4GB RAM, 2 vCPUs)
  - Running: Tavern v2 application

## WIREv2 Resource Requirements

- **PostgreSQL**: ~200-500MB RAM
- **Redis** (optional): ~100MB RAM
- **Backend** (Node.js): ~300-500MB RAM
- **Frontend**: Static files only (no RAM needed, just disk)
- **Total**: ~600MB - 1.1GB RAM

## Recommendations

### Option 1: Share with Pose Core (RECOMMENDED) ⭐

**Why:**
- Related projects (both use POSE infrastructure)
- Can potentially share PostgreSQL database
- Easier to manage related services together
- Saves cost (~$12/month)

**Requirements:**
- Check current RAM usage: `free -h` and `docker stats`
- Need at least 1.5GB free RAM
- May need to optimize existing services

**Steps:**
```bash
# SSH into pose core droplet
ssh root@165.227.68.201

# Check current resource usage
free -h
docker stats --no-stream
df -h

# If you have ~1.5GB+ free RAM, deploy WIREv2 here
```

**Nginx Configuration:**
- Add new server block for `wire.pose.xyz`
- Keep existing `api.testnet.pose.xyz` configuration
- Both can coexist on same server

**Database Options:**
1. **Separate PostgreSQL** (recommended): Run WIREv2's own PostgreSQL container
2. **Shared PostgreSQL**: Use same database server, different database name

### Option 2: Share with Tavern v2

**Pros:**
- Separated from core infrastructure
- May have more free resources

**Cons:**
- Less related to Tavern project
- No obvious shared infrastructure

### Option 3: New Droplet

**When to use:**
- Both existing droplets are resource-constrained
- Want complete isolation
- Budget allows (~$12/month for 4GB droplet)

**Recommendation:**
Only if Option 1 doesn't work due to resources

## Quick Resource Check

Run these commands on your pose core droplet:

```bash
# Check memory
free -h

# Check Docker resource usage
docker stats --no-stream

# Check disk space
df -h

# Check running containers
docker ps
docker compose ps  # if using compose
```

## Recommended Setup: Share with Pose Core

If your pose core droplet has available resources, deploy WIREv2 there:

### 1. Deploy on Same Server

```bash
# SSH into pose core
ssh root@165.227.68.201

# Create wire2 directory (separate from pose-core)
mkdir -p /opt/wire2
cd /opt/wire2

# Upload/deploy WIREv2 here
# Follow QUICK_DEPLOY_GUIDE.md
```

### 2. Update Nginx

Add to `/etc/nginx/sites-available/wire.pose.xyz`:

```nginx
# Existing: api.testnet.pose.xyz stays as-is
# New: Add wire.pose.xyz configuration

upstream wire_backend {
    server 127.0.0.1:8000;  # WIREv2 backend
}

server {
    listen 443 ssl http2;
    server_name wire.pose.xyz;
    
    # SSL config (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/wire.pose.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wire.pose.xyz/privkey.pem;
    
    # Frontend
    location / {
        root /opt/wire2/frontend/dist-wire;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api {
        proxy_pass http://wire_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Port Configuration

- Pose Core API: Port 3001 (existing)
- WIREv2 Backend: Port 8000 (new)
- Nginx: Ports 80, 443 (shared)

### 4. Docker Networks

Run WIREv2 in its own Docker network to avoid conflicts:

```yaml
# In docker-compose.prod.yml
networks:
  wire2-network-prod:
    driver: bridge
    # Separate from pose-core networks
```

## Action Plan

1. **Check Resources** (2 minutes):
   ```bash
   ssh root@165.227.68.201
   free -h
   docker stats --no-stream
   ```

2. **If resources OK** (1.5GB+ free):
   - Deploy WIREv2 on pose core droplet
   - Follow QUICK_DEPLOY_GUIDE.md
   - Update Nginx with new server block

3. **If resources tight**:
   - Option A: Upgrade pose core droplet to 8GB ($24/month → $48/month)
   - Option B: Create new 4GB droplet for WIREv2 ($12/month)

## Cost Comparison

- **Option 1** (share with pose core): $0 extra/month ⭐
- **Option 2** (share with tavern): $0 extra/month
- **Option 3** (new droplet): +$12/month (4GB) or +$24/month (8GB)

## My Recommendation

**Start with Option 1** (share with pose core):
- They're related projects
- Can optimize if resources are tight
- Easy to migrate later if needed
- Check resources first, then deploy

If pose core is already maxed out, Option 3 (new droplet) is cleaner than upgrading.
