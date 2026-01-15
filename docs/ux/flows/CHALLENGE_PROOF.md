# Flow: Challenge / Proof (Voice Verification)

Uses: `../ACCEPTANCE_CRITERIA_TEMPLATE.md`

## Metadata
- **Flow name**: Challenge / Proof
- **Owner**: UX/PM
- **Last updated**: 2026-01-14
- **Primary user roles**: Treasury Initiator (typically), Approver (if policy requires), Admin (support)
- **Entry points**:
  - Intent detail: `/v2/intents/:id` (challenge modal/panel)
  - Voice onboarding: `/v2/onboarding/voice`
- **Related docs**:
  - `../CRITICAL_FLOWS_AND_ROUTES.md`
  - `../CONTENT_GUIDELINES.md`

## Preconditions
- User authenticated? **Y** (except onboarding flow, which may be pre-auth depending on product decision)
- Required permissions/roles: typically `intent:create` or `intent:execute` depending on when step-up occurs
- Required org/tenant state: intent exists; policy requires verification for this action/amount/risk
- Required integrations: microphone permissions OR phone fallback (policy-dependent)

## UX contract (non-breaking)
- Existing routes preserved? **Y**
- Existing terminology preserved? **Y** (“verification”, “challenge”, “proof”)
- Any new UI behind feature flag? **NA**

## Happy path (browser microphone)
1. User opens intent detail and sees “Verification required”.
2. User clicks “Start verification”.
3. App requests microphone permission; user allows.
4. App records sample; user reads the challenge phrase.
5. App uploads proof and shows “Verifying…”.
6. App shows “Verified” and returns the user to the intent with updated state (e.g. `PENDING_APPROVALS` or ready to execute).

## Happy path (phone fallback)
1. User cannot use microphone (denied/unavailable).
2. App offers phone fallback (if policy allows) with clear instructions.
3. User completes phone flow; status updates to verified.

## Success criteria (must be true)
- **Correctness**
  - Challenge phrase shown matches backend challenge and expires correctly.
  - Proof submission is idempotent (retry safe).
  - Post-verification intent state matches backend canonical status.
- **UX clarity**
  - Microphone permission request is explained *before* the browser prompt.
  - If mic denied, user sees a clear fallback path (phone) or a clear stop with next step.
- **Performance**
  - Recording UI has clear states: idle → requesting mic → recording → verifying → verified/error.
- **Accessibility**
  - Modal focus trap works; keyboard accessible controls; visible focus.
- **Security + trust**
  - No raw audio identifiers in UI; only safe references.
  - Copy avoids “fraud” language; emphasizes “verification”.

## Failure modes (expected + handling)
- **Mic permission denied**
  - UI: show phone fallback (if allowed) OR steps to enable mic.
- **Challenge expired**
  - UI: “This verification expired. Generate a new one.” + CTA to retry.
- **Verification failed**
  - UI: show calm error + retry policy (cooldown, attempt limits) + when to contact admin.
- **Backend degraded / timeout**
  - UI: preserve state; allow retry; show request ID.

## State machine + UX mapping
- Intent: `PENDING_PROOF` / `CHALLENGING` → verified → next state (`PENDING_APPROVALS` or execution-ready)
- UI must show:
  - current verification state
  - cooldown/lockout messaging (policy-driven)
  - “what happens next” after verification

## Telemetry + audit expectations
- **Client events**: `challenge_start`, `challenge_mic_prompt`, `challenge_record_start`, `challenge_submit`, `challenge_success`, `challenge_error`
- **Audit log**: challenge issued + proof submitted + verification result (without sensitive payloads)

## Copy review checklist
- Calm/neutral language per `../CONTENT_GUIDELINES.md`
- Clear next steps on failure
- No sensitive data displayed

## Test checklist (manual + automated)
- [ ] Mic allowed happy path
- [ ] Mic denied fallback path
- [ ] Expired challenge handling
- [ ] Failed verification retry behavior
- [ ] Keyboard-only modal flow
- [ ] Screen reader pass

