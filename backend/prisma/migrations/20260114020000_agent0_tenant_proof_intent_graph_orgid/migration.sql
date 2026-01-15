-- 2026-01-14: Agent 0 sign-off hardening — add orgId to intent-adjacent tables and enforce composite FKs.
-- This turns "service guardrails" into "DB-enforced tenant boundaries" across the whole intent graph.

-- 1) Add orgId columns (nullable for backfill)
ALTER TABLE "VoiceChallenge" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "VoiceProof" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "Decision" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "ApprovalToken" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "IntentEvent" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "AuditBundle" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "Approval" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "ExecutionLedger" ADD COLUMN IF NOT EXISTS "orgId" TEXT;

-- 2) Backfill orgId from owning Intent
UPDATE "VoiceChallenge" vc
SET "orgId" = i."orgId"
FROM "Intent" i
WHERE vc."intentId" = i."id" AND vc."orgId" IS NULL;

UPDATE "VoiceProof" vp
SET "orgId" = i."orgId"
FROM "Intent" i
WHERE vp."intentId" = i."id" AND vp."orgId" IS NULL;

UPDATE "Decision" d
SET "orgId" = i."orgId"
FROM "Intent" i
WHERE d."intentId" = i."id" AND d."orgId" IS NULL;

UPDATE "ApprovalToken" t
SET "orgId" = i."orgId"
FROM "Intent" i
WHERE t."intentId" = i."id" AND t."orgId" IS NULL;

UPDATE "IntentEvent" e
SET "orgId" = i."orgId"
FROM "Intent" i
WHERE e."intentId" = i."id" AND e."orgId" IS NULL;

UPDATE "AuditBundle" b
SET "orgId" = i."orgId"
FROM "Intent" i
WHERE b."intentId" = i."id" AND b."orgId" IS NULL;

UPDATE "Approval" a
SET "orgId" = i."orgId"
FROM "Intent" i
WHERE a."intentId" = i."id" AND a."orgId" IS NULL;

UPDATE "ExecutionLedger" l
SET "orgId" = i."orgId"
FROM "Intent" i
WHERE l."intentId" = i."id" AND l."orgId" IS NULL;

-- 3) Enforce NOT NULL now that data is backfilled
ALTER TABLE "VoiceChallenge" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "VoiceProof" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Decision" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "ApprovalToken" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "IntentEvent" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "AuditBundle" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Approval" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "ExecutionLedger" ALTER COLUMN "orgId" SET NOT NULL;

-- Agent 0: allow system-generated events to exist without a user row.
-- We keep the FK (below) but make createdByUserId nullable so NULL skips the check.
ALTER TABLE "IntentEvent" ALTER COLUMN "createdByUserId" DROP NOT NULL;
UPDATE "IntentEvent" SET "createdByUserId" = NULL WHERE "createdByUserId" = 'system';

