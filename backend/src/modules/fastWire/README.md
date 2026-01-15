# Fast Wire Module

## Overview

Fast Wire is a public (no login required) wire transfer feature that allows anyone to create a wire transfer with an email-based beneficiary. All actions create POSE network transactions.

## Components

### 1. Database Schema (`prisma/schema.prisma`)

The `FastWire` model stores:
- Requestor information (email, name, bank details - hashed)
- Beneficiary email (email-based, no predefined beneficiary)
- Approval token (hashed)
- POSE network transaction hashes:
  - `requestorPoseTxHash` - Initiate Intent TX
  - `approverPoseTxHash` - Receive/Approve TX
  - `finalApprovalPoseTxHash` - Final Approval TX (links both)
- Status tracking (PENDING_APPROVAL → BOTH_APPROVED → COMPLETED)

### 2. POSE Network Transactions (`modules/fastWire/poseTransactions.ts`)

Three main functions:
- `initiatePoseIntent()` - Creates TX when requestor creates Fast Wire
- `receiveApprovePoseIntent()` - Creates TX when approver approves (links to requestor TX)
- `createFinalApprovalPoseTx()` - Creates final TX showing both accounts approved (links all TXs)

All functions call POSE Core API at `https://api.testnet.pose.xyz/api/pose/intent/*`

### 3. Email Verification (`modules/fastWire/emailVerification.ts`)

- Stores verification codes in Redis (5-minute expiration)
- Generates 6-digit codes
- One-time use codes (deleted after verification)

### 4. Voice Proof

- Uses existing POSE Voice infrastructure
- Requestor must submit voice proof before creating Fast Wire
- Voice proof is submitted via `/api/fast-wire/submit-voice-proof` endpoint

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/fast-wire/request` | None | Create Fast Wire request |
| POST | `/api/fast-wire/submit-voice-proof` | None | Submit voice proof |
| GET | `/api/fast-wire/:token` | None | Get Fast Wire details |
| POST | `/api/fast-wire/:token/approve` | None | Approve Fast Wire |
| POST | `/api/fast-wire/verify-email` | None | Send verification code |

## Flow

### Requestor Flow:
1. Fill form (amount, purpose, beneficiary email, bank details)
2. Submit voice proof
3. Verify email (receive code, enter code)
4. Fast Wire created → POSE network TX (initiate intent)
5. Email sent to beneficiary

### Approver Flow:
1. Receive email with approval link
2. Click link → View Fast Wire details
3. Approve → POSE network TX (receive/approve)
4. Final approval TX created (links both TXs)
5. Confirmation emails sent to both parties

## Environment Variables

```bash
# POSE Core API (required for transactions)
POSE_CORE_API_URL=https://api.testnet.pose.xyz

# Frontend URL (for email links)
FRONTEND_URL=https://wire.pose.xyz

# Email verification (optional)
FAST_WIRE_EMAIL_VERIFICATION_ENABLED=true

# Debug (development only)
FAST_WIRE_DEBUG_CODES=true  # Returns verification codes in API response

# Redis (required for email verification)
REDIS_URL=redis://localhost:6379
```

## Database Migration

After adding the schema, run:

```bash
cd wire2/backend
npx prisma migrate dev --name add_fast_wire
npx prisma generate
```

## POSE Network Transaction Endpoints

The POSE Core API should have these endpoints (or we need to create them):

- `POST /api/pose/intent/initiate` - Initiate Intent
- `POST /api/pose/intent/receive` - Receive/Approve Intent
- `POST /api/pose/intent/final-approval` - Final Approval (links both)

These endpoints should return `{ txHash: string, poseId?: string }` format.
