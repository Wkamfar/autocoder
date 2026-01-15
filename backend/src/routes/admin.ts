/**
 * Admin Dashboard Routes
 * 
 * Metrics and analytics endpoints for admin dashboard
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requirePermission } from "../modules/security/auth.js";
import { generateEmailTemplate, sendEmail } from "../modules/email/emailService.js";
import { createMagicLinkSession } from "../modules/security/session.js";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // Admin dashboard metrics
  app.get(
    "/admin/metrics",
    { preHandler: requirePermission("admin:view") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const orgId = req.user.orgId;
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Total intents
      const totalIntents = await prisma.intent.count({
        where: { orgId },
      });
      
      // Intents by status
      const intentsByStatus = await prisma.intent.groupBy({
        by: ["status"],
        where: { orgId },
        _count: true,
      });
      
      // Intents in last 30 days
      const recentIntents = await prisma.intent.count({
        where: {
          orgId,
          createdAt: { gte: thirtyDaysAgo },
        },
      });
      
      // Intents in last 7 days
      const weeklyIntents = await prisma.intent.count({
        where: {
          orgId,
          createdAt: { gte: sevenDaysAgo },
        },
      });
      
      // Total amount (sum of executed intents)
      const executedIntents = await prisma.intent.findMany({
        where: {
          orgId,
          status: "EXECUTED",
        },
        select: {
          amountMinor: true,
          currency: true,
        },
      });
      
      const totalAmountMinor = executedIntents.reduce((sum, intent) => {
        return sum + BigInt(intent.amountMinor);
      }, 0n);
      
      // Average risk score
      const riskScores = await prisma.intent.findMany({
        where: { orgId },
        select: { riskScore: true },
      });
      
      const avgRiskScore = riskScores.length > 0
        ? riskScores.reduce((sum, i) => sum + i.riskScore, 0) / riskScores.length
        : 0;
      
      // Total users
      const totalUsers = await prisma.user.count({
        where: { orgId },
      });
      
      // Active users (users who created intents in last 30 days)
      const activeUserIds = await prisma.intent.findMany({
        where: {
          orgId,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdByUserId: true },
        distinct: ["createdByUserId"],
      });
      
      const activeUsers = activeUserIds.length;
      
      // Total beneficiaries
      const totalBeneficiaries = await prisma.beneficiary.count({
        where: { orgId },
      });
      
      // Voice proofs
      const totalProofs = await prisma.voiceProof.count({
        where: {
          intent: { orgId },
        },
      });
      
      // Successful proofs (confidence > 0.7)
      // Count successful proofs (scoresJson is stored as string, parse it)
      const allProofs = await prisma.voiceProof.findMany({
        where: {
          intent: { orgId },
        },
        select: { scoresJson: true },
      });
      const successfulProofs = allProofs.filter((proof) => {
        try {
          const scores = JSON.parse(proof.scoresJson);
          return scores.identity_confidence >= 0.7;
        } catch {
          return false;
        }
      }).length;
      
      // Decisions
      const totalDecisions = await prisma.decision.count({
        where: {
          intent: { orgId },
        },
      });
      
      const approvedDecisions = await prisma.decision.count({
        where: {
          intent: { orgId },
          decisionType: "APPROVE",
        },
      });
      
      // Executions
      const totalExecutions = await prisma.executionLedger.count({
        where: {
          intent: { orgId },
        },
      });
      
      // Recent activity (last 7 days)
      const recentActivity = await prisma.intent.findMany({
        where: {
          orgId,
          createdAt: { gte: sevenDaysAgo },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          amountMinor: true,
          currency: true,
          railsType: true,
          createdAt: true,
          createdByUserId: true,
        },
      });
      
      return {
        overview: {
          totalIntents,
          recentIntents,
          weeklyIntents,
          totalAmountMinor: totalAmountMinor.toString(),
          avgRiskScore: Math.round(avgRiskScore * 10) / 10,
          totalUsers,
          activeUsers,
          totalBeneficiaries,
        },
        intentsByStatus: intentsByStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>),
        voiceMetrics: {
          totalProofs,
          successfulProofs,
          successRate: totalProofs > 0 ? Math.round((successfulProofs / totalProofs) * 100) : 0,
        },
        approvalMetrics: {
          totalDecisions,
          approvedDecisions,
          approvalRate: totalDecisions > 0 ? Math.round((approvedDecisions / totalDecisions) * 100) : 0,
        },
        executionMetrics: {
          totalExecutions,
        },
        recentActivity: recentActivity.map((intent) => ({
          id: intent.id,
          status: intent.status,
          amountMinor: intent.amountMinor,
          currency: intent.currency,
          railsType: intent.railsType,
          createdAt: intent.createdAt.toISOString(),
          createdByUserId: intent.createdByUserId,
        })),
        generatedAt: now.toISOString(),
      };
    }
  );

  // Send a test email (diligence / deliverability verification)
  // Requires admin:view to avoid introducing new permissions in the MVP.
  app.post(
    "/admin/test-email",
    { preHandler: requirePermission("admin:view") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }

      const bodySchema = z.object({
        to: z.string().email(),
        name: z.string().min(1).max(200).optional(),
      });
      const body = bodySchema.parse(req.body);

      const baseUrl = (process.env.FRONTEND_URL || "https://wire.pose.xyz").replace(/\/$/, "");
      const loginUrl = `${baseUrl}/v2/login`;
      
      // If the recipient exists, send a true one-time magic link so the click has an obvious outcome.
      const recipientUser = await prisma.user.findFirst({ where: { email: body.to.toLowerCase().trim() } });
      const recipientOrg = recipientUser
        ? await prisma.organization.findUnique({ where: { id: recipientUser.orgId } }).catch(() => null)
        : null;
      
      let magicUrl: string | null = null;
      if (recipientUser) {
        const magic = await createMagicLinkSession({
          userId: recipientUser.id,
          orgId: recipientUser.orgId,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          ttlMs: 15 * 60 * 1000,
        });
        magicUrl = `${baseUrl}/v2/magic?t=${encodeURIComponent(magic.token)}`;
      }
      const tpl = generateEmailTemplate("signup_confirmation", {
        name: body.name || "there",
        confirmationUrl: magicUrl || loginUrl,
        fallbackUrl: loginUrl,
        orgName: recipientOrg?.name || "WIRE",
      });

      const result = await sendEmail({
        to: body.to,
        templateType: "signup_confirmation",
        subject: `[WIRE] Test email`,
        bodyHtml: tpl.bodyHtml,
        bodyText: tpl.bodyText,
        variables: {
          name: body.name || "there",
          confirmationUrl: magicUrl || loginUrl,
          fallbackUrl: loginUrl,
          orgName: recipientOrg?.name || "WIRE",
        },
      });

      if (!result.success) {
        return reply.code(502).send({
          error: "Email delivery failed",
          code: "EMAIL_DELIVERY_FAILED",
          details: result.error || "unknown",
          provider: process.env.EMAIL_PROVIDER || "console",
        });
      }

      return {
        success: true,
        provider: process.env.EMAIL_PROVIDER || "console",
        messageId: result.messageId || null,
        magicLink: magicUrl,
      };
    }
  );

  // Agent 8: Job queue visibility + DLQ replay tooling
  app.get(
    "/admin/jobs",
    { preHandler: requirePermission("admin:view") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }

      const querySchema = z.object({
        status: z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "DEAD"]).optional(),
        type: z.string().min(1).max(200).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      });
      const q = querySchema.parse((req as any).query);
      const limit = q.limit ?? 50;

      const jobs = await prisma.job.findMany({
        where: {
          ...(q.status ? { status: q.status } : {}),
          ...(q.type ? { type: q.type } : {}),
        },
        orderBy: [{ runAt: "asc" }, { createdAt: "desc" }],
        take: limit,
      });

      return jobs.map((j) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        runAt: j.runAt.toISOString(),
        attempts: j.attempts,
        maxAttempts: j.maxAttempts,
        lastError: j.lastError,
        lockedAt: j.lockedAt?.toISOString() ?? null,
        lockedBy: j.lockedBy,
        completedAt: j.completedAt?.toISOString() ?? null,
        createdAt: j.createdAt.toISOString(),
        updatedAt: j.updatedAt.toISOString(),
        uniqueKey: j.uniqueKey,
      }));
    }
  );

  app.post(
    "/admin/jobs/:id/replay",
    { preHandler: requirePermission("admin:view") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }

      const id = (req.params as any).id as string;
      const job = await prisma.job.findUnique({ where: { id } });
      if (!job) return reply.code(404).send({ error: "Job not found", code: "NOT_FOUND" });
      if (job.status !== "DEAD") {
        return reply.code(409).send({ error: "Only DEAD jobs can be replayed", code: "JOB_NOT_DEAD" });
      }

      const updated = await prisma.job.update({
        where: { id },
        data: {
          status: "QUEUED",
          runAt: new Date(),
          attempts: 0,
          lastError: null,
          lockedAt: null,
          lockedBy: null,
          completedAt: null,
        },
      });

      return {
        success: true,
        job: {
          id: updated.id,
          type: updated.type,
          status: updated.status,
          runAt: updated.runAt.toISOString(),
        },
      };
    }
  );
};
