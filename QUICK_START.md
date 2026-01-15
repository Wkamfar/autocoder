# WIRE2 Quick Start Guide

**Status**: ✅ Launch-Ready

## Prerequisites

- Docker 20.10+
- Docker Compose 1.29+
- Node.js 18+ (for local development)
- 8GB+ RAM recommended

## Quick Start (5 Minutes)

### 1. Clone and Navigate
```bash
cd wire2
```

### 2. Set Environment Variables
```bash
cd backend
cp .env.example .env
# Edit .env with your configuration (see ENV_VARIABLES.md)
```

**Minimum required variables:**
```bash
DATABASE_URL=postgresql://wire2_user:wire2_password@postgres:5432/wire2?schema=public
REDIS_URL=redis://redis:6379
POSE_V2_SERVICE_URL=http://host.docker.internal:8000
POSE_V2_ENABLED=true
AUTH_MODE=demo
```

### 3. Start Services
```bash
cd ..
docker-compose up -d
```

### 4. Verify Health
```bash
# Liveness check
curl http://localhost:8000/health

# Readiness check (checks dependencies)
curl http://localhost:8000/health/ready

# Metrics endpoint
curl http://localhost:8000/metrics
```

### 5. Test API
```bash
# List intents (requires auth)
curl -H "X-USER-ID: user_1" http://localhost:8000/api/wire/intents

# Health check (no auth required)
curl http://localhost:8000/api/wire/health
```

## What's Included

### ✅ Core Features
- **Real Voice Verification**: Integrated with POSE V2 zero-shot voice identification
- **Fraud Detection**: Rule-based fraud detection (8 rules)
- **Idempotency**: Prevents duplicate executions
- **Health Checks**: Database, Redis, POSE V2 service checks
- **Monitoring**: Prometheus metrics endpoint
- **Audit Trail**: Complete event chain logging

### ✅ Infrastructure
- PostgreSQL database with migrations
- Redis cache
- Health checks for all services
- Docker Compose setup

## Architecture

```
┌─────────────────────────────────────────┐
│         WIRE2 Backend (Port 8000)       │
│  - REST API (/api/wire/*)               │
│  - Health Checks (/health, /ready)      │
│  - Metrics (/metrics)                   │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐ ┌──────┐ ┌──────────┐
│Postgres│ │Redis │ │POSE V2   │
│ :5432  │ │:6379 │ │Voice Svc │
└────────┘ └──────┘ └──────────┘
```

## Key Endpoints

### Health & Monitoring
- `GET /health` - Liveness check
- `GET /health/ready` - Readiness check (dependencies)
- `GET /metrics` - Prometheus metrics

### Wire Transfer API
- `GET /api/wire/intents` - List intents
- `POST /api/wire/intents` - Create intent
- `POST /api/wire/intents/:id/challenge` - Create voice challenge
- `POST /api/wire/challenges/:id/proof` - Submit voice proof
- `POST /api/wire/intents/:id/decision` - Make approval decision
- `POST /api/wire/intents/:id/execute` - Execute transfer (idempotent)

## Voice Verification Flow

1. **Create Intent** → `POST /api/wire/intents`
2. **Create Challenge** → `POST /api/wire/intents/:id/challenge`
3. **Submit Proof** → `POST /api/wire/challenges/:id/proof` (with audio)
   - Uses POSE V2 for real voice verification
   - Falls back to transcript-based if audio not provided
4. **Make Decision** → `POST /api/wire/intents/:id/decision`
5. **Execute** → `POST /api/wire/intents/:id/execute` (with idempotency key)

## Fraud Detection

Automatically checks:
- Amount thresholds ($10M limit)
- New beneficiaries (<7 days)
- Unusual times (outside business hours)
- Rapid-fire transfers (>5/hour)
- High-risk countries
- Weekend transfers
- First-time large transfers

## Troubleshooting

### Services Not Starting
```bash
# Check logs
docker-compose logs -f

# Check service status
docker-compose ps

# Restart services
docker-compose restart
```

### Database Connection Issues
```bash
# Test database connection
docker-compose exec postgres psql -U wire2_user -d wire2 -c "SELECT 1;"
```

### Redis Connection Issues
```bash
# Test Redis connection
docker-compose exec redis redis-cli ping
```

### POSE V2 Service Not Available
- Set `POSE_V2_ENABLED=false` to use mock mode
- Ensure POSE V2 service is running at `POSE_V2_SERVICE_URL`

## Next Steps

1. **Configure Production Environment**:
   - Set `AUTH_MODE=oidc` and configure OIDC
   - Set `NODE_ENV=production`
   - Configure signing keys for audit bundles

2. **Integrate Frontend**:
   - Update frontend to call real API endpoints
   - Send audio buffers for voice verification

3. **Monitor**:
   - Set up Prometheus/Grafana dashboards
   - Configure alerting rules
   - Monitor fraud detection rates

## Documentation

- `ENV_VARIABLES.md` - Environment variables reference
- `LAUNCH_SUMMARY.md` - Implementation summary
- `backend/src/openapi/wire.openapi.json` - API specification

---

**Ready to Launch!** 🚀
