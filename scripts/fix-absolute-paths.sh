#!/usr/bin/env bash
set -euo pipefail

# Fix repository by removing all files with absolute paths from remote
# This script will:
# 1. Fetch the latest from remote
# 2. Remove all files with  prefix
# 3. Ensure files exist at correct relative paths
# 4. Commit and push the fix

cd "$(dirname "$0")/.."

echo "=== Fixing Absolute Paths in Repository ==="

# Ensure we're on main
git checkout main

# Fetch latest
echo "Fetching latest from remote..."
git fetch origin main

# Checkout remote to see what's there
echo "Checking what files exist in remote..."
WRONG_PATHS=$(git ls-tree -r --name-only origin/main | grep "^" || true)

if [ -z "$WRONG_PATHS" ]; then
  echo "No files with wrong paths found in remote. Repository is already correct."
  exit 0
fi

COUNT=$(echo "$WRONG_PATHS" | wc -l | tr -d ' ')
echo "Found $COUNT files with wrong paths in remote"
echo ""

# Merge remote changes first
echo "Merging remote changes..."
git merge origin/main --no-edit || git merge --abort 2>/dev/null || true

# Now remove all files with wrong paths from git index
echo "Removing files with wrong paths from git index..."
echo "$WRONG_PATHS" | while read -r path; do
  if [ -n "$path" ]; then
    CORRECT_PATH="${path#}"
    echo "Removing: $path"
    # Remove from index if it exists
    git rm --cached "$path" 2>/dev/null || true
    
    # If the file exists at the correct path locally, ensure it's tracked
    if [ -f "$CORRECT_PATH" ]; then
      echo "  -> File exists at correct path: $CORRECT_PATH"
      git add -f "$CORRECT_PATH" 2>/dev/null || true
    else
      echo "  -> WARNING: File does not exist at correct path: $CORRECT_PATH"
      # Try to restore from the wrong path
      if git show "origin/main:$path" > "$CORRECT_PATH" 2>/dev/null; then
        echo "  -> Restored from wrong path to: $CORRECT_PATH"
        git add "$CORRECT_PATH"
        # Create directory if needed
        mkdir -p "$(dirname "$CORRECT_PATH")"
      fi
    fi
  fi
done

echo ""
echo "=== Review Changes ==="
git status --short | head -50

echo ""
echo "=== Summary ==="
echo "Files with wrong paths have been removed from git index."
echo ""
echo "Next steps:"
echo "1. Review the changes above"
echo "2. If files are missing at correct paths, you may need to restore them from "
echo "3. Commit the fix:"
echo "   git commit -m 'Fix repository structure: remove files with absolute paths'"
echo "4. Push to remote:"
echo "   git push origin main"
