#!/usr/bin/env bash
set -euo pipefail

# Complete removal of Desktop/pose-os folder from repository
# This will remove ALL files with Desktop prefix from git

cd "$(dirname "$0")/.."

echo "=== Removing Desktop/pose-os folder completely ==="

git checkout main
git fetch origin main
git reset --hard origin/main

# Get all Desktop files
echo "Finding all Desktop files..."
DESKTOP_FILES=$(git ls-tree -r HEAD --name-only | grep "^Desktop" || true)

if [ -z "$DESKTOP_FILES" ]; then
  echo "No Desktop files found. Repository is clean."
  exit 0
fi

COUNT=$(echo "$DESKTOP_FILES" | wc -l | tr -d ' ')
echo "Found $COUNT files with Desktop prefix"
echo ""

# Remove all Desktop files
echo "Removing Desktop files from git..."
echo "$DESKTOP_FILES" | while read -r path; do
  if [ -n "$path" ]; then
    echo "Removing: $path"
    git rm --cached "$path" 2>/dev/null || true
  fi
done

echo ""
echo "=== Review Changes ==="
git status --short | head -50

echo ""
echo "=== Commit and Push ==="
echo "To complete the removal:"
echo "  git commit -m 'Remove Desktop/pose-os folder from repository'"
echo "  git push origin main"
