-- Agent B: Add Session and AuthAuditLog tables for authentication and authorization

-- Session table for session lifecycle management
CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "refreshTokenHash" TEXT,
  "deviceFingerprint" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  "lastActivityAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_tokenHash_idx" ON "Session"("tokenHash");
CREATE INDEX "Session_refreshTokenHash_idx" ON "Session"("refreshTokenHash");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AuthAuditLog table for authentication and authorization audit logging
CREATE TABLE "AuthAuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "orgId" TEXT,
  "eventType" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "sessionId" TEXT,
  "detailsJson" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "AuthAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthAuditLog_userId_idx" ON "AuthAuditLog"("userId");
CREATE INDEX "AuthAuditLog_eventType_idx" ON "AuthAuditLog"("eventType");
CREATE INDEX "AuthAuditLog_createdAt_idx" ON "AuthAuditLog"("createdAt");
