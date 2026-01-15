# Local Testing Guide

Quick guide to test WIRE2 backend locally.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (for Postgres)
- npm or yarn

## Quick Start (5 minutes)

### 1. Start Database

```bash
cd wire2
docker-compose up -d postgres
```

This starts Postgres on `localhost:5432` with:
- Database: `wire2`
- User: `wire2_user`
- Password: `wire2_password`

### 2. Install Dependencies

```bash
cd wire2/backend
npm install
```

### 3. Generate Signing Keys

```bash
# Build first
npm run build

# Generate keys
node -e "
const {generateEd25519KeyPair} = require('./dist/lib/signing.js');
const kp = generateEd25519KeyPair();
console.log('SIGNING_PRIVATE_KEY=' + kp.privateKeyBase64url);
console.log('SIGNING_PUBLIC_KEY=' + kp.publicKeyBase64url);
"
```

Copy the output keys.

### 4. Create `.env` File

Create `wire2/backend/.env`:

```bash
# Database
DATABASE_URL=postgresql://wire2_user:wire2_password@localhost:5432/wire2

# Signing Keys (paste from step 3)
SIGNING_PRIVATE_KEY=your_64_byte_base64url_key_here
SIGNING_PUBLIC_KEY=your_32_byte_base64url_key_here
SIGNING_KEY_ID=dev_key_1

# Storage (local filesystem)
STORAGE_TYPE=local

# Server
PORT=3000
NODE_ENV=development

# Auth (demo mode)
AUTH_MODE=demo
```

### 5. Setup Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run db:migrate:dev

# Seed database (creates test users, orgs, beneficiaries)
npm run db:seed
```

### 6. Start Server

```bash
npm run dev
```

Server starts on `http://localhost:3000`

---

## Test Endpoints

### Health Check

```bash
curl http://localhost:3000/health
```

Expected: `{"voiceService":"operational",...}`

### Create Intent (Demo Mode)

```bash
curl -X POST http://localhost:3000/api/wire/intents \
  -H "Content-Type: application/json" \
  -H "X-USER-ID: user_1" \
  -d '{
    "railsType": "WIRE",
    "amountMinor": "100000",
    "currency": "USD",
    "beneficiaryId": "beneficiary_1",
    "purpose": "Test payment"
  }'
```

**Note:** In demo mode, use `X-USER-ID` header. Check seed data for valid user IDs.

### List Intents

```bash
curl http://localhost:3000/api/wire/intents \
  -H "X-USER-ID: user_1"
```

### Create Approval Decision

```bash
# First, get an intent ID from list above
INTENT_ID="intent_1234567890"

curl -X POST http://localhost:3000/api/wire/intents/$INTENT_ID/decision \
  -H "Content-Type: application/json" \
  -H "X-USER-ID: user_2" \
  -d '{
    "decisionType": "APPROVE"
  }'
```

**Note:** Use a different user ID than the intent creator (maker-checker rule).

### Execute Intent

```bash
# After approvals are complete, execute
curl -X POST http://localhost:3000/api/wire/intents/$INTENT_ID/execute \
  -H "Content-Type: application/json" \
  -H "X-USER-ID: user_1" \
  -d '{
    "approvalToken": "your_approval_token_here"
  }'
```

**Note:** Approval token is returned when decision threshold is met.

### Generate Audit Bundle

```bash
curl -X POST "http://localhost:3000/api/wire/intents/$INTENT_ID/bundle?mode=full" \
  -H "X-USER-ID: user_1"
```

### Verify Bundle Signature

```bash
BUNDLE_ID="bundle_intent_1234567890_1234567890"

curl http://localhost:3000/api/wire/bundles/$BUNDLE_ID/verify
```

Expected: `{"valid":true,"signerKeyId":"dev_key_1"}`

### Verify Event Chain

```bash
curl http://localhost:3000/api/wire/intents/$INTENT_ID/events/verify
```

Expected: `{"valid":true,"errors":[],"chainHash":"...","eventCount":N}`

---

## Run Tests

```bash
# Unit tests
npm test

# Watch mode
npm test -- --watch

# Specific test file
npm test -- src/lib/__tests__/canonicalJson.test.ts
```