-- 4) Add composite unique helpers for composite FKs
CREATE UNIQUE INDEX IF NOT EXISTS "VoiceChallenge_id_orgId_key" ON "VoiceChallenge"("id","orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "VoiceProof_id_orgId_key" ON "VoiceProof"("id","orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "Decision_id_orgId_key" ON "Decision"("id","orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalToken_id_orgId_key" ON "ApprovalToken"("id","orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "IntentEvent_id_orgId_key" ON "IntentEvent"("id","orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "AuditBundle_id_orgId_key" ON "AuditBundle"("id","orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "Approval_id_orgId_key" ON "Approval"("id","orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "ExecutionLedger_id_orgId_key" ON "ExecutionLedger"("id","orgId");

-- 5) Drop old single-column FKs and replace with composite (intentId, orgId) links
ALTER TABLE "VoiceChallenge" DROP CONSTRAINT IF EXISTS "VoiceChallenge_intentId_fkey";
ALTER TABLE "VoiceProof" DROP CONSTRAINT IF EXISTS "VoiceProof_intentId_fkey";
ALTER TABLE "Decision" DROP CONSTRAINT IF EXISTS "Decision_intentId_fkey";
ALTER TABLE "ApprovalToken" DROP CONSTRAINT IF EXISTS "ApprovalToken_intentId_fkey";
ALTER TABLE "IntentEvent" DROP CONSTRAINT IF EXISTS "IntentEvent_intentId_fkey";
ALTER TABLE "AuditBundle" DROP CONSTRAINT IF EXISTS "AuditBundle_intentId_fkey";
ALTER TABLE "Approval" DROP CONSTRAINT IF EXISTS "Approval_intentId_fkey";
ALTER TABLE "ExecutionLedger" DROP CONSTRAINT IF EXISTS "ExecutionLedger_intentId_fkey";

ALTER TABLE "VoiceChallenge"
  ADD CONSTRAINT "VoiceChallenge_intentId_orgId_fkey"
  FOREIGN KEY ("intentId","orgId") REFERENCES "Intent"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VoiceProof"
  ADD CONSTRAINT "VoiceProof_intentId_orgId_fkey"
  FOREIGN KEY ("intentId","orgId") REFERENCES "Intent"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Decision"
  ADD CONSTRAINT "Decision_intentId_orgId_fkey"
  FOREIGN KEY ("intentId","orgId") REFERENCES "Intent"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApprovalToken"
  ADD CONSTRAINT "ApprovalToken_intentId_orgId_fkey"
  FOREIGN KEY ("intentId","orgId") REFERENCES "Intent"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IntentEvent"
  ADD CONSTRAINT "IntentEvent_intentId_orgId_fkey"
  FOREIGN KEY ("intentId","orgId") REFERENCES "Intent"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditBundle"
  ADD CONSTRAINT "AuditBundle_intentId_orgId_fkey"
  FOREIGN KEY ("intentId","orgId") REFERENCES "Intent"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Approval"
  ADD CONSTRAINT "Approval_intentId_orgId_fkey"
  FOREIGN KEY ("intentId","orgId") REFERENCES "Intent"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExecutionLedger"
  ADD CONSTRAINT "ExecutionLedger_intentId_orgId_fkey"
  FOREIGN KEY ("intentId","orgId") REFERENCES "Intent"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6) Enforce same-org user associations
ALTER TABLE "VoiceProof" DROP CONSTRAINT IF EXISTS "VoiceProof_userId_fkey";
ALTER TABLE "VoiceProof"
  ADD CONSTRAINT "VoiceProof_userId_orgId_fkey"
  FOREIGN KEY ("userId","orgId") REFERENCES "User"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Decision" DROP CONSTRAINT IF EXISTS "Decision_createdByUserId_fkey";
ALTER TABLE "Decision"
  ADD CONSTRAINT "Decision_createdByUserId_orgId_fkey"
  FOREIGN KEY ("createdByUserId","orgId") REFERENCES "User"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IntentEvent" DROP CONSTRAINT IF EXISTS "IntentEvent_createdByUserId_fkey";
ALTER TABLE "IntentEvent"
  ADD CONSTRAINT "IntentEvent_createdByUserId_orgId_fkey"
  FOREIGN KEY ("createdByUserId","orgId") REFERENCES "User"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Approval" DROP CONSTRAINT IF EXISTS "Approval_approverUserId_fkey";
ALTER TABLE "Approval"
  ADD CONSTRAINT "Approval_approverUserId_orgId_fkey"
  FOREIGN KEY ("approverUserId","orgId") REFERENCES "User"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExecutionLedger" DROP CONSTRAINT IF EXISTS "ExecutionLedger_executedByUserId_fkey";
ALTER TABLE "ExecutionLedger"
  ADD CONSTRAINT "ExecutionLedger_executedByUserId_orgId_fkey"
  FOREIGN KEY ("executedByUserId","orgId") REFERENCES "User"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7) Challenge linkage must also be same-org
ALTER TABLE "VoiceProof" DROP CONSTRAINT IF EXISTS "VoiceProof_challengeId_fkey";
ALTER TABLE "VoiceProof"
  ADD CONSTRAINT "VoiceProof_challengeId_orgId_fkey"
  FOREIGN KEY ("challengeId","orgId") REFERENCES "VoiceChallenge"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8) Decision ↔ Approval linkage (best-effort; decisionId can be NULL)
ALTER TABLE "Approval" DROP CONSTRAINT IF EXISTS "Approval_decisionId_fkey";
ALTER TABLE "Approval"
  ADD CONSTRAINT "Approval_decisionId_orgId_fkey"
  FOREIGN KEY ("decisionId","orgId") REFERENCES "Decision"("id","orgId") ON DELETE SET NULL ON UPDATE CASCADE;

-- 9) AuditBundle createdBy linkage (nullable)
ALTER TABLE "AuditBundle" DROP CONSTRAINT IF EXISTS "AuditBundle_createdByUserId_fkey";
ALTER TABLE "AuditBundle"
  ADD CONSTRAINT "AuditBundle_createdByUserId_orgId_fkey"
  FOREIGN KEY ("createdByUserId","orgId") REFERENCES "User"("id","orgId") ON DELETE SET NULL ON UPDATE CASCADE;

-- 10) Helpful indexes
CREATE INDEX IF NOT EXISTS "VoiceChallenge_orgId_idx" ON "VoiceChallenge"("orgId");
CREATE INDEX IF NOT EXISTS "VoiceProof_orgId_idx" ON "VoiceProof"("orgId");
CREATE INDEX IF NOT EXISTS "Decision_orgId_idx" ON "Decision"("orgId");
CREATE INDEX IF NOT EXISTS "ApprovalToken_orgId_idx" ON "ApprovalToken"("orgId");
CREATE INDEX IF NOT EXISTS "IntentEvent_orgId_idx" ON "IntentEvent"("orgId");
CREATE INDEX IF NOT EXISTS "AuditBundle_orgId_idx" ON "AuditBundle"("orgId");
CREATE INDEX IF NOT EXISTS "Approval_orgId_idx" ON "Approval"("orgId");
CREATE INDEX IF NOT EXISTS "ExecutionLedger_orgId_idx" ON "ExecutionLedger"("orgId");

