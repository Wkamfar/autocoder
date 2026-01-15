-- Add API Keys table
CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL UNIQUE,
    "secretHash" TEXT NOT NULL,
    "permissions" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY ("id")
);

CREATE INDEX "ApiKey_orgId_idx" ON "ApiKey"("orgId");
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- Add Webhooks table
CREATE TABLE IF NOT EXISTS "Webhook" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[] NOT NULL,
    "secretHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY ("id")
);

CREATE INDEX "Webhook_orgId_idx" ON "Webhook"("orgId");
CREATE INDEX "Webhook_userId_idx" ON "Webhook"("userId");
CREATE INDEX "Webhook_active_idx" ON "Webhook"("active");

-- Add Webhook Deliveries table
CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusCode" INTEGER,
    "responseBody" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "nextRetryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY ("id")
);

CREATE INDEX "WebhookDelivery_webhookId_idx" ON "WebhookDelivery"("webhookId");
CREATE INDEX "WebhookDelivery_eventId_idx" ON "WebhookDelivery"("eventId");
CREATE INDEX "WebhookDelivery_status_idx" ON "WebhookDelivery"("status");
CREATE INDEX "WebhookDelivery_nextRetryAt_idx" ON "WebhookDelivery"("nextRetryAt");

-- Add User Invitations table
CREATE TABLE IF NOT EXISTS "UserInvitation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" TEXT[],
    "tokenHash" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY ("id")
);

CREATE INDEX "UserInvitation_orgId_idx" ON "UserInvitation"("orgId");
CREATE INDEX "UserInvitation_email_idx" ON "UserInvitation"("email");
CREATE INDEX "UserInvitation_tokenHash_idx" ON "UserInvitation"("tokenHash");
CREATE INDEX "UserInvitation_expiresAt_idx" ON "UserInvitation"("expiresAt");

-- Add Email Templates table (for tracking sent emails)
CREATE TABLE IF NOT EXISTS "EmailLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "userId" TEXT,
    "toEmail" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "bodyText" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY ("id")
);

CREATE INDEX "EmailLog_toEmail_idx" ON "EmailLog"("toEmail");
CREATE INDEX "EmailLog_templateType_idx" ON "EmailLog"("templateType");
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