---

## Common Issues

### "SIGNING_PRIVATE_KEY not set"

**Fix:** Add signing keys to `.env` file (see step 4).

### "Database connection failed"

**Fix:** 
1. Check Postgres is running: `docker-compose ps`
2. Verify DATABASE_URL in `.env` matches docker-compose credentials
3. Try: `docker-compose restart postgres`

### "Prisma client not generated"

**Fix:** Run `npm run prisma:generate`

### "Migration failed"

**Fix:** 
1. Check database exists: `docker-compose exec postgres psql -U postgres -c "\l"`
2. Reset if needed: `npm run db:migrate:reset` (⚠️ deletes all data)

### "Port 3000 already in use"

**Fix:** Change PORT in `.env` or kill process:
```bash
lsof -ti:3000 | xargs kill
```

---

## Seed Data

The seed script creates:
- **Organizations:** `org_1`, `org_2`
- **Users:** `user_1`, `user_2`, `user_3` (all in `org_1`)
- **Beneficiaries:** `beneficiary_1`, `beneficiary_2`
- **Policies:** Default policy for `org_1`

Check `wire2/backend/src/db/seed.ts` for details.

---

## Full Test Flow

```bash
# 1. Health check
curl http://localhost:3000/health

# 2. Create intent
INTENT=$(curl -s -X POST http://localhost:3000/api/wire/intents \
  -H "Content-Type: application/json" \
  -H "X-USER-ID: user_1" \
  -d '{
    "railsType": "WIRE",
    "amountMinor": "100000",
    "currency": "USD",
    "beneficiaryId": "beneficiary_1",
    "purpose": "Test payment"
  }' | jq -r '.id')

echo "Created intent: $INTENT"

# 3. Approve (user_2)
curl -X POST http://localhost:3000/api/wire/intents/$INTENT/decision \
  -H "Content-Type: application/json" \
  -H "X-USER-ID: user_2" \
  -d '{"decisionType": "APPROVE"}'

# 4. Approve (user_3) - if required
curl -X POST http://localhost:3000/api/wire/intents/$INTENT/decision \
  -H "Content-Type: application/json" \
  -H "X-USER-ID: user_3" \
  -d '{"decisionType": "APPROVE"}'

# 5. Get approval token (from decision response)
# Then execute...

# 6. Generate bundle
BUNDLE=$(curl -s -X POST "http://localhost:3000/api/wire/intents/$INTENT/bundle" \
  -H "X-USER-ID: user_1" | jq -r '.id')

echo "Created bundle: $BUNDLE"

# 7. Verify bundle
curl http://localhost:3000/api/wire/bundles/$BUNDLE/verify

# 8. Verify event chain
curl http://localhost:3000/api/wire/intents/$INTENT/events/verify
```

---

## Using Postman/Insomnia

1. Import OpenAPI spec: `wire2/backend/src/openapi/wire.openapi.json`
2. Set base URL: `http://localhost:3000`
3. Add header: `X-USER-ID: user_1` (for demo mode)
4. Test endpoints!

---

## Debugging

### View Logs

Server logs are printed to console. For more detail:

```bash
LOG_LEVEL=debug npm run dev
```

### Database Queries

```bash
# Connect to Postgres
docker-compose exec postgres psql -U wire2_user -d wire2

# View intents
SELECT id, status, "bindingHash" FROM "Intent";

# View events
SELECT "seq", "eventType", "eventHash" FROM "IntentEvent" ORDER BY seq;

# View bundles
SELECT id, "bundleHash", "signerKeyId" FROM "AuditBundle";
```

### Check Storage

If using local storage, bundles are stored in:
```
wire2/backend/storage/bundles/
```

---

## Next Steps

- ✅ Test all endpoints
- ✅ Verify bundle signatures
- ✅ Test event chain verification
- ✅ Test idempotency (send same request twice)
- ✅ Test state machine (try invalid transitions)
- ✅ Run full test suite: `npm test`

---

## Need Help?

- Check `ENV_SETUP.md` for environment variables
- Check `SHIP_TODAY_CHECKLIST.md` for verification steps
- Check `SHIP_READINESS_ASSESSMENT.md` for detailed status
