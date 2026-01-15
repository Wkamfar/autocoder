# Fix Repository Structure - Remove Absolute Paths

## Problem
Files were committed with absolute paths like `...` instead of relative paths like `frontend/...`. This causes issues when cloning the repository.

## Solution

Run these commands to fix the repository structure:

```bash
cd /Users/lmnop/wire2

# 1. Ensure we're on main and up to date
git checkout main
git pull origin main

# 2. Remove all files with wrong paths from git index
git ls-tree -r --name-only HEAD | grep "^" | while read path; do
  if [ -n "$path" ]; then
    echo "Removing: $path"
    git rm --cached "$path" 2>/dev/null || true
  fi
done

# 3. Verify critical files exist at correct paths
echo "Verifying files exist at correct paths..."
ls -la frontend/src/wire/api/client.ts
ls -la frontend/Dockerfile
ls -la backend/src/app.ts
ls -la scripts/deploy_prod_droplet.sh

# 4. Stage all files at correct paths (if any are untracked)
git add frontend/ backend/ scripts/ *.sh *.md docker-compose*.yml 2>/dev/null || true

# 5. Review changes
git status

# 6. Commit the fix
git commit -m "Fix repository structure: remove files with absolute paths

- Remove all files committed with  prefix
- All files should use relative paths from repository root
- This fixes deployment issues on servers"

# 7. Push to remote
git push origin main
```

## Files That Need to Be Fixed

Based on git history, these files were committed with wrong paths:
- `frontend/src/wire/api/client.ts` → should be `frontend/src/wire/api/client.ts`
- `frontend/src/wire/pages/WireFastWireTestPage.tsx` → should be `frontend/src/wire/pages/WireFastWireTestPage.tsx`
- `scripts/fix-failed-migration.sh` → should be `scripts/fix-failed-migration.sh`
- `backend/scripts/fix-migration-state.sh` → should be `backend/scripts/fix-migration-state.sh`
- `scripts/deploy_prod_droplet.sh` → should be `scripts/deploy_prod_droplet.sh`
- Various `.md` files in `` → should be at root

## After Fix

After pushing the fix:
1. On the droplet, pull the latest code
2. The repository structure will be correct
3. Deployment should work without path issues
