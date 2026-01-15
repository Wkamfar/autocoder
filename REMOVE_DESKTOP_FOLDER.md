# Remove Desktop Folder from GitHub

## The Problem
GitHub's web interface is showing a `Desktop/pose-os` folder even though the current HEAD doesn't have it. This is likely because:
1. The files exist in git history (previous commits)
2. GitHub's web interface may cache or show files from history

## The Solution

The Desktop folder files are in git history but not in the current HEAD. To completely remove them from GitHub's view, we need to ensure they're not in any recent commits that GitHub might be displaying.

### Option 1: Verify Current State (Recommended First)

```bash
cd /Users/lmnop/wire2

# Check what's actually in HEAD
git ls-tree -r HEAD --name-only | grep "^Desktop"
# Should return nothing

# Check what GitHub sees
git ls-tree -r origin/main --name-only | grep "^Desktop"  
# Should return nothing

# If both return nothing, the Desktop folder is already removed from the repository
```

### Option 2: Force Push a Clean State

If GitHub still shows it, it might be cached. Try:

```bash
cd /Users/lmnop/wire2

# Make sure we're clean
git checkout main
git pull origin main

# Create an empty commit to force GitHub to refresh
git commit --allow-empty -m "Refresh repository view - remove Desktop folder"
git push origin main
```

### Option 3: If Desktop Files Still Exist in Remote

If `git show origin/main:...` still works, the files are in the remote. Remove them:

```bash
cd /Users/lmnop/wire2

# Reset to remote
git reset --hard origin/main

# Find and remove Desktop files
git ls-tree -r HEAD --name-only | grep "^Desktop" | while read path; do
  git rm --cached "$path"
done

# Commit and push
git commit -m "Remove Desktop/pose-os folder from repository"
git push origin main
```

## Verification

After pushing, check GitHub:
1. Go to https://github.com/a0ix/wire
2. The `Desktop/pose-os` folder should no longer appear
3. All files should be at correct relative paths (e.g., `frontend/`, `backend/`)

## Note

If the Desktop folder still appears on GitHub after these steps, it might be:
- A GitHub caching issue (wait a few minutes and refresh)
- Files in a different branch (check all branches)
- GitHub showing files from history (this is normal and doesn't affect functionality)
