/**
 * Agent 4: Legal Entities + Accounts (Org → LegalEntity → FinancialAccount)
 *
 * Minimal CRUD to establish the hierarchy and keep all reads/writes org-scoped.
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db/prisma.js";
import { requirePermission } from "../modules/security/auth.js";

export const legalEntityRoutes: FastifyPluginAsync = async (app) => {
  // List legal entities for current org
  app.get("/legal-entities", async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    const orgId = req.user.orgId;
    const entities = await prisma.legalEntity.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    });
    return entities.map((e) => ({
      id: e.id,
      name: e.name,
      country: e.country,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));
  });

  // Create legal entity
  app.post(
    "/legal-entities",
    { preHandler: requirePermission("org:edit") },
    async (req, reply) => {
      const bodySchema = z.object({
        name: z.string().min(1).max(200),
        country: z.string().min(2).max(2).optional(),
      });
      const body = bodySchema.parse(req.body);
      const orgId = req.user!.orgId;
      const id = `le_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
      const entity = await prisma.legalEntity.create({
        data: {
          id,
          orgId,
          name: body.name,
          country: body.country ?? null,
        },
      });
      reply.code(201);
      return { id: entity.id, name: entity.name };
    }
  );

  // List accounts for a legal entity (org-scoped)
  app.get("/legal-entities/:id/accounts", async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    const orgId = req.user.orgId;
    const legalEntityId = (req.params as any).id as string;

    // Guardrail: confirm entity belongs to org (do not leak other org's entities)
    const entity = await prisma.legalEntity.findFirst({
      where: { id: legalEntityId, orgId },
    });
    if (!entity) return reply.code(404).send({ error: "Legal entity not found" });

    const accounts = await prisma.financialAccount.findMany({
      where: { orgId, legalEntityId },
      orderBy: { createdAt: "desc" },
    });
    return accounts.map((a) => ({
      id: a.id,
      name: a.name,
      currency: a.currency,
      legalEntityId: a.legalEntityId,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  });

  // Create account under legal entity
  app.post(
    "/legal-entities/:id/accounts",
    { preHandler: requirePermission("org:edit") },
    async (req, reply) => {
      const bodySchema = z.object({
        name: z.string().min(1).max(200),
        currency: z.string().length(3).default("USD"),
      });
      const body = bodySchema.parse(req.body);
      const orgId = req.user!.orgId;
      const legalEntityId = (req.params as any).id as string;

      // Guardrail: ensure entity exists in this org before creating
      const entity = await prisma.legalEntity.findFirst({
        where: { id: legalEntityId, orgId },
      });
      if (!entity) return reply.code(404).send({ error: "Legal entity not found" });

      const id = `acct_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
      const account = await prisma.financialAccount.create({
        data: {
          id,
          orgId,
          legalEntityId,
          name: body.name,
          currency: body.currency,
        },
      });
      reply.code(201);
      return { id: account.id, name: account.name };
    }
  );
};

