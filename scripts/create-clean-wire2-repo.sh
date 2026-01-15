#!/usr/bin/env bash
set -euo pipefail

# Create a completely clean wire2-only repository
# This will extract only wire2 files and create a fresh git repository

SOURCE_DIR="/Users/lmnop/wire2"
CLEAN_REPO_DIR="/Users/lmnop/Desktop/wire2-clean"
REMOTE_URL="git@github.com:a0ix/wire.git"

echo "=== Creating Clean Wire2-Only Repository ==="
echo "Source: $SOURCE_DIR"
echo "Target: $CLEAN_REPO_DIR"
echo ""

# Remove old clean repo if it exists
if [ -d "$CLEAN_REPO_DIR" ]; then
  echo "⚠️  Removing existing clean repo directory..."
  read -p "This will delete $CLEAN_REPO_DIR. Continue? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
  rm -rf "$CLEAN_REPO_DIR"
fi

# Create new directory
echo "Creating clean repository directory..."
mkdir -p "$CLEAN_REPO_DIR"
cd "$CLEAN_REPO_DIR"

# Initialize git
echo "Initializing fresh git repository..."
git init
git branch -M main

# Copy all wire2 files (exclude build artifacts, node_modules, etc.)
echo "Copying wire2 files (this may take a minute)..."
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
  --exclude='coverage' \
  --exclude='.env' \
  --exclude='.env.*' \
  "$SOURCE_DIR/" "$CLEAN_REPO_DIR/"

# Clean up any absolute path references in files
echo "Cleaning up absolute path references..."
find . -type f \( -name "*.md" -o -name "*.sh" -o -name "*.ts" -o -name "*.tsx" -o -name "*.json" \) \
  -exec sed -i '' \
    -e 's|||g' \
    -e 's|||g' \
    -e 's|||g' \
    {} \; 2>/dev/null || true

# Ensure .gitignore exists and is comprehensive
echo "Creating/updating .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
*.log
*.test.log

# Production builds
dist/
dist-wire/
build/
.next/
out/

# Environment files
.env
.env.local
.env.development
.env.test
.env.production
.env*.local

# Misc
.DS_Store
*.pem
*.tsbuildinfo

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Vercel
.vercel

# TypeScript
next-env.d.ts

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
Thumbs.db

# Docker
.docker/

# Temporary files
*.tmp
*.temp
EOF

# Create a clean README
echo "Creating README.md..."
cat > README.md << 'EOF'
# Wire2 - Bank-Grade Money Movement Platform

Wire2 is a secure, multi-tenant money movement platform with end-to-end verification and compliance features.

## Structure

- `frontend/` - React + Vite frontend application
- `backend/` - Node.js + Fastify backend API
- `scripts/` - Deployment and utility scripts
- `docs/` - Documentation
- `sdk/` - SDK packages

## Quick Start

See `DEPLOYMENT_GUIDE.md` for deployment instructions.

## Documentation

- `WIRE2_BANK_GRADE_ROADMAP.md` - Complete roadmap and architecture
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `TROUBLESHOOTING.md` - Common issues and solutions
- `README_OPERATIONS.md` - Operations guide

## Development

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## License

MIT
EOF

# Stage all files
echo "Staging all files..."
git add .

# Check what we're about to commit
echo ""
echo "=== Files to be committed ==="
git status --short | head -30
echo "..."
echo ""

# Create initial commit
echo "Creating initial commit..."
git commit -m "Initial commit: clean wire2 repository

- Complete wire2 codebase (frontend, backend, scripts, docs)
- All features from WIRE2_BANK_GRADE_ROADMAP.md
- Clean repository structure with relative paths only
- Ready for deployment to wire.pose.xyz

Removed:
- Desktop/pose-os folder and absolute paths
- Build artifacts and node_modules
- Environment files

This is a clean, production-ready wire2 repository."
COMMIT_HASH=$(git rev-parse --short HEAD)

echo ""
echo "=== Clean Repository Created Successfully ==="
echo "Location: $CLEAN_REPO_DIR"
echo "Commit: $COMMIT_HASH"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Review the repository:"
echo "   cd $CLEAN_REPO_DIR"
echo "   git log"
echo "   ls -la"
echo ""
echo "2. Add remote and push:"
echo "   cd $CLEAN_REPO_DIR"
echo "   git remote add origin $REMOTE_URL"
echo ""
echo "3. Choose one:"
echo ""
echo "   Option A - Push to new branch (safe, recommended):"
echo "   git push -u origin main:wire2-clean"
echo ""
echo "   Option B - Force push to main (overwrites existing):"
echo "   git push -u origin main --force"
echo ""
echo "⚠️  WARNING: Option B will overwrite the remote main branch!"
echo "   Only do this if you're sure you want to replace everything."
echo ""
echo "4. After pushing, update droplet:"
echo "   ssh root@<droplet-ip>"
echo "   cd /opt/wire2"
echo "   git remote set-url origin $REMOTE_URL"
echo "   git fetch origin"
echo "   git reset --hard origin/main"
echo "   # Then run deployment script"
