-- Initial schema for wire2 backend (modular monolith)
--
-- NOTE (2026-01-14):
-- This migration is intentionally dated to run BEFORE any dependent migrations
-- (e.g. sessions/auth audit, tenant constraints, job queue, etc).
--
-- The previous init migration directory was `20251231000000_init/` which caused
-- fresh databases to fail migration due to missing base tables like "User".
-- That late init has been converted into a no-op to preserve the directory name.

-- Enums
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TREASURY_INITIATOR', 'APPROVER', 'AUDITOR', 'READ_ONLY');
CREATE TYPE "RailsType" AS ENUM ('ACH', 'WIRE');
CREATE TYPE "IntentStatus" AS ENUM ('DRAFT', 'PENDING_PROOF', 'CHALLENGING', 'PENDING_APPROVALS', 'APPROVED', 'DENIED', 'EXECUTED', 'EXPIRED', 'CANCELED');
CREATE TYPE "ChallengeLevel" AS ENUM ('L1', 'L2', 'L3');
CREATE TYPE "ChallengeLanguage" AS ENUM ('EN', 'ES');
CREATE TYPE "ProofChannel" AS ENUM ('BROWSER', 'PHONE');
CREATE TYPE "BeneficiaryStatus" AS ENUM ('ACTIVE', 'LOCKED', 'PENDING_VERIFICATION');
CREATE TYPE "DecisionType" AS ENUM ('APPROVE', 'DENY', 'STEP_UP');

