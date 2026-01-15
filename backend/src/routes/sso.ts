/**
 * Org-level SSO configuration (OIDC enforcement)
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db/prisma.js";
import { requireRole } from "../modules/security/auth.js";

function normalizeEmailDomain(d: string): string {
  return d.trim().toLowerCase().replace(/^\./, "");
}

export const ssoRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireRole("ADMIN"));

  app.get("/sso", async (req) => {
    const cfg = await prisma.orgSsoConfig.findUnique({ where: { orgId: req.user!.orgId } });
    return (
      cfg || {
        id: null,
        orgId: req.user!.orgId,
        enforced: false,
        allowedEmailDomains: [],
        createdAt: null,
        updatedAt: null,
      }
    );
  });

  app.put("/sso", async (req) => {
    const bodySchema = z.object({
      enforced: z.boolean(),
      allowedEmailDomains: z.array(z.string()).default([]),
    });
    const body = bodySchema.parse(req.body);
    const orgId = req.user!.orgId;
    const allowed = Array.from(
      new Set(body.allowedEmailDomains.map(normalizeEmailDomain).filter(Boolean))
    );

    const existing = await prisma.orgSsoConfig.findUnique({ where: { orgId } });
    if (!existing) {
      return prisma.orgSsoConfig.create({
        data: {
          id: `sso_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
          orgId,
          enforced: body.enforced,
          allowedEmailDomains: allowed,
        },
      });
    }
    return prisma.orgSsoConfig.update({
      where: { orgId },
      data: { enforced: body.enforced, allowedEmailDomains: allowed },
    });
  });
};

