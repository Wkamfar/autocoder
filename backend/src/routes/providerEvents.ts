/**
 * Agent 7: Provider event ingestion + processing routes (scaffold)
 *
 * These endpoints are primarily for internal testing and ops tooling.
 * Real provider webhooks should be implemented with dedicated signature verification per provider.
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePermission } from "../modules/security/auth.js";
import { ingestProviderEvent, processUnprocessedProviderEvents } from "../modules/payments/providerEvents.js";
import { redactPlaidVerificationHeader, verifyPlaidWebhookOrThrow } from "../modules/providers/plaid/webhookVerification.js";
import { sha256Hex } from "../lib/sha256.js";

export const providerEventRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/provider-events",
    { preHandler: requirePermission("bank:admin") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }

      const bodySchema = z.object({
        provider: z.string().min(1).max(50).default("mock"),
        providerEventType: z.string().min(1).max(200),
        providerEventId: z.string().min(1).max(200).optional(),
        intentId: z.string().min(1).optional(),
        executionRef: z.string().min(1).optional(),
        rawPayload: z.record(z.any()).default({}),
      });
      const body = bodySchema.parse(req.body ?? {});

      const res = await ingestProviderEvent({
        provider: body.provider,
        providerEventType: body.providerEventType,
        providerEventId: body.providerEventId ?? null,
        orgId: req.user.orgId,
        intentId: body.intentId ?? null,
        executionRef: body.executionRef ?? null,
        rawPayload: body.rawPayload,
      });

      reply.code(res.created ? 201 : 200);
      return res;
    }
  );

  // Ops endpoint: process unprocessed provider events (reconciliation scaffold)
  app.post(
    "/provider-events/process",
    { preHandler: requirePermission("bank:admin") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      const bodySchema = z.object({
        limit: z.number().int().min(1).max(500).default(100),
      });
      const body = bodySchema.parse(req.body ?? {});
      return await processUnprocessedProviderEvents(body.limit);
    }
  );

  /**
   * Plaid Transfer webhook ingestion (bank-grade)
   *
   * - Verified using Plaid's `Plaid-Verification` JWT (ES256) + /webhook_verification_key/get.
   * - Validates `iat` within tolerance and matches `request_body_sha256` against the *raw* request body.
   *
   * IMPORTANT: This endpoint is public (no user auth). Authenticity comes from signature verification.
   */
  app.post(
    "/provider-webhooks/plaid/transfer/:orgId",
    {
      // Capture raw body before parsing so we can validate request_body_sha256.
      preParsing: async (req, reply, payload) => {
        const chunks: Buffer[] = [];
        for await (const c of payload) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c)));
        const rawBody = Buffer.concat(chunks).toString("utf8");
        (req as any).rawBody = rawBody;
        // Let Fastify parse JSON normally from the same raw bytes.
        return rawBody;
      },
    },
    async (req, reply) => {
      const orgId = (req.params as any)?.orgId as string | undefined;
      if (!orgId) return reply.code(400).send({ error: "Missing orgId", code: "BAD_REQUEST" });

      const rawBody = (req as any).rawBody as string | undefined;
      if (typeof rawBody !== "string") {
        return reply.code(400).send({ error: "Missing raw body", code: "BAD_REQUEST" });
      }

      const plaidVerificationJwt =
        (req.headers as any)["plaid-verification"] ??
        (req.headers as any)["Plaid-Verification"] ??
        (req.headers as any)["PLAID-VERIFICATION"];

      if (!plaidVerificationJwt || typeof plaidVerificationJwt !== "string") {
        return reply.code(401).send({ error: "Missing Plaid-Verification header", code: "PLAID_WEBHOOK_UNVERIFIED" });
      }

      // Strict body schema for Transfer webhook envelopes.
      const bodySchema = z.object({
        webhook_type: z.literal("TRANSFER"),
        webhook_code: z.enum(["TRANSFER_EVENTS_UPDATE", "RECURRING_TRANSFER_SKIPPED"]),
        environment: z.enum(["sandbox", "production", "development"]).optional(),
      });

      let parsedBody: unknown = req.body;
      // If Fastify didn't parse (or parsing failed upstream), fall back to JSON.parse.
      if (typeof parsedBody === "string") {
        try {
          parsedBody = JSON.parse(parsedBody);
        } catch {
          return reply.code(400).send({ error: "Invalid JSON", code: "BAD_REQUEST" });
        }
      }

      const body = bodySchema.parse(parsedBody ?? {});

      const env =
        (process.env.PLAID_ENV as any) ??
        (body.environment as any) ??
        ("sandbox" as const);

      try {
        await verifyPlaidWebhookOrThrow({
          env,
          plaidVerificationJwt,
          rawBody,
        });
      } catch (err: any) {
        // Fail closed, but return minimal details.
        return reply.code(401).send({
          error: "Plaid webhook verification failed",
          code: "PLAID_WEBHOOK_UNVERIFIED",
          verification: redactPlaidVerificationHeader(plaidVerificationJwt),
        });
      }

      const providerEventType = `plaid.${body.webhook_type}.${body.webhook_code}`;
      const providerEventId = `plaid:${body.webhook_code}:${sha256Hex(rawBody).slice(0, 24)}`;

      const res = await ingestProviderEvent({
        provider: "plaid",
        providerEventType,
        providerEventId,
        orgId,
        intentId: null,
        executionRef: null,
        rawPayload: parsedBody as any,
      });

      reply.code(res.created ? 201 : 200);
      return res;
    }
  );
};

