# Email Notifications Audit & Implementation Plan

## Current Status

### ✅ Working Email Notifications

1. **Password Reset Request** (`/auth/password/reset/request`)
   - ✅ Sends email with reset link
   - ✅ Location: `src/routes/auth.ts:134-194`
   - ✅ Template: `password_reset`

2. **Signup Confirmation** (`/signup`)
   - ✅ Sends magic link email after account creation
   - ✅ Location: `src/routes/public.ts:17-238`
   - ✅ Template: `signup_confirmation`

3. **User Invitation** (`/invitations` POST)
   - ✅ Sends invitation email when admin creates user
   - ✅ Location: `src/modules/invitations/invitationService.ts:157-185`
   - ✅ Template: `user_invitation`

4. **Fast Wire Approval Request** (`/api/fast-wire/request`)
   - ✅ Sends email to beneficiary for approval
   - ✅ Location: `src/routes/fastWire.ts:142-159`
   - ✅ Template: `intent_approval_request`

5. **Fast Wire Execution** (`/api/fast-wire/:token/approve`)
   - ✅ Sends email to requestor when approved
   - ✅ Location: `src/routes/fastWire.ts:313-329`
   - ✅ Template: `intent_executed`
   - ⚠️ Includes POSE tx hash but no blockchain explorer link

### ❌ Missing Email Notifications

1. **Regular Intent Approval Requests**
   - ❌ No email sent when intent is created and needs approval
   - ❌ Should notify approvers when their approval is needed
   - Location: `src/modules/intents/intentService.ts:createIntent`

2. **Approval Completed Notifications**
   - ❌ No email sent when approval is completed
   - ❌ Should include blockchain ledger link
   - Location: `src/modules/intents/intentService.ts:createDecision` (when APPROVE)

3. **Intent Execution Completed**
   - ❌ No email sent when intent is executed
   - ❌ Should include blockchain ledger link
   - Location: `src/modules/intents/intentService.ts:executeIntent`

4. **Password Reset Confirmation**
   - ❌ No confirmation email after password reset is completed
   - Location: `src/routes/auth.ts:200-293` (after password reset confirm)

## Implementation Plan

### 1. Add Approval Request Emails

When an intent is created and requires approvals, send emails to all approvers.

### 2. Add Approval Completed Emails

When an intent is fully approved:
- Send email to initiator
- Send email to all approvers
- Include blockchain ledger link (POSE explorer)

### 3. Add Execution Completed Emails

When an intent is executed:
- Send email to initiator
- Send email to all approvers
- Include blockchain ledger link (POSE explorer)

### 4. Add Password Reset Confirmation

After password reset is completed, send confirmation email.

### 5. Blockchain Explorer Link Generation

Create utility function to generate POSE explorer links from transaction hashes:
- Format: `https://explorer.testnet.pose.xyz/tx/{txHash}` or similar
- Use `POSE_EXPLORER_URL` environment variable

## Email Template Updates Needed

1. Update `intent_executed` template to include blockchain ledger link
2. Ensure all approval/execution emails include:
   - Intent details (amount, beneficiary, purpose)
   - Blockchain transaction hash
   - Link to blockchain explorer
   - Link to view intent in WIRE dashboard
