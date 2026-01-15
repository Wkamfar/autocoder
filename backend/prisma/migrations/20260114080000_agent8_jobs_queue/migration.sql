-- Agent 8: DB-backed job queue for reliable async work (webhooks, notifications, etc.)

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'DEAD');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "runAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 10,
    "lastError" TEXT,
    "lockedAt" TIMESTAMPTZ,
    "lockedBy" TEXT,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "uniqueKey" TEXT,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Job_type_uniqueKey_key" ON "Job"("type", "uniqueKey");

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- CreateIndex
CREATE INDEX "Job_lockedAt_idx" ON "Job"("lockedAt");

-- CreateIndex
CREATE INDEX "Job_type_idx" ON "Job"("type");

