# UX Content Guidelines (WIRE2)

## Principles
- **Calm, neutral, specific**: no alarmist language in-flow; tell the user what happened and what to do next.
- **Actionable errors**: every error must include a next step (retry, change input, contact admin, try later).
- **Consistency**: use the same terms for the same concepts across UI/API (intent, approval, challenge, execution).

## Canonical terminology (preferred)
- **Intent**: a payment/transfer “thing in motion” (avoid “transaction” unless it’s actually final/settled)
- **Approval**: a human decision that changes an intent’s allowed transitions
- **Challenge / Verification**: step-up verification (avoid “fraud check” in user-facing copy)
- **Execution**: the act of sending / initiating the transfer
- **Evidence**: exportable bundle for audit/compliance review

## Style rules
- **Prefer verbs + outcomes**: “Send for approval” vs “Submit”.
- **Avoid blame**: “We couldn’t verify that voice sample” not “You failed verification”.
- **No sensitive details**: never include secrets/tokens in toasts; avoid full account numbers.
- **Show request IDs** on hard failures so support can trace quickly.

## Recommended microcopy patterns
- **Permission denied (403)**
  - Title: “You don’t have access”
  - Body: “Ask an org admin to grant you permission for this action.”
- **Temporary outage**
  - Title: “Service is temporarily unavailable”
  - Body: “Try again in a few minutes. Your work is saved.”
- **Validation error**
  - Inline: “Enter a valid routing number (9 digits).”

## Step-up / fraud / challenge language
- Use **“verification”** not “fraud check”.
- Emphasize **safety + clarity**: “This helps protect your account and your funds.”
- Offer a **fallback** when possible (retry, phone flow, contact support/admin).

