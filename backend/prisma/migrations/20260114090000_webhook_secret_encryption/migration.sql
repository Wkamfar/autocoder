-- Add encrypted webhook secret storage (AES-256-GCM envelope in base64url).
-- Backwards-compatible: existing rows keep secretEncrypted = NULL and continue to use legacy signing.

ALTER TABLE "Webhook"
ADD COLUMN IF NOT EXISTS "secretEncrypted" TEXT;

