# WIRE2 Setup Instructions

## Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- PostgreSQL 14+
- Redis 6+

## Initial Setup

### 1. Frontend Setup

```bash
cd wire2/frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:3001`

### 2. Backend Setup

#### Wire API Service (Node.js/TypeScript)

```bash
cd wire2/backend/wire-api
npm install
cp .env.example .env  # Create .env file with your configuration
npm run dev
```

Service will run on `http://localhost:8000`

#### Voice Service (Python/FastAPI)

```bash
cd wire2/backend/voice-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Create .env file with your configuration
python main.py
```

Service will run on `http://localhost:8001`

#### Fraud Service (Python/FastAPI)

```bash
cd wire2/backend/fraud-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Create .env file with your configuration
python main.py
```

Service will run on `http://localhost:8002`

### 3. Database Setup

```bash
# Create PostgreSQL database
createdb wire2

# Run migrations (once Infrastructure Agent completes Phase 1)
cd wire2/backend/wire-api
npm run migrate
```

### 4. Redis Setup

```bash
# Start Redis (if not running as service)
redis-server
```

## Development Workflow

1. Start all services in separate terminals
2. Frontend connects to backend via proxy (configured in `vite.config.ts`)
3. Backend services communicate via HTTP/REST

## Environment Variables

Each service needs a `.env` file. See `.env.example` files (to be created by Infrastructure Agent in Phase 1).

## Next Steps

See `docs/AGENT_COORDINATION.md` for the multi-agent implementation plan.
