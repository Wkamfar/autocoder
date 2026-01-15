-- Agent D: Add Approval, IdempotencyKey, ExecutionLedger tables and Intent.version field
-- Migration: 20250102000000_agent_d_correctness

-- Add version field to Intent for optimistic locking
ALTER TABLE "Intent" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Create ExecutionStatus enum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'RECONCILED');

-- Create Approval table
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "bindingHash" TEXT NOT NULL,
    "decisionType" "DecisionType" NOT NULL,
    "decisionId" TEXT,
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- Create IdempotencyKey table
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- Create ExecutionLedger table
CREATE TABLE "ExecutionLedger" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "executionRef" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "approvalTokenHash" TEXT NOT NULL,
    "bindingHash" TEXT NOT NULL,
    "executedByUserId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "externalRef" TEXT,
    "externalStatus" TEXT,
    "reconciliationStatus" TEXT,
    "reconciliationAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionLedger_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "Approval_intentId_bindingHash_idx" ON "Approval"("intentId", "bindingHash");
CREATE INDEX "Approval_approverUserId_idx" ON "Approval"("approverUserId");
CREATE INDEX "Approval_intentId_approverUserId_bindingHash_idx" ON "Approval"("intentId", "approverUserId", "bindingHash");

CREATE UNIQUE INDEX "IdempotencyKey_keyHash_key" ON "IdempotencyKey"("keyHash");
CREATE INDEX "IdempotencyKey_keyHash_idx" ON "IdempotencyKey"("keyHash");
CREATE INDEX "IdempotencyKey_userId_endpoint_idx" ON "IdempotencyKey"("userId", "endpoint");
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

CREATE UNIQUE INDEX "ExecutionLedger_executionRef_key" ON "ExecutionLedger"("executionRef");
CREATE INDEX "ExecutionLedger_intentId_idx" ON "ExecutionLedger"("intentId");
CREATE INDEX "ExecutionLedger_executionRef_idx" ON "ExecutionLedger"("executionRef");
CREATE INDEX "ExecutionLedger_status_idx" ON "ExecutionLedger"("status");
CREATE INDEX "ExecutionLedger_reconciliationStatus_idx" ON "ExecutionLedger"("reconciliationStatus");

-- Add foreign keys
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "Intent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExecutionLedger" ADD CONSTRAINT "ExecutionLedger_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "Intent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutionLedger" ADD CONSTRAINT "ExecutionLedger_executedByUserId_fkey" FOREIGN KEY ("executedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create partial unique index for Approval (only active approvals)
-- This enforces: 1 approval per user per intent+bindingHash (only when invalidatedAt IS NULL)
CREATE UNIQUE INDEX "Approval_unique_active_per_intent_user_binding" 
ON "Approval" ("intentId", "approverUserId", "bindingHash") 
WHERE "invalidatedAt" IS NULL;
