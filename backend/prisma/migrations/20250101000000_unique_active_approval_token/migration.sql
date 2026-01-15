-- Agent C: Add unique constraint on active approval tokens per intent+bindingHash
-- This prevents multiple active tokens from being minted for the same intent+bindingHash combination

-- Create partial unique index (PostgreSQL feature)
-- Only applies to rows where invalidatedAt IS NULL AND consumedAt IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalToken_unique_active_per_intent_binding" 
ON "ApprovalToken" ("intentId", "bindingHash") 
WHERE "invalidatedAt" IS NULL AND "consumedAt" IS NULL;
