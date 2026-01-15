/**
 * Webhook Management Routes
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePermission } from "../modules/security/auth.js";
import {
  createWebhook,
  listWebhooks,
  updateWebhook,
  deleteWebhook,
  listWebhookDeliveries,
  rotateWebhookSecret,
  sendTestWebhook,
} from "../modules/webhooks/webhookService.js";
import type { WebhookEventType } from "../modules/webhooks/webhookService.js";
import { emitOrgAuditEvent } from "../modules/audit/auditEvents.js";

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  // List webhooks
  app.get(
    "/webhooks",
    { preHandler: requirePermission("webhook:view") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const webhooks = await listWebhooks(req.user.orgId);
      
      return webhooks.map((w) => ({
        id: w.id,
        name: w.name,
        url: w.url,
        events: w.events,
        active: w.active,
        lastTriggeredAt: w.lastTriggeredAt?.toISOString() ?? null,
        lastSuccessAt: w.lastSuccessAt?.toISOString() ?? null,
        lastFailureAt: w.lastFailureAt?.toISOString() ?? null,
        failureCount: w.failureCount,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      }));
    }
  );

  // Create webhook
  app.post(
    "/webhooks",
    { preHandler: requirePermission("webhook:create") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const bodySchema = z.object({
        name: z.string().min(1).max(200),
        url: z.string().url(),
        events: z.array(z.enum([
          "intent.created",
          "intent.updated",
          "intent.approved",
          "intent.denied",
          "intent.executed",
          "intent.canceled",
          "challenge.created",
          "proof.submitted",
          "decision.made",
          "beneficiary.created",
          "beneficiary.updated",
          "beneficiary.locked",
        ])).min(1),
      });
      
      const body = bodySchema.parse(req.body);
      
      let webhook: any;
      let secret: string;
      try {
        const res = await createWebhook({
          orgId: req.user.orgId,
          userId: req.user.id,
          name: body.name,
          url: body.url,
          events: body.events as WebhookEventType[],
        });
        webhook = res.webhook;
        secret = res.secret;
      } catch (e: any) {
        if (e?.code === "WEBHOOK_SIGNING_CONFIG_MISSING") {
          return reply.code(500).send({
            error: e.message || "Webhook signing misconfigured",
            code: "WEBHOOK_SIGNING_CONFIG_MISSING",
          });
        }
        if (e?.code === "UNSAFE_OUTBOUND_URL") {
          return reply.code(400).send({
            error: e.message || "Unsafe webhook target URL",
            code: "UNSAFE_OUTBOUND_URL",
          });
        }
        throw e;
      }
      
      reply.code(201);
      await emitOrgAuditEvent({
        req,
        eventType: "webhook.created",
        subject: { type: "webhook", id: webhook.id },
        payload: {
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          active: webhook.active,
        },
      });
      return {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        secret, // Only returned once on creation
        active: webhook.active,
        createdAt: webhook.createdAt.toISOString(),
      };
    }
  );

  // Update webhook
  app.patch(
    "/webhooks/:id",
    { preHandler: requirePermission("webhook:edit") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const webhookId = (req.params as any).id;
      const bodySchema = z.object({
        name: z.string().min(1).max(200).optional(),
        url: z.string().url().optional(),
        events: z.array(z.string()).optional(),
        active: z.boolean().optional(),
      });
      
      const body = bodySchema.parse(req.body);
      
      let webhook: any;
      try {
        webhook = await updateWebhook({
          orgId: req.user.orgId,
          webhookId,
          name: body.name,
          url: body.url,
          events: body.events as WebhookEventType[] | undefined,
          active: body.active,
        });
      } catch (e: any) {
        if (e?.code === "UNSAFE_OUTBOUND_URL") {
          return reply.code(400).send({
            error: e.message || "Unsafe webhook target URL",
            code: "UNSAFE_OUTBOUND_URL",
          });
        }
        throw e;
      }
      
      if (!webhook) {
        return reply.code(404).send({ error: "Webhook not found" });
      }

      await emitOrgAuditEvent({
        req,
        eventType: "webhook.updated",
        subject: { type: "webhook", id: webhookId },
        payload: {
          name: body.name ?? undefined,
          url: body.url ?? undefined,
          events: body.events ?? undefined,
          active: typeof body.active === "boolean" ? body.active : undefined,
        },
      });
      
      return {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active,
        updatedAt: webhook.updatedAt.toISOString(),
      };
    }
  );

  // Delete webhook
  app.delete(
    "/webhooks/:id",
    { preHandler: requirePermission("webhook:delete") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const webhookId = (req.params as any).id;
      const success = await deleteWebhook(req.user.orgId, webhookId);
      
      if (!success) {
        return reply.code(404).send({ error: "Webhook not found" });
      }

      await emitOrgAuditEvent({
        req,
        eventType: "webhook.deleted",
        subject: { type: "webhook", id: webhookId },
        payload: {},
      });
      
      return { success: true };
    }
  );

  // List webhook deliveries (delivery logs)
  app.get(
    "/webhooks/:id/deliveries",
    { preHandler: requirePermission("webhook:view") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }

      const webhookId = (req.params as any).id;
      const limit = typeof (req.query as any)?.limit === "string" ? Number((req.query as any).limit) : undefined;

      const deliveries = await listWebhookDeliveries({
        orgId: req.user.orgId,
        webhookId,
        limit: Number.isFinite(limit as number) ? (limit as number) : undefined,
      });

      if (!deliveries) {
        return reply.code(404).send({ error: "Webhook not found" });
      }

      return deliveries.map((d) => ({
        id: d.id,
        eventType: d.eventType,
        eventId: d.eventId,
        status: d.status,
        statusCode: d.statusCode,
        responseBody: d.responseBody,
        attemptNumber: d.attemptNumber,
        nextRetryAt: d.nextRetryAt?.toISOString() ?? null,
        deliveredAt: d.deliveredAt?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
      }));
    }
  );

  // Rotate webhook secret (returns the secret once)
  app.post(
    "/webhooks/:id/rotate-secret",
    { preHandler: requirePermission("webhook:edit") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }

      const webhookId = (req.params as any).id;
      let rotated: { secret: string } | null;
      try {
        rotated = await rotateWebhookSecret({ orgId: req.user.orgId, webhookId });
      } catch (e: any) {
        if (e?.code === "WEBHOOK_SIGNING_CONFIG_MISSING") {
          return reply.code(500).send({
            error: e.message || "Webhook signing misconfigured",
            code: "WEBHOOK_SIGNING_CONFIG_MISSING",
          });
        }
        throw e;
      }
      if (!rotated) {
        return reply.code(404).send({ error: "Webhook not found" });
      }

      await emitOrgAuditEvent({
        req,
        eventType: "webhook.secret_rotated",
        subject: { type: "webhook", id: webhookId },
        payload: {},
      });

      return { secret: rotated.secret };
    }
  );

  // Send a test event to the webhook target
  app.post(
    "/webhooks/:id/test",
    { preHandler: requirePermission("webhook:edit") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }

      const webhookId = (req.params as any).id;
      const res = await sendTestWebhook({ orgId: req.user.orgId, webhookId });
      if (!res) {
        return reply.code(404).send({ error: "Webhook not found" });
      }

      await emitOrgAuditEvent({
        req,
        eventType: "webhook.test_sent",
        subject: { type: "webhook", id: webhookId },
        payload: { deliveryId: res.deliveryId },
      });

      reply.code(202);
      return { success: true, deliveryId: res.deliveryId };
    }
  );
};
