/**
 * Agent 6: Org-level audit event chain routes (non-intent sensitive domains)
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePermission } from "../modules/security/auth.js";
import { listOrgAuditEvents, verifyOrgAuditChain } from "../modules/evidence/orgEventChain.js";

export const auditEventRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission("audit:read"));

  app.get("/audit/events", async (req) => {
    const querySchema = z.object({
      days: z.string().optional(),
      limit: z.string().optional(),
    });
    const q = querySchema.parse(req.query ?? {});
    const days = Math.min(Math.max(parseInt(q.days || "180", 10) || 180, 1), 365);
    const limit = Math.min(Math.max(parseInt(q.limit || "500", 10) || 500, 1), 2000);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await listOrgAuditEvents({ orgId: req.user!.orgId, since, limit });
    return rows.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      seq: r.seq,
      eventType: r.eventType,
      payloadCanonicalJson: r.payloadCanonicalJson,
      prevHash: r.prevHash,
      eventHash: r.eventHash,
      correlationId: r.correlationId ?? null,
      requestId: r.requestId ?? null,
      actorUserId: r.actorUserId ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  });

  app.get("/audit/events/verify", async (req) => {
    const result = await verifyOrgAuditChain(req.user!.orgId);
    return result;
  });
};

