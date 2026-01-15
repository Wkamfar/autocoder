import { describe, it, expect } from "vitest";
import { prisma } from "../db/prisma.js";
import { scheduleWebhookDeliveryAttempt, attemptWebhookDeliveryById } from "../modules/webhooks/webhookService.js";
import { dbAvailable } from "./testDb.js";

describe("Agent 4 P0: async/job tenant isolation", () => {
  it("enqueues webhook delivery jobs with orgId in payload", async () => {
    if (!(await dbAvailable())) return;

    const ts = Date.now();
    const jobId = `job_test_${ts}`;
    const orgId = `org_async_${ts}`;

    try {
      // Minimal setup: job queue table exists; we only need an orgId string in payload.
      await scheduleWebhookDeliveryAttempt({ deliveryId: `delivery_${ts}`, orgId, runAt: new Date() });

      const job = await prisma.job.findFirst({
        where: { type: "webhook.delivery", uniqueKey: `delivery_${ts}` },
        orderBy: { createdAt: "desc" },
      });

      expect(job).toBeTruthy();
      const payload = JSON.parse(job!.payloadJson);
      expect(payload.deliveryId).toBe(`delivery_${ts}`);
      expect(payload.orgId).toBe(orgId);
    } finally {
      // Best-effort cleanup (dedupe key used)
      await prisma.job.deleteMany({ where: { uniqueKey: `delivery_${ts}` } }).catch(() => null);
    }
  });

  it("fails closed if a webhook delivery job attempts to deliver cross-tenant", async () => {
    if (!(await dbAvailable())) return;

    const ts = Date.now();
    const orgA = `org_a_${ts}`;
    const orgB = `org_b_${ts}`;
    const userB = `user_b_${ts}`;
    const webhookB = `wh_b_${ts}`;
    const deliveryId = `delivery_${ts}`;

    try {
      await prisma.organization.create({ data: { id: orgA, name: `Org A ${ts}` } });
      await prisma.organization.create({ data: { id: orgB, name: `Org B ${ts}` } });

      await prisma.user.create({
        data: {
          id: userB,
          orgId: orgB,
          email: `b_${ts}@example.com`,
          name: "User B",
          role: "ADMIN",
          permissions: [],
          voiceEnrolled: false,
          createdAt: new Date(),
        },
      });

      await prisma.webhook.create({
        data: {
          id: webhookB,
          orgId: orgB,
          userId: userB,
          name: "Webhook B",
          url: "https://example.invalid/webhook", // never reached (we should fail before sending)
          events: ["intent.executed"],
          secretHash: `secret_${ts}`,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await prisma.webhookDelivery.create({
        data: {
          id: deliveryId,
          webhookId: webhookB,
          orgId: orgB,
          eventType: "intent.executed",
          eventId: `evt_${ts}`,
          payloadJson: JSON.stringify({ ok: true }),
          status: "pending",
          statusCode: null,
          responseBody: null,
          attemptNumber: 1,
          nextRetryAt: null,
          deliveredAt: null,
          createdAt: new Date(),
        },
      });

      const result = await attemptWebhookDeliveryById(deliveryId, orgA);
      expect(result.ok).toBe(false);
      expect(result.nextRetryAt ?? null).toBe(null);

      const updated = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
      expect(updated?.status).toBe("failed");
      expect(updated?.nextRetryAt ?? null).toBe(null);
    } finally {
      await prisma.webhookDelivery.deleteMany({ where: { id: deliveryId } }).catch(() => null);
      await prisma.webhook.deleteMany({ where: { id: webhookB } }).catch(() => null);
      await prisma.user.deleteMany({ where: { id: userB } }).catch(() => null);
      await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } }).catch(() => null);
    }
  });
});

