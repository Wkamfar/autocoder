# Plaid × POSE: Deep B2B Partnership for “POSE Wire Verification”

## What “POSE Wire Verification” means

**POSE Wire Verification** is a **verifiable, auditable attestation** that a wire/payment instruction is:

- bound to a real human decision (Pose identity / step-up)
- bound to immutable intent details (binding hash + maker-checker)
- bound to a verified bank account and counterparty identity signals (Plaid-backed)
- tracked end-to-end with deterministic execution + reconciliation (events + ledger spine)

The output is a portable **verification artifact** (receipt + evidence bundle + signature) that a third party (bank, sponsor, marketplace, payroll platform, AP automation tool) can rely on to reduce fraud and operational risk.

## Why Plaid is the right long-term partner

Plaid is uniquely positioned as:
- a distribution layer (Link) for B2B onboarding and consent
- an identity + bank-account intelligence layer (Auth/Identity/Signal/Monitor)
- a payments execution layer (Transfer; and future rails as Plaid expands)

POSE is positioned as:
- a control plane for high-risk actions (voice identity + step-up + maker/checker)
- a ledger-first execution + reconciliation spine
- a “proof & audit” product (tamper-evident event chains + exportable evidence bundles)

**Together:** Plaid provides the bank connectivity + real-world bank signals; POSE provides verifiable authorization + auditability for money movement.

## The partnership wedge (how we start)

### Phase 1: “Verification-as-a-Service” for ACH / payout flows (P0)

Use Plaid Link + Auth/Identity + Transfer to produce a **POSE Verification Receipt**:
- account verified (routing/account validity)
- ownership/identity signals where available
- execution intent verified (binding hash)
- authorization verified (Pose proofs + approvals)
- deterministic execution & reconciliation (Transfer events)

Deliver it via:
- API response (JWS / signed JSON)
- webhook to the integrator (bank-grade delivery + retries)
- downloadable evidence bundle (human-readable + machine-verifiable)

### Phase 2: Extend to wires (P1/P2)

Wires are sponsor-bank constrained, but verification can still be standardized:
- beneficiary identity and account/routing verification via Plaid data + KYB/KYC partners
- intent change-control + maker-checker + step-up proof
- “ready-to-send” instruction verification artifact
- post-send reconciliation via sponsor bank reporting / SWIFT MT/MX artifacts

POSE can become the **pre-wire authorization & verification layer** even when the execution rail is not Plaid.

## The technical contract that makes this bank-grade

### Core identifiers

- **`bindingHash`**: canonical fingerprint of the instruction (amount, beneficiary, rail, memo, effective date, etc.)
- **`executionRef`**: internal execution attempt id
- **Plaid `transfer_id`**: provider object id for money movement

### Non-negotiable correlation invariant (Plaid Transfer)

For Plaid Transfer executions:
- `ExecutionLedger.provider = "plaid"`
- `ExecutionLedger.externalRef = transfer_id`

This is what allows `/transfer/event/sync` backfill to deterministically map events → execution → intent.

See: `wire2/backend/docs/PLAID_TRANSFER_EXECUTION_CORRELATION.md`.

### Webhook semantics (Plaid + POSE)

Plaid webhook verification:
- header: `Plaid-Verification` (JWT)
- verified via `webhook_verification_key/get` (JWK)
- validate `iat` window + `request_body_sha256` over raw body

POSE webhook delivery to integrators:
- signed payloads (POSE signature header)
- retries with exponential backoff
- idempotency via event id + delivery id

### “POSE Wire Verification” artifact format (proposal)

**`pose_verification` (signed JWS payload)**:
- `schema_version`
- `tenant`: `orgId`
- `subject`: `intentId`, `executionRef`
- `binding_hash`
- `rail`: `ACH|WIRE|RTP|FEDNOW`
- `amount`: `{ currency, minor }`
- `beneficiary`: redacted canonical representation + hash
- `bank_signals` (from Plaid):
  - institution id/name (when available)
  - account mask/type
  - Auth/Identity summaries
  - risk signals where contracted (Signal/Protect/Monitor)
- `authorization_proof` (from POSE):
  - approvals (maker/checker)
  - step-up proofs (voice)
  - event chain head hash
- `execution_correlation`:
  - `provider`: `"plaid"`
  - `transfer_id`
  - last known provider status + timestamp
- `evidence_bundle_uri` (optional): short-lived download link or immutable blob reference

Verifier UX:
- banks/partners can validate the JWS signature against POSE public keys
- optionally fetch evidence bundle for human review

## “Deep partnership” playbook (how we get Plaid-level tight)

### 1) Product alignment

- **Co-designed verification schema**: a stable spec for “Verified instruction” (POSE) with Plaid-backed bank signals.
- **Mutual roadmap**: POSE becomes a reference implementation for “authorized money movement” with Plaid Transfer + backfills.
- **Shared sandbox harness**: failure-mode simulation suite (replays, out-of-order events, partial outages) jointly validated.

### 2) Commercial structure

- **Partner program**: list POSE as a Plaid partner for “fraud-resistant authorization + verification”
- **Co-selling**: banks / fintechs buying Transfer + requiring stronger authorization controls
- **Revenue share**: per verified instruction or per “verification token” issued
- **SLAs**:
  - verification issuance latency
  - webhook delivery guarantees
  - audit bundle retention and retrieval

### 3) Security + compliance posture (table stakes)

- SOC 2 Type II (and roadmap to ISO 27001 if needed)
- key management (KMS/HSM for signing keys)
- strict data minimization + consent
- audit logging + legal hold + retention policies
- penetration testing + vulnerability management

### 4) Engineering integrations that Plaid will respect

- strict webhook verification (JWT/JWK, body hash, tolerance)
- deterministic idempotent processing (event dedupe, exact-once claims, replay-safe jobs)
- reconciliation-first design (sync/backfill as first-class, not “best effort”)
- portability: clean provider abstraction so the same verification artifact works across rails/providers

## How any Plaid-integrator “issues a POSE wire verification”

### Option A: POSE as the verification authority (recommended)

Integrator flow:
1. Create an intent in POSE (includes beneficiary + amount + rail)
2. Obtain required maker/checker approvals + step-up proofs
3. Execute via provider (Plaid Transfer for P0) or via sponsor bank (wire)
4. Receive:
   - signed `pose_verification` artifact
   - webhook updates (status transitions)
   - evidence bundle link for audit

### Option B: Embedded verification (partner SDK)

POSE provides an SDK that:
- wraps Plaid Link/Auth/Identity
- collects POSE authorization proofs
- submits to POSE for signing/issuance

This enables “verification issuance” without the integrator building security/audit infrastructure themselves.

## Next concrete steps (when you want to go deeper)

- Implement **Plaid Transfer create/submit** connector:
  - store `transfer_id` into `ExecutionLedger.externalRef` immediately
  - store provider idempotency key + request_id in metadata
- Add **Transfer event sync** operational metrics:
  - lag (`now - lastEventTimestamp`)
  - cursor drift and backfill performance
- Define and publish a **POSE verification schema** (JWS) + public key rotation policy
- Produce a joint “bank review packet”:
  - threat model
  - control mapping
  - reconciliation runbooks
  - incident response & escalation paths

