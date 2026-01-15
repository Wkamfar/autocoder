#!/usr/bin/env bash
set -euo pipefail

# Remove Desktop/pose-os folder from git repository
# This script will remove all files with Desktop/pose-os prefix from git tracking

cd "$(dirname "$0")/.."

echo "=== Removing Desktop/pose-os folder from repository ==="

# Ensure we're on main
git checkout main
git fetch origin main

# Get all files/directories that start with Desktop
echo "Finding all files/directories with Desktop prefix..."
DESKTOP_FILES=$(git ls-tree -r --name-only HEAD | grep "^Desktop" || true)

if [ -z "$DESKTOP_FILES" ]; then
  # Try from remote
  DESKTOP_FILES=$(git ls-tree -r --name-only origin/main | grep "^Desktop" || true)
fi

if [ -z "$DESKTOP_FILES" ]; then
  echo "No Desktop files found in current HEAD or remote."
  echo "Checking git history..."
  
  # Check if Desktop folder exists in any commit
  if git log --all --name-only --oneline | grep -q "^Desktop"; then
    echo "Desktop folder found in git history. Removing from all tracked files..."
    
    # Remove Desktop folder recursively from git
    git rm -r --cached Desktop 2>/dev/null || true
    git rm -r --cached "Desktop/pose-os" 2>/dev/null || true
    git rm -r --cached "wire2" 2>/dev/null || true
    
    # Also try removing individual files if folder removal doesn't work
    git log --all --name-only --oneline | grep "^Desktop" | sort -u | while read -r path; do
      if [ -n "$path" ]; then
        echo "Removing: $path"
        git rm --cached "$path" 2>/dev/null || true
      fi
    done
  else
    echo "No Desktop folder found in git history."
    exit 0
  fi
else
  COUNT=$(echo "$DESKTOP_FILES" | wc -l | tr -d ' ')
  echo "Found $COUNT files/directories with Desktop prefix"
  echo ""
  echo "Removing from git..."
  
  echo "$DESKTOP_FILES" | while read -r path; do
    if [ -n "$path" ]; then
      echo "Removing: $path"
      git rm --cached "$path" 2>/dev/null || true
    fi
  done
fi

echo ""
echo "=== Review Changes ==="
git status --short | head -30

echo ""
echo "=== Summary ==="
echo "Desktop folder has been removed from git tracking."
echo ""
echo "Next steps:"
echo "1. Review the changes above"
echo "2. Commit the removal:"
echo "   git commit -m 'Remove Desktop/pose-os folder from repository'"
echo "3. Push to remote:"
echo "   git push origin main"
