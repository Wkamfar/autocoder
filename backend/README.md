# WIRE2 Backend Services

Enterprise-grade backend infrastructure for wire transfer security platform.

## ✅ Single-backend demo (modular monolith)

This repo now includes a **single Node.js/TypeScript backend** in `backend/src/` that serves the required `/api/wire/*` API surface and runs as **one server process** (demo auth via `X-USER-ID`).

- **Entry**: `backend/src/server.ts`
- **Routes**: `backend/src/routes/wire.ts`
- **DB**: Prisma + Postgres (`backend/prisma/`, `backend/src/db/seed.ts`)

Use `docker-compose.yml` in `wire2/` for the one-command demo startup.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY (Port 3000)                   │
│  - Request routing                                           │
│  - CORS & Authentication                                     │
│  - Rate limiting                                             │
└──────┬──────────────┬──────────────┬───────────────────────┘
       │              │              │
┌──────▼──────┐ ┌────▼──────┐ ┌────▼──────────────┐
│   WIRE API   │ │   VOICE   │ │   FRAUD DETECTION │
│   SERVICE    │ │  SERVICE  │ │     SERVICE       │
│   (8000)     │ │  (8001)   │ │      (8002)       │
└──────┬───────┘ └────┬──────┘ └────┬───────────────┘
       │              │              │
       └──────────────┼──────────────┘
                      │
       ┌──────────────▼──────────────┐
       │      DATABASE LAYER          │
       │  - PostgreSQL (Primary)      │
       │  - Redis (Cache/Sessions)    │
       └──────────────────────────────┘
```

## Services

### Wire API Service (`wire-api/`)
- **Port:** 8000
- **Technology:** Node.js + TypeScript + Express
- **Purpose:** Core business logic for wire transfers
- **Features:**
  - Authentication & Authorization
  - Intent Management
  - Beneficiary Management
  - Approval Workflow
  - Policy Engine
  - Audit Trail

### Voice Service (`voice-service/`)
- **Port:** 8001
- **Technology:** Python + FastAPI
- **Purpose:** Voice biometric verification
- **Features:**
  - Voice enrollment
  - Voice verification
  - Liveness detection
  - Clone detection
  - Coercion detection

### Fraud Service (`fraud-service/`)
- **Port:** 8002
- **Technology:** Python + FastAPI
- **Purpose:** Real-time fraud detection
- **Features:**
  - Risk scoring
  - Anomaly detection
  - Pattern analysis
  - ML-based fraud detection

### API Gateway (`api-gateway/`)
- **Port:** 3000
- **Technology:** Node.js + TypeScript + Express
- **Purpose:** Central entry point for all API requests
- **Features:**
  - Request routing
  - CORS configuration
  - Service discovery
  - Load balancing

## Quick Start

### Using Docker Compose (Recommended)

```bash
cd wire2
docker-compose up -d
```

This starts all services with proper networking and dependencies.

### Manual Setup

1. **Start PostgreSQL and Redis:**
   ```bash
   # PostgreSQL
   createdb wire2
   
   # Redis
   redis-server
   ```

2. **Set up environment variables:**
   ```bash
   cd backend/wire-api
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Install dependencies:**
   ```bash
   # Wire API
   cd backend/wire-api
   npm install
   
   # Voice Service
   cd ../voice-service
   pip install -r requirements.txt
   
   # Fraud Service
   cd ../fraud-service
   pip install -r requirements.txt
   
   # API Gateway
   cd ../api-gateway
   npm install
   ```

4. **Run migrations:**
   ```bash
   cd backend/wire-api
   npm run dev  # Migrations run automatically on startup
   ```

5. **Start services:**
   ```bash
   # Terminal 1: Wire API
   cd backend/wire-api && npm run dev
   
   # Terminal 2: Voice Service
   cd backend/voice-service && python main.py
   
   # Terminal 3: Fraud Service
   cd backend/fraud-service && python main.py
   
   # Terminal 4: API Gateway
   cd backend/api-gateway && npm run dev
   ```

## Database

### Schema
Complete PostgreSQL schema is defined in `wire-api/src/db/schema.sql`

### Tables
- `organizations` - Organizations
- `users` - User accounts
- `sessions` - Active sessions
- `beneficiaries` - Payment beneficiaries
- `beneficiary_versions` - Beneficiary version history
- `intents` - Transfer intents
- `approvals` - Approval workflow records
- `voice_challenges` - Voice verification challenges
- `voice_proofs` - Voice verification proofs
- `voiceprints` - Encrypted voiceprints
- `policies` - Risk and approval policies
- `audit_logs` - Immutable audit trail
- `fraud_alerts` - Fraud detection alerts
- `risk_scores` - Historical risk scores

### Migrations
Migrations are managed in `wire-api/src/db/migrate.ts`

Run migrations:
```bash
cd backend/wire-api
npm run dev  # Migrations run automatically
```

### Seed Data
Seed development data:
```typescript
import { seedDatabase } from './db/seeds';
await seedDatabase();
```

## Redis

Used for:
- Session storage
- Rate limiting
- Caching
- Real-time data

Configuration in `wire-api/src/db/redis.ts`

## Health Checks

All services expose health check endpoints:

- Wire API: `http://localhost:8000/health`
- Voice Service: `http://localhost:8001/health`
- Fraud Service: `http://localhost:8002/health`
- API Gateway: `http://localhost:3000/health`

## Environment Variables

See `.env.example` files in each service directory for required configuration.

Key variables:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- Service-specific variables

## Development

### Code Structure

```
backend/
├── wire-api/
│   ├── src/
│   │   ├── db/          # Database layer
│   │   ├── routes/      # API routes (to be implemented)
│   │   ├── middleware/  # Middleware (to be implemented)
│   │   └── utils/      # Utilities
│   └── package.json
├── voice-service/
│   ├── main.py
│   └── requirements.txt
├── fraud-service/
│   ├── main.py
│   └── requirements.txt
└── api-gateway/
    ├── src/
    └── package.json
```

### TypeScript Types

Database types are defined in `wire-api/src/db/types.ts`

### Logging

Structured logging via `wire-api/src/utils/logger.ts`

## Production Deployment

See `docker-compose.yml` and individual `Dockerfile` files for containerization.

Production considerations:
- Use environment-specific `.env` files
- Enable SSL/TLS
- Configure proper secrets management
- Set up monitoring and alerting
- Enable database backups
- Configure Redis persistence

## Phase 1 Status

✅ **Complete** - Infrastructure & Database foundation ready

See `docs/PHASE1_COMPLETE.md` for detailed completion report.

## Next Steps

Phase 1 is complete. Ready for:
- Phase 2: Authentication & Authorization Service
- Phase 3: Intent Management Service
- Phase 4: Beneficiary Management Service
- Phase 6: Voice Verification Service
- Phase 7: Fraud Detection Service

See `docs/AGENT_COORDINATION.md` for full implementation plan.
