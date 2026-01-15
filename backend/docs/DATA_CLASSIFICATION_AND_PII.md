## Data Classification & PII (Agent 5)

**Purpose:** define what data is sensitive in Wire2 and how it must be stored, accessed, exported, and logged.

### Classification (baseline)

- **Public**: docs, marketing content
- **Internal**: operational metadata, non-sensitive configuration
- **Sensitive**: financial metadata, beneficiary details, audit/evidence payloads
- **Secrets**: API keys, webhook secrets, signing keys, bank tokens
- **Biometric/voice artifacts**: voice enrollment/proof audio/transcripts (treat as highly sensitive)

### Shipped today (evidence)

- Evidence exports support `full` vs `redacted` mode with PII redaction:
  - `wire2/backend/src/modules/evidence/bundleArchive.ts`

### Bank-grade requirements (next)

- Maintain an explicit **PII inventory** (fields + where stored).
- Enforce **retention** and deletion policy aligned to legal holds (coordinate with Agent 6).
- Ensure logs are redacted by default and audited for leakage.
- Controlled exports:
  - export permissions are explicit
  - export events are audited
  - redaction is the default for “support” workflows unless explicitly authorized

