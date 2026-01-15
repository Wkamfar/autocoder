/**
 * Org Groups (Org-of-org / multi-account rollups)
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db/prisma.js";
import { requireRole } from "../modules/security/auth.js";

export const orgGroupRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireRole("ADMIN"));

  // List groups where this org is owner or member
  app.get("/org-groups", async (req) => {
    const orgId = req.user!.orgId;
    const owned = await prisma.orgGroup.findMany({
      where: { ownerOrgId: orgId },
      include: { memberships: true },
      orderBy: { createdAt: "desc" },
    });
    const member = await prisma.orgGroupMembership.findMany({
      where: { orgId },
      include: { group: { include: { memberships: true } } },
      orderBy: { createdAt: "desc" },
    });

    return {
      owned: owned.map((g) => ({
        id: g.id,
        name: g.name,
        ownerOrgId: g.ownerOrgId,
        createdAt: g.createdAt.toISOString(),
        members: g.memberships.map((m) => ({ orgId: m.orgId, role: m.role })),
      })),
      memberOf: member.map((m) => ({
        id: m.group.id,
        name: m.group.name,
        ownerOrgId: m.group.ownerOrgId,
        createdAt: m.group.createdAt.toISOString(),
        yourRole: m.role,
        members: m.group.memberships.map((x) => ({ orgId: x.orgId, role: x.role })),
      })),
    };
  });

  // Create group (owner org becomes OWNER member)
  app.post("/org-groups", async (req, reply) => {
    const bodySchema = z.object({ name: z.string().min(2).max(200) });
    const body = bodySchema.parse(req.body);
    const orgId = req.user!.orgId;
    const id = `og_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;

    const created = await prisma.orgGroup.create({
      data: {
        id,
        ownerOrgId: orgId,
        name: body.name,
        memberships: {
          create: {
            id: `ogm_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
            orgId,
            role: "OWNER",
          },
        },
      },
      include: { memberships: true },
    });

    reply.code(201);
    return { id: created.id, name: created.name };
  });

  // Add member org to group
  app.post("/org-groups/:groupId/members", async (req, reply) => {
    const groupId = (req.params as any).groupId as string;
    const bodySchema = z.object({
      orgId: z.string().min(3).max(200),
      role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
    });
    const body = bodySchema.parse(req.body);

    // Agent 4: tenant guardrail — avoid cross-tenant existence leaks.
    const group = await prisma.orgGroup.findFirst({
      where: { id: groupId, ownerOrgId: req.user!.orgId },
    });
    if (!group) {
      return reply.code(403).send({ error: "Only the owning org can manage members" });
    }

    const member = await prisma.orgGroupMembership.create({
      data: {
        id: `ogm_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
        groupId,
        orgId: body.orgId,
        role: body.role,
      },
    });
    reply.code(201);
    return { id: member.id, groupId: member.groupId, orgId: member.orgId, role: member.role };
  });

  // Remove member
  app.delete("/org-groups/:groupId/members/:orgId", async (req, reply) => {
    const groupId = (req.params as any).groupId as string;
    const orgId = (req.params as any).orgId as string;
    // Agent 4: tenant guardrail — avoid cross-tenant existence leaks.
    const group = await prisma.orgGroup.findFirst({
      where: { id: groupId, ownerOrgId: req.user!.orgId },
    });
    if (!group) {
      return reply.code(403).send({ error: "Only the owning org can manage members" });
    }
    await prisma.orgGroupMembership.delete({
      where: { groupId_orgId: { groupId, orgId } },
    });
    return { success: true };
  });

  // Rollup metrics: count + sum amounts across member orgs
  app.get("/org-groups/:groupId/metrics", async (req, reply) => {
    const groupId = (req.params as any).groupId as string;
    const group = await prisma.orgGroup.findUnique({
      where: { id: groupId },
      include: { memberships: true },
    });
    if (!group) return reply.code(404).send({ error: "Group not found" });

    const orgId = req.user!.orgId;
    const isAllowed =
      group.ownerOrgId === orgId || group.memberships.some((m) => m.orgId === orgId);
    if (!isAllowed) return reply.code(403).send({ error: "Not a member of this group" });

    const memberOrgIds = group.memberships.map((m) => m.orgId);
    const intents = await prisma.intent.findMany({
      where: { orgId: { in: memberOrgIds } },
      select: { amountMinor: true, currency: true, status: true },
    });
    let total = 0n;
    for (const i of intents) {
      try {
        total += BigInt(i.amountMinor);
      } catch {
        // ignore malformed
      }
    }
    const byStatus: Record<string, number> = {};
    for (const i of intents) {
      byStatus[i.status] = (byStatus[i.status] || 0) + 1;
    }

    return {
      groupId,
      memberOrgCount: memberOrgIds.length,
      intentCount: intents.length,
      totalAmountMinor: total.toString(),
      currencyNote: "Totals are raw minor units; multi-currency rollups require normalized FX reporting (not yet implemented).",
      byStatus,
    };
  });
};

