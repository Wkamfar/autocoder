-- 2026-01-14: Agent 4 P0 — extend tenant constraints to WebhookDelivery + LegalHold user linkage

-- WebhookDelivery: add orgId, backfill from Webhook, and enforce composite FK to Webhook(id, orgId)
ALTER TABLE "WebhookDelivery" ADD COLUMN IF NOT EXISTS "orgId" TEXT;

UPDATE "WebhookDelivery" d
SET "orgId" = w."orgId"
FROM "Webhook" w
WHERE d."webhookId" = w."id" AND d."orgId" IS NULL;

ALTER TABLE "WebhookDelivery" ALTER COLUMN "orgId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Webhook_id_orgId_key" ON "Webhook"("id","orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookDelivery_id_orgId_key" ON "WebhookDelivery"("id","orgId");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_orgId_idx" ON "WebhookDelivery"("orgId");

ALTER TABLE "WebhookDelivery" DROP CONSTRAINT IF EXISTS "WebhookDelivery_webhookId_fkey";
ALTER TABLE "WebhookDelivery"
  ADD CONSTRAINT "WebhookDelivery_webhookId_orgId_fkey"
  FOREIGN KEY ("webhookId","orgId") REFERENCES "Webhook"("id","orgId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- LegalHold: enforce same-org user linkage for createdByUserId
ALTER TABLE "LegalHold" DROP CONSTRAINT IF EXISTS "LegalHold_createdByUserId_fkey";
ALTER TABLE "LegalHold"
  ADD CONSTRAINT "LegalHold_createdByUserId_orgId_fkey"
  FOREIGN KEY ("createdByUserId","orgId") REFERENCES "User"("id","orgId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

