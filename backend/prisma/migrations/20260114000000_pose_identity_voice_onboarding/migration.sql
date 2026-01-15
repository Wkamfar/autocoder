-- 2026-01-14: POSE identity + voice onboarding primitives

-- Enums
DO $$ BEGIN
  CREATE TYPE "PoseIdentityStatus" AS ENUM ('ACTIVE', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- PoseIdentity table
CREATE TABLE IF NOT EXISTS "PoseIdentity" (
  "poseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "PoseIdentityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoseIdentity_pkey" PRIMARY KEY ("poseId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PoseIdentity_userId_key" ON "PoseIdentity"("userId");
CREATE INDEX IF NOT EXISTS "PoseIdentity_userId_idx" ON "PoseIdentity"("userId");
CREATE INDEX IF NOT EXISTS "PoseIdentity_status_idx" ON "PoseIdentity"("status");
CREATE INDEX IF NOT EXISTS "PoseIdentity_createdAt_idx" ON "PoseIdentity"("createdAt");

DO $$ BEGIN
  ALTER TABLE "PoseIdentity"
    ADD CONSTRAINT "PoseIdentity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- PoseVoiceProfile table
CREATE TABLE IF NOT EXISTS "PoseVoiceProfile" (
  "id" TEXT NOT NULL,
  "poseId" TEXT NOT NULL,
  "voiceProfileVersion" INTEGER NOT NULL,
  "voiceIdentityCommitment" TEXT NOT NULL,
  "embeddingBlobEncrypted" TEXT,
  "ihcFeatureCommitment" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "consentFlagsJson" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoseVoiceProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PoseVoiceProfile_poseId_voiceProfileVersion_key"
  ON "PoseVoiceProfile"("poseId", "voiceProfileVersion");
CREATE INDEX IF NOT EXISTS "PoseVoiceProfile_poseId_idx" ON "PoseVoiceProfile"("poseId");
CREATE INDEX IF NOT EXISTS "PoseVoiceProfile_createdAt_idx" ON "PoseVoiceProfile"("createdAt");

DO $$ BEGIN
  ALTER TABLE "PoseVoiceProfile"
    ADD CONSTRAINT "PoseVoiceProfile_poseId_fkey"
    FOREIGN KEY ("poseId") REFERENCES "PoseIdentity"("poseId")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- PoseVoiceEnrollment table
CREATE TABLE IF NOT EXISTS "PoseVoiceEnrollment" (
  "id" TEXT NOT NULL,
  "poseId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "toneDurationMs" INTEGER NOT NULL,
  "takesMetadataJson" TEXT NOT NULL,
  "qualityMetricsJson" TEXT NOT NULL,
  "clientMetadataJson" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoseVoiceEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PoseVoiceEnrollment_poseId_idx" ON "PoseVoiceEnrollment"("poseId");
CREATE INDEX IF NOT EXISTS "PoseVoiceEnrollment_challengeId_idx" ON "PoseVoiceEnrollment"("challengeId");
CREATE INDEX IF NOT EXISTS "PoseVoiceEnrollment_createdAt_idx" ON "PoseVoiceEnrollment"("createdAt");

DO $$ BEGIN
  ALTER TABLE "PoseVoiceEnrollment"
    ADD CONSTRAINT "PoseVoiceEnrollment_poseId_fkey"
    FOREIGN KEY ("poseId") REFERENCES "PoseIdentity"("poseId")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

