/**
 * API Key Management Routes
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePermission } from "../modules/security/auth.js";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  deleteApiKey,
} from "../modules/apiKeys/apiKeyService.js";
import { emitOrgAuditEvent } from "../modules/audit/auditEvents.js";

export const apiKeyRoutes: FastifyPluginAsync = async (app) => {
  // List API keys
  app.get(
    "/api-keys",
    { preHandler: requirePermission("api:view") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const keys = await listApiKeys(req.user.orgId);
      
      // Don't return full key hashes, just prefixes
      return keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        permissions: k.permissions,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        expiresAt: k.expiresAt?.toISOString() ?? null,
        revokedAt: k.revokedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      }));
    }
  );

  // Create API key
  app.post(
    "/api-keys",
    { preHandler: requirePermission("api:create") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const bodySchema = z.object({
        name: z.string().min(1).max(200),
        permissions: z.array(z.string()).optional(),
        expiresInDays: z.number().int().min(1).max(365).optional(),
      });
      
      const body = bodySchema.parse(req.body);
      
      const { apiKey, secret } = await createApiKey({
        orgId: req.user.orgId,
        userId: req.user.id,
        name: body.name,
        permissions: body.permissions,
        expiresInDays: body.expiresInDays,
      });

      await emitOrgAuditEvent({
        req,
        eventType: "api_key.created",
        subject: { type: "api_key", id: apiKey.id },
        payload: {
          name: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          permissions: apiKey.permissions,
          expiresAt: apiKey.expiresAt?.toISOString?.() ?? null,
        },
      });
      
      reply.code(201);
      return {
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.keyPrefix + "...", // Only show prefix
        secret, // Only returned once on creation
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt?.toISOString() ?? null,
        createdAt: apiKey.createdAt.toISOString(),
      };
    }
  );

  // Revoke API key
  app.post(
    "/api-keys/:id/revoke",
    { preHandler: requirePermission("api:edit") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const apiKeyId = (req.params as any).id;
      const success = await revokeApiKey(req.user.orgId, apiKeyId);
      
      if (!success) {
        return reply.code(404).send({ error: "API key not found" });
      }

      await emitOrgAuditEvent({
        req,
        eventType: "api_key.revoked",
        subject: { type: "api_key", id: apiKeyId },
        payload: {},
      });
      
      return { success: true };
    }
  );

  // Delete API key
  app.delete(
    "/api-keys/:id",
    { preHandler: requirePermission("api:delete") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const apiKeyId = (req.params as any).id;
      const success = await deleteApiKey(req.user.orgId, apiKeyId);
      
      if (!success) {
        return reply.code(404).send({ error: "API key not found" });
      }

      await emitOrgAuditEvent({
        req,
        eventType: "api_key.deleted",
        subject: { type: "api_key", id: apiKeyId },
        payload: {},
      });
      
      return { success: true };
    }
  );
};
