#!/usr/bin/env bash
set -euo pipefail

# Fix repository structure by removing all files with absolute paths
# This script removes all files committed with  prefix

cd "$(dirname "$0")/.."

echo "=== Fixing Repository Structure ==="
echo "Removing all files with  prefix from git"

# Ensure we're on main and up to date
git checkout main
git pull origin main || true

# Get all files with wrong paths
WRONG_PATHS=$(git ls-tree -r --name-only HEAD | grep "^" || true)

if [ -z "$WRONG_PATHS" ]; then
  echo "No files with wrong paths found. Repository structure is correct."
  exit 0
fi

COUNT=$(echo "$WRONG_PATHS" | wc -l | tr -d ' ')
echo "Found $COUNT files with wrong paths"
echo ""

# Remove each file from git index
echo "Removing files from git index..."
echo "$WRONG_PATHS" | while read -r path; do
  if [ -n "$path" ]; then
    git rm --cached "$path" 2>/dev/null || true
  fi
done

echo ""
echo "=== Verifying Critical Files Exist at Correct Paths ==="

# Check critical files
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
  echo "You may need to manually ensure they exist."
fi

echo ""
echo "=== Review Changes ==="
git status --short | head -30

echo ""
echo "=== Next Steps ==="
echo "1. Review the changes above"
echo "2. If everything looks good, commit:"
echo "   git commit -m 'Fix repository structure: remove files with absolute paths'"
echo "3. Push to remote:"
echo "   git push origin main"
