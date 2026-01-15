# Fix Repository Paths - Complete Guide

## Problem
Files were committed to the repository with absolute paths like `...` instead of relative paths like `frontend/...`. This causes issues when cloning the repository on servers.

## Solution

Run this script to fix the repository structure:

```bash
cd /Users/lmnop/wire2
./scripts/fix-repo-paths-complete.sh
```

## Manual Fix (if script doesn't work)

If the script doesn't work, follow these steps:

### Step 1: Check what's in remote
```bash
cd /Users/lmnop/wire2
git fetch origin main

# Check if files exist at wrong paths
git show origin/main:frontend/src/wire/api/client.ts | head -5
```

### Step 2: Extract files from wrong paths to correct paths
```bash
# For each file with wrong path, extract it to correct path
git show origin/main:frontend/src/wire/api/client.ts > frontend/src/wire/api/client.ts
git show origin/main:frontend/Dockerfile > frontend/Dockerfile
# ... repeat for all files
```

### Step 3: Remove wrong paths from git
```bash
# Remove all files with wrong paths
git rm --cached frontend/src/wire/api/client.ts
git rm --cached frontend/Dockerfile
# ... repeat for all files
```

### Step 4: Add files at correct paths
```bash
git add frontend/ backend/ scripts/
```

### Step 5: Commit and push
```bash
git commit -m "Fix repository structure: remove absolute paths, use relative paths"
git push origin main
```

## Verification

After pushing, verify on the server:
```bash
cd /opt/wire2
git pull origin main
ls -la frontend/Dockerfile  # Should exist
ls -la frontend/src/wire/api/client.ts  # Should exist
```

## Prevention

To prevent this in the future:
1. Always use relative paths when adding files: `git add frontend/file.ts` not `git add /Users/.../file.ts`
2. Check `git status` before committing to ensure paths are correct
3. Use `git add .` from the repository root, not from parent directories