-- Organization
CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- User
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "permissions" TEXT[] NOT NULL,
  "voiceEnrolled" BOOLEAN NOT NULL DEFAULT FALSE,
  "enrolledAt" TIMESTAMPTZ,
  "lastActivityAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_orgId_idx" ON "User"("orgId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Beneficiary
CREATE TABLE "Beneficiary" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "railsAllowed" "RailsType"[] NOT NULL,
  "bankLast4" TEXT NOT NULL,
  "bankTokenHash" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "BeneficiaryStatus" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "lastChangedAt" TIMESTAMPTZ NOT NULL,
  "lastChangedBy" TEXT NOT NULL,
  CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Beneficiary_orgId_idx" ON "Beneficiary"("orgId");

ALTER TABLE "Beneficiary"
  ADD CONSTRAINT "Beneficiary_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- BeneficiaryVersion
CREATE TABLE "BeneficiaryVersion" (
  "id" TEXT NOT NULL,
  "beneficiaryId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshotJson" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdBy" TEXT NOT NULL,
  CONSTRAINT "BeneficiaryVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BeneficiaryVersion_beneficiaryId_version_key" ON "BeneficiaryVersion"("beneficiaryId", "version");

ALTER TABLE "BeneficiaryVersion"
  ADD CONSTRAINT "BeneficiaryVersion_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Intent
CREATE TABLE "Intent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "railsType" "RailsType" NOT NULL,
  "amountMinor" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "beneficiaryId" TEXT NOT NULL,
  "beneficiaryVersion" INTEGER,
  "purpose" TEXT NOT NULL,
  "status" "IntentStatus" NOT NULL,
  "riskScore" INTEGER NOT NULL,
  "riskRationaleJson" TEXT NOT NULL,
  "requiredApprovals" INTEGER NOT NULL,
  "requiredChallengeLevel" "ChallengeLevel" NOT NULL,
  "bindingHash" TEXT NOT NULL,
  "cooldownUntil" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "Intent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Intent_orgId_idx" ON "Intent"("orgId");
CREATE INDEX "Intent_status_idx" ON "Intent"("status");
CREATE INDEX "Intent_beneficiaryId_idx" ON "Intent"("beneficiaryId");

ALTER TABLE "Intent"
  ADD CONSTRAINT "Intent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Intent"
  ADD CONSTRAINT "Intent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Intent"
  ADD CONSTRAINT "Intent_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- VoiceChallenge
CREATE TABLE "VoiceChallenge" (
  "id" TEXT NOT NULL,
  "intentId" TEXT NOT NULL,
  "language" "ChallengeLanguage" NOT NULL,
  "level" "ChallengeLevel" NOT NULL,
  "grammarVersion" TEXT NOT NULL,
  "challengeNonce" TEXT NOT NULL,
  "challengeText" TEXT NOT NULL,
  "expectedSlotsJson" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMPTZ,
  CONSTRAINT "VoiceChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VoiceChallenge_intentId_idx" ON "VoiceChallenge"("intentId");

ALTER TABLE "VoiceChallenge"
  ADD CONSTRAINT "VoiceChallenge_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "Intent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- VoiceProof
CREATE TABLE "VoiceProof" (
  "id" TEXT NOT NULL,
  "intentId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" "ProofChannel" NOT NULL,
  "transcript" TEXT NOT NULL,
  "transcriptLanguage" TEXT,
  "scoresJson" TEXT NOT NULL,
  "deviceMetadataJson" TEXT NOT NULL,
  "audioEncryptedRef" TEXT,
  "audioHash" TEXT,
  "modelVersion" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "VoiceProof_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VoiceProof_intentId_idx" ON "VoiceProof"("intentId");
CREATE INDEX "VoiceProof_challengeId_idx" ON "VoiceProof"("challengeId");

ALTER TABLE "VoiceProof"
  ADD CONSTRAINT "VoiceProof_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "Intent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoiceProof"
  ADD CONSTRAINT "VoiceProof_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "VoiceChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoiceProof"
  ADD CONSTRAINT "VoiceProof_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Decision
CREATE TABLE "Decision" (
  "id" TEXT NOT NULL,
  "intentId" TEXT NOT NULL,
  "decisionType" "DecisionType" NOT NULL,
  "reasonCodesJson" TEXT NOT NULL,
  "approvalTokenHash" TEXT,
  "expiresAt" TIMESTAMPTZ,
  "signerKeyId" TEXT NOT NULL,
  "decisionPayloadCanonicalJson" TEXT NOT NULL,
  "decisionHash" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "policyId" TEXT,
  "policyVersion" INTEGER,
  "riskEngineVersion" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Decision_intentId_idx" ON "Decision"("intentId");

ALTER TABLE "Decision"
  ADD CONSTRAINT "Decision_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "Intent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Decision"
  ADD CONSTRAINT "Decision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ApprovalToken
CREATE TABLE "ApprovalToken" (
  "id" TEXT NOT NULL,
  "intentId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "bindingHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "consumedAt" TIMESTAMPTZ,
  "invalidatedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ApprovalToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApprovalToken_tokenHash_key" ON "ApprovalToken"("tokenHash");
CREATE INDEX "ApprovalToken_intentId_idx" ON "ApprovalToken"("intentId");

ALTER TABLE "ApprovalToken"
  ADD CONSTRAINT "ApprovalToken_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "Intent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- IntentEvent
CREATE TABLE "IntentEvent" (
  "id" TEXT NOT NULL,
  "intentId" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,
  "payloadCanonicalJson" TEXT NOT NULL,
  "prevHash" TEXT,
  "eventHash" TEXT NOT NULL,
  "correlationId" TEXT,
  "requestId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "IntentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntentEvent_intentId_seq_key" ON "IntentEvent"("intentId", "seq");

ALTER TABLE "IntentEvent"
  ADD CONSTRAINT "IntentEvent_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "Intent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntentEvent"
  ADD CONSTRAINT "IntentEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AuditBundle
CREATE TABLE "AuditBundle" (
  "id" TEXT NOT NULL,
  "intentId" TEXT NOT NULL,
  "bundleHash" TEXT NOT NULL,
  "manifestCanonicalJson" TEXT NOT NULL,
  "manifestSignature" TEXT NOT NULL,
  "signerKeyId" TEXT NOT NULL,
  "storageRef" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "AuditBundle_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AuditBundle"
  ADD CONSTRAINT "AuditBundle_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "Intent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Policy + PolicyVersion
CREATE TABLE "Policy" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "activeVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Policy"
  ADD CONSTRAINT "Policy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PolicyVersion" (
  "id" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "effectiveAt" TIMESTAMPTZ NOT NULL,
  "thresholdsJson" TEXT NOT NULL,
  "rulesJson" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PolicyVersion_policyId_version_key" ON "PolicyVersion"("policyId", "version");

ALTER TABLE "PolicyVersion"
  ADD CONSTRAINT "PolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ServiceHealth (single row)
CREATE TABLE "ServiceHealth" (
  "id" TEXT NOT NULL,
  "voiceService" TEXT NOT NULL,
  "phoneService" TEXT NOT NULL,
  "storageService" TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ServiceHealth_pkey" PRIMARY KEY ("id")
);

