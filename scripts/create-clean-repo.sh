#!/usr/bin/env bash
set -euo pipefail

# Create a clean wire2-only repository
# This script will:
# 1. Create a new directory with only wire2 files
# 2. Initialize a fresh git repository
# 3. Copy all wire2 files with correct relative paths
# 4. Create initial commit
# 5. Set up remote

cd "$(dirname "$0")/.."

CLEAN_REPO_DIR="/Users/lmnop/Desktop/wire2-clean"
SOURCE_DIR="/Users/lmnop/wire2"

echo "=== Creating Clean Wire2 Repository ==="
echo "Source: $SOURCE_DIR"
echo "Target: $CLEAN_REPO_DIR"
echo ""

# Remove old clean repo if it exists
if [ -d "$CLEAN_REPO_DIR" ]; then
  echo "Removing existing clean repo directory..."
  rm -rf "$CLEAN_REPO_DIR"
fi

# Create new directory
echo "Creating clean repository directory..."
mkdir -p "$CLEAN_REPO_DIR"
cd "$CLEAN_REPO_DIR"

# Initialize git
echo "Initializing git repository..."
git init
git branch -M main

# Copy all wire2 files (exclude .git, node_modules, dist, etc.)
echo "Copying wire2 files..."
rsync -av \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='dist-wire' \
  --exclude='.next' \
  --exclude='.cache' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='tsconfig.tsbuildinfo' \
  "$SOURCE_DIR/" "$CLEAN_REPO_DIR/"

# Remove any Desktop/pose-os references if they exist
echo "Cleaning up any Desktop/pose-os references..."
find . -type f -name "*.md" -o -name "*.sh" | xargs sed -i '' 's|||g' 2>/dev/null || true
find . -type f -name "*.md" -o -name "*.sh" | xargs sed -i '' 's|||g' 2>/dev/null || true

# Create .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
  cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
*.log

# Production
dist/
dist-wire/
build/
.next/
out/

# Misc
.DS_Store
*.pem
.env*.local
.env.production.local
.env.development.local

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env
.env.local
.env.development
.env.test
.env.production

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
EOF
fi

# Stage all files
echo "Staging files..."
git add .

# Create initial commit
echo "Creating initial commit..."
git commit -m "Initial commit: clean wire2 repository

- All wire2 frontend, backend, scripts, and docs
- Removed Desktop/pose-os folder and absolute paths
- Clean repository structure for deployment"

echo ""
echo "=== Clean Repository Created ==="
echo "Location: $CLEAN_REPO_DIR"
echo ""
echo "Next steps:"
echo "1. Review the repository: cd $CLEAN_REPO_DIR"
echo "2. Add remote: git remote add origin git@github.com:a0ix/wire.git"
echo "3. Push to new branch: git push -u origin main:wire2-clean"
echo "   OR force push to main: git push -u origin main --force"
echo ""
echo "⚠️  WARNING: Force pushing will overwrite the remote main branch!"
echo "   Consider pushing to a new branch first to review."
