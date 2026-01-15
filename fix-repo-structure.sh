#!/usr/bin/env bash
set -euo pipefail

# Fix repository structure by removing files with absolute paths
# This script removes all files committed with  prefix

cd "$(dirname "$0")"

echo "=== Fixing Repository Structure ==="
echo "Removing files with incorrect absolute paths..."

# Get all files with wrong paths
WRONG_PATHS=$(git ls-tree -r --name-only HEAD | grep "^" || true)

if [ -z "$WRONG_PATHS" ]; then
  echo "No files with wrong paths found. Repository structure is correct."
  exit 0
fi

echo "Found files with wrong paths. Removing from git index..."

# Remove each file from git index
echo "$WRONG_PATHS" | while read -r path; do
  if [ -n "$path" ]; then
    echo "Removing: $path"
    git rm --cached "$path" 2>/dev/null || true
  fi
done

# Verify correct paths exist for critical files
echo ""
echo "Verifying critical files exist at correct paths..."

CRITICAL_FILES=(
  "frontend/src/wire/api/client.ts"
  "frontend/Dockerfile"
  "backend/src/app.ts"
  "scripts/deploy_prod_droplet.sh"
)

ALL_EXIST=true
for file in "${CRITICAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file exists"
  else
    echo "✗ $file MISSING"
    ALL_EXIST=false
  fi
done

if [ "$ALL_EXIST" = false ]; then
  echo ""
  echo "WARNING: Some critical files are missing at correct paths!"
  echo "You may need to manually copy them from "
  exit 1
fi

echo ""
echo "=== Repository Structure Fixed ==="
echo "Files with wrong paths have been removed from git index."
echo "Review changes with: git status"
echo "Commit with: git commit -m 'Fix repository structure: remove absolute paths'"
