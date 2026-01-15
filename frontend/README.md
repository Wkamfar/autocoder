# WIRE2 Frontend

React + TypeScript frontend for the WIRE2 wire transfer security platform.

## Quick Start

```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:5173/wire`

## API Configuration

The frontend can switch between mock data and real backend API.

### Environment Variables

Create a `.env` file:

```bash
# API Mode: 'mock' or 'real'
VITE_API_MODE=real

# Backend API base URL
VITE_API_BASE_URL=http://localhost:3000

# Demo mode user ID (for X-USER-ID header)
VITE_DEMO_USER_ID=user_1

# Auth mode: 'demo' or 'oidc'
VITE_AUTH_MODE=demo
```

### Switching Modes

**Use Real Backend:**
```bash
VITE_API_MODE=real npm run dev
```

**Use Mock Data:**
```bash
VITE_API_MODE=mock npm run dev
```

## API Client

The frontend uses a unified API client (`src/wire/api/`) that automatically switches between:
- **Mock API** (`src/wire/data/mockApi.ts`) - In-memory mock data
- **Real API** (`src/wire/api/client.ts`) - HTTP requests to backend

The mode is controlled by `VITE_API_MODE` environment variable.

## Features

- ✅ Intent management (create, view, update, execute)
- ✅ Approval workflow
- ✅ Voice challenge/proof system
- ✅ Beneficiary management
- ✅ Audit bundles and evidence
- ✅ Event chain verification
- ✅ Policy management
- ✅ Admin dashboard

## Development

- **Entry point:** `src/main-wire.tsx`
- **Routes:** Defined in `main-wire.tsx`
- **API:** `src/wire/api/`
- **Components:** `src/wire/components/`
- **Pages:** `src/wire/pages/`
- **Hooks:** `src/wire/hooks/`

## API Mode Indicator

In development mode, a small indicator appears in the bottom-right corner showing:
- Current API mode (MOCK or REAL)
- Backend URL (if using real API)

This helps verify which data source is being used.
