#!/usr/bin/env bash
set -euo pipefail

# Force remove Desktop folder from remote repository
# This script will create a commit that removes all Desktop/ files

cd "$(dirname "$0")/.."

echo "=== Force Removing Desktop Folder ==="

git checkout main
git fetch origin main
git reset --hard origin/main

# Get all Desktop files from remote
echo "Finding Desktop files in remote..."
DESKTOP_FILES=$(git ls-tree -r origin/main --name-only | grep "^Desktop" || true)

if [ -z "$DESKTOP_FILES" ]; then
  echo "No Desktop files found in remote. Repository is clean."
  exit 0
fi

COUNT=$(echo "$DESKTOP_FILES" | wc -l | tr -d ' ')
echo "Found $COUNT files with Desktop prefix"
echo ""

# Remove each file
echo "Removing Desktop files from git index..."
echo "$DESKTOP_FILES" | while read -r path; do
  if [ -n "$path" ]; then
    echo "Removing: $path"
    git rm --cached "$path" 2>/dev/null || true
  fi
done

echo ""
echo "=== Review Changes ==="
git status --short | head -30

echo ""
echo "=== Commit and Push ==="
echo "Files have been removed from git index."
echo ""
echo "To complete the fix, run:"
echo "  git commit -m 'Remove Desktop/pose-os folder from repository'"
echo "  git push origin main"
