#!/usr/bin/env bash
set -euo pipefail

# Complete fix for repository structure
# This script will extract files from wrong paths and place them at correct paths

cd "$(dirname "$0")/.."

echo "=== Complete Repository Path Fix ==="

# Ensure we're on main and up to date
git checkout main
git fetch origin main

# Get all commits that have files with wrong paths
echo "Finding files with wrong paths..."
COMMITS_WITH_WRONG_PATHS=$(git log --all --oneline --name-only | grep -B 1 "" | grep "^[a-f0-9]" | sort -u)

# Get list of files from remote that have wrong paths
# Use git show to check if files exist at wrong paths
echo "Checking remote for files with wrong paths..."

# Try to get a sample file to verify the approach
SAMPLE_FILE="frontend/src/wire/api/client.ts"
if git show "origin/main:$SAMPLE_FILE" > /dev/null 2>&1; then
  echo "Found files with wrong paths in remote. Extracting and fixing..."
  
  # Get all files from remote with wrong paths
  # We'll use git ls-tree recursively on the remote
  git ls-tree -r --name-only origin/main | while read -r path; do
    if [[ "$path" == * ]]; then
      CORRECT_PATH="${path#}"
      echo "Processing: $path -> $CORRECT_PATH"
      
      # Extract file from remote
      if git show "origin/main:$path" > "$CORRECT_PATH.tmp" 2>/dev/null; then
        # Create directory if needed
        mkdir -p "$(dirname "$CORRECT_PATH")"
        # Move to correct location
        mv "$CORRECT_PATH.tmp" "$CORRECT_PATH"
        echo "  ✓ Extracted to: $CORRECT_PATH"
      else
        echo "  ✗ Failed to extract: $path"
      fi
    fi
  done
else
  echo "No files found with wrong paths in remote."
  exit 0
fi

echo ""
echo "=== Removing wrong paths from git ==="
# Now remove all wrong paths from git
git ls-tree -r --name-only HEAD | grep "^" | while read -r path; do
  echo "Removing from git: $path"
  git rm --cached "$path" 2>/dev/null || true
done

# Add all files at correct paths
echo ""
echo "=== Adding files at correct paths ==="
git add frontend/ backend/ scripts/ *.sh *.md docker-compose*.yml 2>/dev/null || true

echo ""
echo "=== Review Changes ==="
git status --short | head -50

echo ""
echo "=== Next Steps ==="
echo "1. Review the changes above"
echo "2. Commit the fix:"
echo "   git commit -m 'Fix repository structure: remove absolute paths, use relative paths'"
echo "3. Push to remote:"
echo "   git push origin main"
