-- Agent 11: persist POSE on-chain anchor linkage on intent events
-- Adds optional tx hash + timestamp + last error (if anchoring fails)

ALTER TABLE "IntentEvent"
  ADD COLUMN IF NOT EXISTS "poseAnchorTxHash" TEXT,
  ADD COLUMN IF NOT EXISTS "poseAnchoredAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "poseAnchorLastError" TEXT;

-- Helpful for debugging / lookups by tx hash
CREATE INDEX IF NOT EXISTS "IntentEvent_poseAnchorTxHash_idx" ON "IntentEvent" ("poseAnchorTxHash");

