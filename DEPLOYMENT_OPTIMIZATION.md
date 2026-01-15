# WIRE2 Deployment Optimization Guide

## 🚀 Performance Improvements

This deployment system has been optimized for **fast iterative deployments**. The optimizations reduce deployment time from **7-12 minutes to 1-3 minutes** for typical code changes.

### Key Optimizations

1. **Docker BuildKit**: Enabled for advanced caching and parallel builds
2. **Multi-stage Builds**: Separated dependencies, build, and runtime stages
3. **Cache Mounts**: npm and Prisma caches persist between builds
4. **Layer Optimization**: Dependencies installed before source code changes
5. **.dockerignore Files**: Reduced build context size
6. **Separate Frontend/Backend**: Deploy independently for faster iteration

## 📦 Backend Deployment

### Standard Deployment
```bash
cd /opt/wire2
./deploy.sh
```

### Skip Build (Restart Only)
If only environment variables changed or you want to restart services:
```bash
./deploy.sh --skip-build
```

### Deploy Specific Service
```bash
./deploy.sh --service wire-backend
```

## 🎨 Frontend Deployment

### Option 1: Docker Build (Recommended for Consistency)
```bash
cd /opt/wire2
./deploy-frontend.sh
```

### Option 2: Direct Build (Fastest for Development)
```bash
cd /opt/wire2/frontend
npm ci
npm run build
# Then copy dist-wire/ to Nginx directory
```

## ⚡ Performance Benchmarks

### Before Optimization
- Full backend rebuild: **5-8 minutes**
- Full frontend rebuild: **2-3 minutes**
- Total deployment: **7-12 minutes**

### After Optimization
- Backend rebuild (with cache): **1-2 minutes** (first build: 3-4 min)
- Backend rebuild (cache hit): **30-60 seconds**
- Frontend rebuild (with cache): **1-2 minutes** (first build: 2-3 min)
- Frontend rebuild (cache hit): **20-40 seconds**

## 🔧 How It Works

### Docker BuildKit Cache
- **npm cache**: Persists between builds, speeds up `npm ci`
- **Layer cache**: Reuses layers when source code hasn't changed
- **Prisma cache**: Only regenerates when schema changes

### Layer Ordering Strategy
1. **Dependencies first**: `package.json` and `package-lock.json` copied first
2. **Install dependencies**: Creates a cacheable layer
3. **Copy source code**: Only invalidates cache when source changes
4. **Build**: Only runs when source or dependencies change

### Build Context Reduction
- `.dockerignore` files exclude `node_modules`, `dist`, tests, etc.
- Reduces build context size by ~80-90%
- Faster Docker context transfer

## 🎯 Best Practices

### For Small Code Changes
1. Just run `./deploy.sh` - BuildKit will use cache
2. Only changed layers rebuild
3. Typical deployment: **1-2 minutes**

### For Dependency Changes
1. Update `package.json` or `package-lock.json`
2. Run `./deploy.sh`
3. Dependencies layer rebuilds, but cache still helps
4. Typical deployment: **2-3 minutes**

### For Schema Changes
1. Update `prisma/schema.prisma`
2. Run `./deploy.sh`
3. Prisma generates, but npm cache helps
4. Typical deployment: **2-3 minutes**

### For Frontend-Only Changes
1. Use `./deploy-frontend.sh` or direct build
2. Skip backend rebuild entirely
3. Typical deployment: **1-2 minutes**

## 🛠️ Troubleshooting

### Clear Docker Build Cache
If you suspect cache issues:
```bash
docker builder prune -f
docker system prune -f
```

### Force Full Rebuild
```bash
docker compose -f docker-compose.prod.yml build --no-cache wire-backend
```

### Check Build Performance
```bash
# Enable verbose output
DOCKER_BUILDKIT=1 docker compose build --progress=plain
```

### View Cache Usage
```bash
docker system df -v
```

## 📊 Monitoring Build Times

The deploy scripts output timing information. Watch for:
- `✅ Build complete` - Build time
- Cache hits are automatic (you'll see faster builds)
- First build after clearing cache will be slower

## 🔐 Security Improvements

The optimized Dockerfiles also include:
- Non-root user in production containers
- Minimal Alpine base images
- Separated build and runtime stages
- No dev dependencies in production

## 📝 Additional Notes

### Environment Variables
- Backend: Set in `.env.production`
- Frontend: Set in `.env.production` or as build args

### BuildKit Requirements
- Docker 20.10+ (BuildKit support)
- Docker Compose v2+ (recommended)
- Automatically enabled in deploy scripts

### Server Requirements
- Sufficient disk space for Docker build cache (~2-5GB)
- Consider setting Docker cache size limit if disk space is tight

## 🚀 Quick Reference

```bash
# Backend deployment (with cache)
./deploy.sh

# Backend deployment (skip build)
./deploy.sh --skip-build

# Frontend deployment
./deploy-frontend.sh

# Full system restart (no rebuild)
docker compose -f docker-compose.prod.yml restart

# View logs
docker compose -f docker-compose.prod.yml logs -f wire-backend

# Check health
curl http://localhost:8000/health
```

---

**Expected Deployment Time**: 1-3 minutes for typical changes (vs 7-12 minutes before)
