-- Agent 7: Bank connections + provider events + reconciliation scaffolding
-- Bank-grade primitives: encrypted tokens at rest, provider event normalization, exception queue.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BankConnectionStatus" AS ENUM ('ACTIVE', 'DEGRADED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ReconciliationExceptionStatus" AS ENUM ('OPEN', 'RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: ExecutionLedger
ALTER TABLE "ExecutionLedger"
  ADD COLUMN IF NOT EXISTS "state" TEXT,
  ADD COLUMN IF NOT EXISTS "provider" TEXT;

-- CreateTable: BankConnection
CREATE TABLE IF NOT EXISTS "BankConnection" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "institutionName" TEXT NOT NULL,
  "status" "BankConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "consentExpiresAt" TIMESTAMPTZ,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "lastSyncAt" TIMESTAMPTZ,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "BankConnection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BankConnection_orgId_idx" ON "BankConnection"("orgId");
CREATE INDEX IF NOT EXISTS "BankConnection_status_idx" ON "BankConnection"("status");
CREATE INDEX IF NOT EXISTS "BankConnection_provider_idx" ON "BankConnection"("provider");
CREATE UNIQUE INDEX IF NOT EXISTS "BankConnection_id_orgId_key" ON "BankConnection"("id", "orgId");

ALTER TABLE "BankConnection"
  ADD CONSTRAINT "BankConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce same-org creator via composite FK (User(id, orgId) is unique)
ALTER TABLE "BankConnection"
  ADD CONSTRAINT "BankConnection_createdByUserId_orgId_fkey" FOREIGN KEY ("createdByUserId", "orgId") REFERENCES "User"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: BankAccount
CREATE TABLE IF NOT EXISTS "BankAccount" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mask" TEXT,
  "type" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "railsEligible" "RailsType"[] NOT NULL,
  "ownershipJson" TEXT,
  "verificationJson" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BankAccount_orgId_idx" ON "BankAccount"("orgId");
CREATE INDEX IF NOT EXISTS "BankAccount_connectionId_idx" ON "BankAccount"("connectionId");
CREATE UNIQUE INDEX IF NOT EXISTS "BankAccount_id_orgId_key" ON "BankAccount"("id", "orgId");

ALTER TABLE "BankAccount"
  ADD CONSTRAINT "BankAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BankAccount"
  ADD CONSTRAINT "BankAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BankConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ProviderEvent
CREATE TABLE IF NOT EXISTS "ProviderEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT,
  "providerEventType" TEXT NOT NULL,
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "orgId" TEXT,
  "intentId" TEXT,
  "executionRef" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "rawPayloadJson" TEXT NOT NULL,
  "normalizedPayloadJson" TEXT NOT NULL,
  "processedAt" TIMESTAMPTZ,
  "processingError" TEXT,

  CONSTRAINT "ProviderEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderEvent_dedupeKey_key" ON "ProviderEvent"("dedupeKey");
CREATE INDEX IF NOT EXISTS "ProviderEvent_provider_idx" ON "ProviderEvent"("provider");
CREATE INDEX IF NOT EXISTS "ProviderEvent_receivedAt_idx" ON "ProviderEvent"("receivedAt");
CREATE INDEX IF NOT EXISTS "ProviderEvent_orgId_idx" ON "ProviderEvent"("orgId");
CREATE INDEX IF NOT EXISTS "ProviderEvent_intentId_idx" ON "ProviderEvent"("intentId");
CREATE INDEX IF NOT EXISTS "ProviderEvent_executionRef_idx" ON "ProviderEvent"("executionRef");

-- CreateTable: ReconciliationException
CREATE TABLE IF NOT EXISTS "ReconciliationException" (
  "id" TEXT NOT NULL,
  "status" "ReconciliationExceptionStatus" NOT NULL DEFAULT 'OPEN',
  "orgId" TEXT,
  "executionRef" TEXT,
  "providerEventId" TEXT,
  "kind" TEXT NOT NULL,
  "detailsJson" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "resolvedAt" TIMESTAMPTZ,
  "resolvedByUserId" TEXT,
  "resolutionJson" TEXT,

  CONSTRAINT "ReconciliationException_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReconciliationException_status_idx" ON "ReconciliationException"("status");
CREATE INDEX IF NOT EXISTS "ReconciliationException_orgId_idx" ON "ReconciliationException"("orgId");
CREATE INDEX IF NOT EXISTS "ReconciliationException_executionRef_idx" ON "ReconciliationException"("executionRef");
CREATE INDEX IF NOT EXISTS "ReconciliationException_providerEventId_idx" ON "ReconciliationException"("providerEventId");

