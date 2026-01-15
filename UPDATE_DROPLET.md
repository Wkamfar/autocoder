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

### 4. Update Git Remote to HTTPS

The deployment script now uses HTTPS by default. Update your remote:

```bash
cd /opt/wire2

# Change remote to HTTPS (if it's currently SSH)
git remote set-url origin https://github.com/a0ix/wire.git

# Verify
git remote -v
# Should show: origin  https://github.com/a0ix/wire.git (fetch)
#              origin  https://github.com/a0ix/wire.git (push)
```

### 5. Update Repository

```bash
cd /opt/wire2

# Fetch latest from GitHub
git fetch origin main

# Reset to clean repository (this will discard local changes)
git reset --hard origin/main

# Clean up any untracked files
git clean -fd
```

### 6. Verify Structure

```bash
# Check that files are at correct paths
ls -la frontend/Dockerfile
ls -la backend/Dockerfile
ls -la scripts/deploy_prod_droplet.sh
ls -la frontend/src/wire/api/client.ts

# Should NOT see Desktop folder
ls -la | grep -i desktop || echo "✓ No Desktop folder (good!)"
```

### 7. Run Deployment

```bash
# Make sure you're in the right directory
cd /opt/wire2

# Source environment if needed
source /etc/wire2/.env.production 2>/dev/null || true

# Run deployment script
bash scripts/deploy_prod_droplet.sh
```

### 8. Verify Deployment

```bash
# Check backend health
curl -fsS http://127.0.0.1:8000/api/wire/health | jq

# Check frontend is accessible
curl -fsS http://127.0.0.1:8080 | head -20

# Check containers
docker ps | grep wire2
```

## Troubleshooting

### If git fetch fails with authentication:

```bash
# Option 1: Use HTTPS (public repo, no auth needed)
git remote set-url origin https://github.com/a0ix/wire.git

# Option 2: Use GitHub token (if repo is private)
export GITHUB_TOKEN=your_token_here
git remote set-url origin https://${GITHUB_TOKEN}@github.com/a0ix/wire.git
```

### If git reset fails:

```bash
# Remove and re-clone
cd /opt
rm -rf wire2
git clone https://github.com/a0ix/wire.git wire2
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
