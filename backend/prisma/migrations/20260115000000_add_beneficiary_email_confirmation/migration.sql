-- AlterTable
ALTER TABLE "Beneficiary" ADD COLUMN IF NOT EXISTS "email" TEXT,
ADD COLUMN IF NOT EXISTS "confirmationToken" TEXT,
ADD COLUMN IF NOT EXISTS "confirmationTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Beneficiary_confirmationToken_idx" ON "Beneficiary"("confirmationToken");
