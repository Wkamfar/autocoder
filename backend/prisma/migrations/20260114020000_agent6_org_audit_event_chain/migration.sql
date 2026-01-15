-- Agent 6: Org-level audit events (tamper-evident chain for non-intent domains)

CREATE TABLE "OrgAuditEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,
  "payloadCanonicalJson" TEXT NOT NULL,
  "prevHash" TEXT,
  "eventHash" TEXT NOT NULL,
  "correlationId" TEXT,
  "requestId" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "OrgAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgAuditEvent_orgId_seq_key" ON "OrgAuditEvent"("orgId", "seq");
CREATE UNIQUE INDEX "OrgAuditEvent_id_orgId_key" ON "OrgAuditEvent"("id", "orgId");
CREATE INDEX "OrgAuditEvent_orgId_idx" ON "OrgAuditEvent"("orgId");
CREATE INDEX "OrgAuditEvent_createdAt_idx" ON "OrgAuditEvent"("createdAt");

ALTER TABLE "OrgAuditEvent"
  ADD CONSTRAINT "OrgAuditEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrgAuditEvent"
  ADD CONSTRAINT "OrgAuditEvent_actorUserId_orgId_fkey" FOREIGN KEY ("actorUserId", "orgId") REFERENCES "User"("id", "orgId") ON DELETE SET NULL ON UPDATE CASCADE;

