-- 2026-01-13: Public intents (no-login), custom domains, email domains, SSO config, org groups

-- Enums
DO $$ BEGIN
  CREATE TYPE "PublicIntentStatus" AS ENUM ('PENDING', 'CLAIMED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DomainVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrgGroupRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- PublicIntent table
CREATE TABLE IF NOT EXISTS "PublicIntent" (
  "id" TEXT NOT NULL,
  "status" "PublicIntentStatus" NOT NULL DEFAULT 'PENDING',
  "claimTokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "claimedAt" TIMESTAMP(3),
  "claimedByUserId" TEXT,
  "claimedToOrgId" TEXT,
  "linkedIntentId" TEXT,
  "railsType" "RailsType" NOT NULL,
  "amountMinor" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "beneficiaryDisplayName" TEXT NOT NULL,
  "beneficiaryCountry" TEXT NOT NULL,
  "beneficiaryBankLast4" TEXT NOT NULL,
  "beneficiaryTokenHash" TEXT NOT NULL,
  "requestorEmail" TEXT,
  "requestorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PublicIntent_claimTokenHash_key" ON "PublicIntent"("claimTokenHash");
CREATE INDEX IF NOT EXISTS "PublicIntent_createdAt_idx" ON "PublicIntent"("createdAt");
CREATE INDEX IF NOT EXISTS "PublicIntent_status_idx" ON "PublicIntent"("status");
CREATE INDEX IF NOT EXISTS "PublicIntent_expiresAt_idx" ON "PublicIntent"("expiresAt");

-- CustomDomain table
CREATE TABLE IF NOT EXISTS "CustomDomain" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "status" "DomainVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "verificationToken" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomDomain_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CustomDomain_orgId_idx" ON "CustomDomain"("orgId");
CREATE INDEX IF NOT EXISTS "CustomDomain_domain_idx" ON "CustomDomain"("domain");
CREATE INDEX IF NOT EXISTS "CustomDomain_status_idx" ON "CustomDomain"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomDomain_orgId_domain_key" ON "CustomDomain"("orgId","domain");

ALTER TABLE "CustomDomain"
  ADD CONSTRAINT "CustomDomain_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- EmailDomain table
CREATE TABLE IF NOT EXISTS "EmailDomain" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "status" "DomainVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "spfExpectedTxt" TEXT NOT NULL,
  "dkimSelector" TEXT NOT NULL,
  "dkimPublicKeyPem" TEXT NOT NULL,
  "dkimPrivateKeyPem" TEXT NOT NULL,
  "dmarcExpectedTxt" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailDomain_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailDomain_orgId_idx" ON "EmailDomain"("orgId");
CREATE INDEX IF NOT EXISTS "EmailDomain_domain_idx" ON "EmailDomain"("domain");
CREATE INDEX IF NOT EXISTS "EmailDomain_status_idx" ON "EmailDomain"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "EmailDomain_orgId_domain_key" ON "EmailDomain"("orgId","domain");

ALTER TABLE "EmailDomain"
  ADD CONSTRAINT "EmailDomain_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OrgSsoConfig table
CREATE TABLE IF NOT EXISTS "OrgSsoConfig" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "enforced" BOOLEAN NOT NULL DEFAULT false,
  "allowedEmailDomains" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrgSsoConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgSsoConfig_orgId_key" ON "OrgSsoConfig"("orgId");
CREATE INDEX IF NOT EXISTS "OrgSsoConfig_orgId_idx" ON "OrgSsoConfig"("orgId");

ALTER TABLE "OrgSsoConfig"
  ADD CONSTRAINT "OrgSsoConfig_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OrgGroup tables
CREATE TABLE IF NOT EXISTS "OrgGroup" (
  "id" TEXT NOT NULL,
  "ownerOrgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrgGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrgGroup_ownerOrgId_idx" ON "OrgGroup"("ownerOrgId");

ALTER TABLE "OrgGroup"
  ADD CONSTRAINT "OrgGroup_ownerOrgId_fkey"
  FOREIGN KEY ("ownerOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "OrgGroupMembership" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "role" "OrgGroupRole" NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrgGroupMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgGroupMembership_groupId_orgId_key" ON "OrgGroupMembership"("groupId","orgId");
CREATE INDEX IF NOT EXISTS "OrgGroupMembership_groupId_idx" ON "OrgGroupMembership"("groupId");
CREATE INDEX IF NOT EXISTS "OrgGroupMembership_orgId_idx" ON "OrgGroupMembership"("orgId");

ALTER TABLE "OrgGroupMembership"
  ADD CONSTRAINT "OrgGroupMembership_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "OrgGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrgGroupMembership"
  ADD CONSTRAINT "OrgGroupMembership_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

