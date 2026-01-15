# Update Droplet to Use Clean Repository

The clean wire2 repository has been pushed to GitHub. Now update the droplet to use it.

## Steps

### 1. SSH to Droplet

```bash
ssh root@<droplet-ip>
```

### 2. Navigate to Wire2 Directory

```bash
cd /opt/wire2
```

### 3. Backup Current State (Optional but Recommended)

```bash
# Create backup
cp -r /opt/wire2 /opt/wire2-backup-$(date +%Y%m%d-%H%M%S)
```

### 4. Update Repository

```bash
cd /opt/wire2

# Fetch latest from GitHub
git fetch origin main

# Reset to clean repository (this will discard local changes)
git reset --hard origin/main

# Clean up any untracked files
git clean -fd
```

### 5. Verify Structure

```bash
# Check that files are at correct paths
ls -la frontend/Dockerfile
ls -la backend/Dockerfile
ls -la scripts/deploy_prod_droplet.sh
ls -la frontend/src/wire/api/client.ts

# Should NOT see Desktop folder
ls -la | grep -i desktop || echo "✓ No Desktop folder (good!)"
```

### 6. Run Deployment

```bash
# Make sure you're in the right directory
cd /opt/wire2

# Source environment if needed
source /etc/wire2/.env.production 2>/dev/null || true

# Run deployment script
bash scripts/deploy_prod_droplet.sh
```

### 7. Verify Deployment

```bash
# Check backend health
curl -fsS http://127.0.0.1:8000/api/wire/health | jq

# Check frontend is accessible
curl -fsS http://127.0.0.1:8080 | head -20

# Check containers
docker ps | grep wire2
```

## Troubleshooting

### If git reset fails:

```bash
# Remove and re-clone
cd /opt
rm -rf wire2
git clone git@github.com:a0ix/wire.git wire2
cd wire2
```

### If deployment script fails:

```bash
# Check logs
docker logs wire2-backend-prod --tail 50
docker logs wire2-postgres-prod --tail 50

# Check environment
cat /etc/wire2/.env.production | grep -v PASSWORD
```

### If files are missing:

```bash
# Verify git structure
cd /opt/wire2
git ls-tree -r HEAD --name-only | head -20

# Check for Desktop folder (should be empty)
git ls-tree -r HEAD --name-only | grep Desktop || echo "✓ No Desktop folder"
```

## Expected Result

After updating:
- ✅ Repository has clean structure (no Desktop/pose-os)
- ✅ All files at correct relative paths
- ✅ `git pull` works without path issues
- ✅ Deployment script finds all files
- ✅ Frontend and backend build successfully
- ✅ Application runs on wire.pose.xyz
