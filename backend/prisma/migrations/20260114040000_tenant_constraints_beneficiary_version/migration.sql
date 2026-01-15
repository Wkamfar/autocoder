-- 2026-01-14: Agent 4 P0 — tenant-scope BeneficiaryVersion (orgId + composite FK)

ALTER TABLE "BeneficiaryVersion" ADD COLUMN IF NOT EXISTS "orgId" TEXT;

-- Backfill orgId from Beneficiary
UPDATE "BeneficiaryVersion" bv
SET "orgId" = b."orgId"
FROM "Beneficiary" b
WHERE bv."beneficiaryId" = b."id" AND bv."orgId" IS NULL;

ALTER TABLE "BeneficiaryVersion" ALTER COLUMN "orgId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "BeneficiaryVersion_id_orgId_key" ON "BeneficiaryVersion"("id","orgId");
CREATE INDEX IF NOT EXISTS "BeneficiaryVersion_orgId_idx" ON "BeneficiaryVersion"("orgId");

ALTER TABLE "BeneficiaryVersion" DROP CONSTRAINT IF EXISTS "BeneficiaryVersion_beneficiaryId_fkey";
ALTER TABLE "BeneficiaryVersion"
  ADD CONSTRAINT "BeneficiaryVersion_beneficiaryId_orgId_fkey"
  FOREIGN KEY ("beneficiaryId","orgId") REFERENCES "Beneficiary"("id","orgId")
  ON DELETE CASCADE ON UPDATE CASCADE;

