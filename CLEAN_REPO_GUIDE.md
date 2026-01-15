# Create Clean Wire2-Only Repository

## Problem
The current repository has:
- `` folder in git history
- Mixed content from pose-os and wire2
- Absolute paths causing deployment issues

## Solution
Create a completely clean wire2-only repository with:
- Only wire2 files (frontend, backend, scripts, docs)
- All relative paths (no Desktop/pose-os)
- Fresh git history
- Ready for deployment

## Steps

### 1. Create Clean Repository

```bash
cd /Users/lmnop/wire2
./scripts/create-clean-wire2-repo.sh
```

This will:
- Create `/Users/lmnop/Desktop/wire2-clean/` with all wire2 files
- Initialize a fresh git repository
- Remove all absolute path references
- Create a clean initial commit

### 2. Review the Clean Repository

```bash
cd /Users/lmnop/Desktop/wire2-clean
ls -la
git log
git status
```

Verify:
- ✅ All wire2 files are present
- ✅ No `Desktop/pose-os` folder
- ✅ All paths are relative
- ✅ `.gitignore` is correct

### 3. Push to GitHub

**Option A: Push to new branch (recommended first)**

```bash
cd /Users/lmnop/Desktop/wire2-clean
git remote add origin git@github.com:a0ix/wire.git
git push -u origin main:wire2-clean
```

Then review on GitHub before merging to main.

**Option B: Force push to main (replaces everything)**

```bash
cd /Users/lmnop/Desktop/wire2-clean
git remote add origin git@github.com:a0ix/wire.git
git push -u origin main --force
```

⚠️ **WARNING**: This will overwrite the existing main branch!

### 4. Update Droplet

After pushing to GitHub:

```bash
ssh root@<droplet-ip>
cd /opt/wire2

# Update remote URL if needed
git remote set-url origin git@github.com:a0ix/wire.git

# Pull the clean repository
git fetch origin
git reset --hard origin/main

# Verify structure
ls -la
ls -la frontend/
ls -la backend/

# Run deployment
bash scripts/deploy_prod_droplet.sh
```

### 5. Verify Deployment

- Check GitHub: https://github.com/a0ix/wire
  - Should see clean structure (no Desktop folder)
  - All files at root level (frontend/, backend/, scripts/, etc.)

- Check droplet:
  - `git pull` should work without path issues
  - Deployment script should find all files
  - Frontend and backend should build correctly

## What Gets Included

✅ **Included:**
- `frontend/` - Complete React frontend
- `backend/` - Complete Node.js backend
- `scripts/` - All deployment scripts
- `docs/` - All documentation
- `sdk/` - SDK packages
- `.github/` - CI/CD workflows
- All `.md` files (roadmap, guides, etc.)
- `docker-compose*.yml` - Docker configs
- `package.json`, `tsconfig.json`, etc.

❌ **Excluded:**
- `node_modules/` - Dependencies (reinstall)
- `dist/`, `dist-wire/` - Build artifacts (rebuild)
- `.env*` files - Environment variables (set on server)
- `` - Not part of wire2
- Build caches and temp files

## Repository Structure (After Clean)

```
wire2/
├── .github/
│   └── workflows/
├── backend/
│   ├── src/
│   ├── prisma/
│   ├── Dockerfile
│   └── ...
├── frontend/
│   ├── src/
│   ├── public/
│   ├── Dockerfile
│   └── ...
├── scripts/
│   └── deploy_prod_droplet.sh
├── docs/
├── sdk/
├── docker-compose.prod.yml
├── README.md
├── WIRE2_BANK_GRADE_ROADMAP.md
└── ...
```

## Benefits

1. **Clean History**: No Desktop/pose-os folder in git
2. **Relative Paths**: All paths are relative, works anywhere
3. **Easy Deployment**: `git pull` works on any server
4. **Clear Structure**: Only wire2 files, easy to understand
5. **No Conflicts**: Fresh start eliminates path issues

## Rollback Plan

If something goes wrong:

1. The original repository is still at `/Users/lmnop/wire2`
2. You can always restore from the old remote branch
3. The clean repo is in `/Users/lmnop/Desktop/wire2-clean` (separate)

## Next Steps After Clean Repo

1. ✅ Push clean repository to GitHub
2. ✅ Update droplet to use clean repo
3. ✅ Test deployment
4. ✅ Verify all features work
5. ✅ Delete old Desktop/pose-os references from git history (optional, using git filter-branch if needed)
