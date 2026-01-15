-- 2026-01-14: Agent 4 — Multi-tenant DB constraints + Org → LegalEntity → FinancialAccount hierarchy
-- Goal: enforce org-scoped relationships at the database layer (not just in service code).

-- Composite unique helpers (required for composite foreign keys)
CREATE UNIQUE INDEX IF NOT EXISTS "User_id_orgId_key" ON "User"("id","orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "Beneficiary_id_orgId_key" ON "Beneficiary"("id","orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "Intent_id_orgId_key" ON "Intent"("id","orgId");

-- Strengthen session isolation: Session(userId, orgId) must point at User(id, orgId)
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_userId_fkey";
ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_orgId_fkey"
  FOREIGN KEY ("userId","orgId") REFERENCES "User"("id","orgId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Strengthen intent isolation:
-- - createdByUser must belong to same org as intent
-- - beneficiary must belong to same org as intent
ALTER TABLE "Intent" DROP CONSTRAINT IF EXISTS "Intent_createdByUserId_fkey";
ALTER TABLE "Intent" DROP CONSTRAINT IF EXISTS "Intent_beneficiaryId_fkey";

ALTER TABLE "Intent"
  ADD CONSTRAINT "Intent_createdByUserId_orgId_fkey"
  FOREIGN KEY ("createdByUserId","orgId") REFERENCES "User"("id","orgId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Intent"
  ADD CONSTRAINT "Intent_beneficiaryId_orgId_fkey"
  FOREIGN KEY ("beneficiaryId","orgId") REFERENCES "Beneficiary"("id","orgId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add foreign keys for org-scoped resources (API keys, webhooks, invitations)
ALTER TABLE "ApiKey"
  ADD CONSTRAINT "ApiKey_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApiKey"
  ADD CONSTRAINT "ApiKey_userId_orgId_fkey"
  FOREIGN KEY ("userId","orgId") REFERENCES "User"("id","orgId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Webhook"
  ADD CONSTRAINT "Webhook_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Webhook"
  ADD CONSTRAINT "Webhook_userId_orgId_fkey"
  FOREIGN KEY ("userId","orgId") REFERENCES "User"("id","orgId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserInvitation"
  ADD CONSTRAINT "UserInvitation_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserInvitation"
  ADD CONSTRAINT "UserInvitation_invitedByUserId_orgId_fkey"
  FOREIGN KEY ("invitedByUserId","orgId") REFERENCES "User"("id","orgId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Agent 4: Org → LegalEntity → FinancialAccount hierarchy
CREATE TABLE IF NOT EXISTS "LegalEntity" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalEntity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LegalEntity_id_orgId_key" ON "LegalEntity"("id","orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "LegalEntity_orgId_name_key" ON "LegalEntity"("orgId","name");
CREATE INDEX IF NOT EXISTS "LegalEntity_orgId_idx" ON "LegalEntity"("orgId");

ALTER TABLE "LegalEntity"
  ADD CONSTRAINT "LegalEntity_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FinancialAccount" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FinancialAccount_id_orgId_key" ON "FinancialAccount"("id","orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "FinancialAccount_orgId_legalEntityId_name_key" ON "FinancialAccount"("orgId","legalEntityId","name");
CREATE INDEX IF NOT EXISTS "FinancialAccount_orgId_idx" ON "FinancialAccount"("orgId");
CREATE INDEX IF NOT EXISTS "FinancialAccount_legalEntityId_idx" ON "FinancialAccount"("legalEntityId");

ALTER TABLE "FinancialAccount"
  ADD CONSTRAINT "FinancialAccount_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinancialAccount"
  ADD CONSTRAINT "FinancialAccount_legalEntityId_orgId_fkey"
  FOREIGN KEY ("legalEntityId","orgId") REFERENCES "LegalEntity"("id","orgId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

