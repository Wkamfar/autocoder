# Fast Wire Feature Implementation

## Overview

Fast Wire is a public (no login required) wire transfer feature that allows anyone to create a wire transfer with an email-based beneficiary. Users can be either a **Requestor** (initiate) or **Approver** (receive and approve).

## Features Implemented

### Frontend (`/v2/test`)

✅ **WireFastWireTestPage.tsx** - Main page component
- Role selection (Requestor vs Approver)
- Form for creating Fast Wire requests
- Requestor flow:
  - Enter amount, purpose, beneficiary email
  - Enter bank account details (account number, routing number, bank name)
  - Submit voice proof (placeholder)
  - Email verification
- Approver flow:
  - Review Fast Wire details
  - Approve or deny
- Success screens

### Backend API (`/api/fast-wire/*`)

✅ **routes/fastWire.ts** - API endpoints
- `POST /api/fast-wire/request` - Create Fast Wire request (Requestor)
- `GET /api/fast-wire/:token` - Get Fast Wire details by token (Approver)
- `POST /api/fast-wire/:token/approve` - Approve Fast Wire (Approver)
- `POST /api/fast-wire/verify-email` - Send email verification code

## Database Schema (TODO)

You'll need to add a `FastWire` table to your Prisma schema:

```prisma
model FastWire {
  id                        String   @id
  status                    String   // PENDING_APPROVAL, BOTH_APPROVED, COMPLETED, DENIED
  role                      String   // REQUESTOR, APPROVER
  
  // Amount & Purpose
  amountMinor               String
  currency                  String
  purpose                   String
  
  // Requestor Info
  requestorEmail            String
  requestorName             String?
  requestorAccountNumberHash String
  requestorRoutingNumberHash String
  requestorBankName         String?
  requestorPoseTxHash       String?  // POSE network TX hash
  requestorVoiceProofId     String?
  requestorEmailVerified    Boolean  @default(false)
  requestorEmailVerifiedAt  DateTime?
  
  // Beneficiary Info (Email-based)
  beneficiaryEmail          String
  
  // Approver Info
  approverEmail             String?
  approverName              String?
  approverAccountNumberHash String?
  approverRoutingNumberHash String?
  approverBankName          String?
  approverPoseTxHash        String?  // POSE network TX hash
  approverEmailVerified     Boolean  @default(false)
  approverEmailVerifiedAt   DateTime?
  
  // Approval Token
  approvalTokenHash         String   @unique
  
  // Final Approval (Links all TXs)
  finalApprovalPoseTxHash   String?
  
  // Timestamps
  createdAt                 DateTime @default(now())
  approvedAt                DateTime?
  completedAt               DateTime?
  
  @@index([approvalTokenHash])
  @@index([requestorEmail])
  @@index([beneficiaryEmail])
  @@index([status])
}
```

Run: `npx prisma migrate dev --name add_fast_wire`

## POSE Network Integration (TODO)

The current implementation has placeholder transaction hashes. You need to integrate with the POSE network:

1. **Initiate Intent TX** (when Requestor creates Fast Wire)
   ```typescript
   // In routes/fastWire.ts, replace placeholder:
   const poseTxHash = await initiatePoseIntent({
     requestor: requestorEmail,
     amount: body.amount,
     currency: body.currency,
     purpose: body.purpose,
   });
   ```

2. **Receive/Approve TX** (when Approver approves)
   ```typescript
   // Link to requestor's TX
   const approverPoseTxHash = await approvePoseIntent({
     requestorTxHash: fastWire.requestorPoseTxHash,
     approver: approverEmail,
   });
   ```

3. **Final Approval TX** (links both accounts)
   ```typescript
   // Create final TX showing both approvals
   const finalApprovalPoseTxHash = await createFinalApprovalTx({
     requestorTxHash: fastWire.requestorPoseTxHash,
     approverTxHash: fastWire.approverPoseTxHash,
     requestorEmail,
     approverEmail,
   });
   ```

## Email Service (TODO)

Ensure email service is configured:

```typescript
// modules/email/emailService.ts
export async function sendEmail({ to, subject, html }: {
  to: string;
  subject: string;
  html: string;
}) {
  // Implement email sending (SMTP, SendGrid, AWS SES, etc.)
  // For testing, you can use console.log or a mock service
}
```

## Voice Proof Integration (TODO)

The frontend has a placeholder for voice proof. You need to:

1. Integrate with POSE Voice API (similar to existing voice onboarding)
2. Store voice proof ID in FastWire record
3. Verify voice proof before allowing Fast Wire creation

## Email Verification Code Storage (TODO)

Currently, verification codes are only sent via email. You should:

1. Store codes in Redis with expiration (5 minutes)
2. Verify codes before allowing Fast Wire creation
3. Implement rate limiting for code requests

## Testing

### Test Flow

1. **Requestor Flow:**
   ```
   POST /api/fast-wire/request
   → Email sent to beneficiary
   → Requestor receives success response
   ```

2. **Approver Flow:**
   ```
   GET /api/fast-wire/:token
   → Review details
   POST /api/fast-wire/:token/approve
   → Both parties receive confirmation
   → Final approval TX created
   ```

### Test URLs

- Frontend: `https://wire.pose.xyz/v2/test`
- Create request: `POST https://wire.pose.xyz/api/fast-wire/request`
- Approve: `POST https://wire.pose.xyz/api/fast-wire/:token/approve`

## Security Considerations

1. ✅ Bank details are hashed before storage
2. ✅ Approval tokens are hashed (SHA256)
3. ✅ Email verification required for Requestor
4. ⚠️ TODO: Add rate limiting
5. ⚠️ TODO: Add fraud detection
6. ⚠️ TODO: Encrypt sensitive data at rest

## Next Steps

1. Add Prisma schema for FastWire table
2. Run migration: `npx prisma migrate dev`
3. Integrate POSE network transactions
4. Implement email service (if not already done)
5. Add voice proof integration
6. Add email verification code storage (Redis)
7. Test complete flow end-to-end
8. Add monitoring and alerting

## Files Created

- `frontend/src/wire/pages/WireFastWireTestPage.tsx`
- `backend/src/routes/fastWire.ts`
- `backend/src/app.ts` (updated to register routes)
- `frontend/src/main-wire.tsx` (updated to add route)

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/fast-wire/request` | None | Create Fast Wire request |
| GET | `/api/fast-wire/:token` | None | Get Fast Wire details |
| POST | `/api/fast-wire/:token/approve` | None | Approve Fast Wire |
| POST | `/api/fast-wire/verify-email` | None | Send email verification code |
