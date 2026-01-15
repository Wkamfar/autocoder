/**
 * Security History (Audit Log) Routes
 *
 * Stripe-style: show account activity events (last 180 days).
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireRole } from "../modules/security/auth.js";

export const securityHistoryRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireRole("ADMIN", "AUDITOR"));

  app.get("/security-history", async (req) => {
    const querySchema = z.object({
      days: z.string().optional(),
      limit: z.string().optional(),
    });
    const q = querySchema.parse(req.query ?? {});
    const days = Math.min(Math.max(parseInt(q.days || "180", 10) || 180, 1), 365);
    const limit = Math.min(Math.max(parseInt(q.limit || "200", 10) || 200, 1), 1000);

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.authAuditLog.findMany({
      where: {
        orgId: req.user!.orgId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      orgId: r.orgId,
      eventType: r.eventType,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      sessionId: r.sessionId,
      detailsJson: r.detailsJson,
      createdAt: r.createdAt.toISOString(),
    }));
  });
};

