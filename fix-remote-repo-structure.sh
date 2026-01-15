#!/usr/bin/env bash
set -euo pipefail

# Fix remote repository structure by removing files with absolute paths
# This creates a new commit that removes all  prefixed files

cd "$(dirname "$0")"

echo "=== Fixing Remote Repository Structure ==="
echo "This will remove all files with  prefix from git"

# Fetch latest
git fetch origin main

# Get all files with wrong paths from remote
WRONG_PATHS=$(git ls-tree -r --name-only origin/main | grep "^" || true)

if [ -z "$WRONG_PATHS" ]; then
  echo "No files with wrong paths found in remote. Repository structure is correct."
  exit 0
fi

echo "Found $(echo "$WRONG_PATHS" | wc -l) files with wrong paths in remote"
echo ""
echo "Removing from git index..."

# Checkout the remote branch
git checkout -b fix-repo-structure origin/main

# Remove each file from git index
echo "$WRONG_PATHS" | while read -r path; do
  if [ -n "$path" ]; then
    # Check if equivalent file exists at correct path
    CORRECT_PATH="${path#}"
    if [ -f "$CORRECT_PATH" ]; then
      echo "Removing wrong path: $path (correct path exists: $CORRECT_PATH)"
      git rm --cached "$path" 2>/dev/null || true
    else
      echo "WARNING: $path has no equivalent at $CORRECT_PATH"
      # Still remove it, but warn
      git rm --cached "$path" 2>/dev/null || true
    fi
  fi
done

echo ""
echo "=== Review Changes ==="
git status --short | head -20

echo ""
echo "=== Next Steps ==="
echo "1. Review the changes: git status"
echo "2. If everything looks good, commit:"
echo "   git commit -m 'Fix repository structure: remove files with absolute paths'"
echo "3. Push to fix remote:"
echo "   git push origin fix-repo-structure:main"
echo ""
echo "Or to force push to main (DANGEROUS - only if you're sure):"
echo "   git push origin fix-repo-structure:main --force"
