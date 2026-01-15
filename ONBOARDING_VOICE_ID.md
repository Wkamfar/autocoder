# WIRE → POSE Identity Voice Onboarding (First-Time Proof)

This document describes the **post-email-verification onboarding step** that creates a persistent **POSE Identity** (a cross-app primitive).

## Flow (User experience)

After the user signs in via magic link:

1. They are redirected to `GET /v2/onboarding/voice`
2. They complete a minimal flow:
   - **Consent**
   - **Moment 1 (Presence)**: “Wait for the tone to end, then start speaking.”
   - **Moment 2 (Anchor)**: read a short server-issued phrase
   - **Moment 3 (Optional)**: “Say your name naturally”
3. On completion, Wire calls the backend to **seal** the identity and then routes the user to `/intents`.

## Backend primitives (What gets created)

When onboarding completes, the backend creates:

- **`pose_id`**: stable identifier for this user across POSE apps
- **`voice_identity_commitment`**: non-reversible, versioned commitment
- **`voice_profile_version`**: `v1`, `v2`, … for future model/policy upgrades

### Commitments (v1)

The backend computes:

- `embedding_commitment = SHA256(quantized_embedding_bytes)`
- `ihc_commitment = SHA256(timing_feature_bytes)`
- `voice_identity_commitment_v1 = SHA256(concat(
    pose_id,
    enrollment_id,
    model_version,
    embedding_commitment,
    ihc_commitment,
    policy_hash
  ))`

The commitment is **one-way** (cannot be reversed into audio).

## Data stored (Privacy/security)

Default storage after enrollment:

- **Commitments** (hashes)
- **Encrypted derived embedding blob** (if `POSE_VOICE_EMBEDDING_KEY` is set)
- **Audit metadata**: timestamps, policy/model versions, consent flags, device/mic metadata

By default, raw audio is **not stored long-term**. (The API only receives audio for immediate processing.)

## API surface (for other POSE apps)

### Status
- `GET /api/pose/voice/status`
  - Returns whether a voice profile exists (used to decide onboarding vs. skip).

### Enroll (first-time setup)
- `POST /api/pose/voice/enroll/start`
  - Returns `pose_id`, `enrollment_id`, and a server-issued `challenge`:
    - tone timing parameters (presence)
    - unique phrase (anchor)
    - `pose_challenge_id` (stored, phrase is not stored)

- `POST /api/pose/voice/enroll/complete` (multipart)
  - Fields: `enrollment_id`, `pose_id`, `pose_challenge_id`, metadata, consent
  - Files: `take_ihc`, `take_phrase`, optional `take_name`
  - Returns: `pose_id`, `voice_identity_commitment`, `voice_profile_version`

### Verify (future sessions)
- `POST /api/pose/voice/verify` (multipart)
  - Fields: `pose_id`, optional `tone_duration_ms`
  - Files: `audio`
  - Returns: component scores + final decision for UX.

## Where the code lives

- **Frontend**: `wire2/frontend/src/wire/pages/WireVoiceOnboardingPage.tsx`
- **Backend routes**: `wire2/backend/src/routes/poseVoice.ts`
- **Backend logic**: `wire2/backend/src/modules/poseVoice/*`
- **DB schema**: `wire2/backend/prisma/schema.prisma` + migration in `wire2/backend/prisma/migrations/`

