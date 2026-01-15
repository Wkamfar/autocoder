-- Agent 6: Compliance exports + retention/legal holds + bundle download audit

-- Extend AuditBundle for mode + chain linkage + retention lifecycle
ALTER TABLE "AuditBundle" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'full';
ALTER TABLE "AuditBundle" ADD COLUMN "chainHash" TEXT;
ALTER TABLE "AuditBundle" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "AuditBundle" ADD COLUMN "retentionUntil" TIMESTAMPTZ;
ALTER TABLE "AuditBundle" ADD COLUMN "deletedAt" TIMESTAMPTZ;

CREATE INDEX "AuditBundle_intentId_idx" ON "AuditBundle"("intentId");
CREATE INDEX "AuditBundle_createdAt_idx" ON "AuditBundle"("createdAt");
CREATE INDEX "AuditBundle_deletedAt_idx" ON "AuditBundle"("deletedAt");

ALTER TABLE "AuditBundle"
  ADD CONSTRAINT "AuditBundle_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Org-level compliance retention policy
CREATE TABLE "ComplianceRetentionPolicy" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "authAuditRetentionDays" INTEGER NOT NULL DEFAULT 180,
  "evidenceBundleRetentionDays" INTEGER NOT NULL DEFAULT 365,
  "wormEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ComplianceRetentionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComplianceRetentionPolicy_orgId_key" ON "ComplianceRetentionPolicy"("orgId");
CREATE INDEX "ComplianceRetentionPolicy_orgId_idx" ON "ComplianceRetentionPolicy"("orgId");

ALTER TABLE "ComplianceRetentionPolicy"
  ADD CONSTRAINT "ComplianceRetentionPolicy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Legal holds (prevent purge)
CREATE TABLE "LegalHold" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "intentId" TEXT,
  "bundleId" TEXT,
  "reason" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "releasedAt" TIMESTAMPTZ,
  "releasedByUserId" TEXT,
  CONSTRAINT "LegalHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LegalHold_orgId_idx" ON "LegalHold"("orgId");
CREATE INDEX "LegalHold_intentId_idx" ON "LegalHold"("intentId");
CREATE INDEX "LegalHold_bundleId_idx" ON "LegalHold"("bundleId");
CREATE INDEX "LegalHold_createdAt_idx" ON "LegalHold"("createdAt");

ALTER TABLE "LegalHold"
  ADD CONSTRAINT "LegalHold_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalHold"
  ADD CONSTRAINT "LegalHold_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Evidence download audit trail
CREATE TABLE "EvidenceDownload" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "intentId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "EvidenceDownload_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvidenceDownload_orgId_idx" ON "EvidenceDownload"("orgId");
CREATE INDEX "EvidenceDownload_bundleId_idx" ON "EvidenceDownload"("bundleId");
CREATE INDEX "EvidenceDownload_intentId_idx" ON "EvidenceDownload"("intentId");
CREATE INDEX "EvidenceDownload_createdAt_idx" ON "EvidenceDownload"("createdAt");

ALTER TABLE "EvidenceDownload"
  ADD CONSTRAINT "EvidenceDownload_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceDownload"
  ADD CONSTRAINT "EvidenceDownload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

