import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireRole } from "../modules/security/auth.js";
import { toCsv } from "../lib/csv.js";
import { makeSimplePdf } from "../lib/pdf/simplePdf.js";
import { verifyEd25519 } from "../lib/signing.js";
import { getSigningKey } from "../lib/keyManagement.js";
import { getStorage } from "../lib/storage/index.js";

export const complianceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireRole("ADMIN", "AUDITOR"));

  app.get("/compliance/summary", async (req) => {
    const querySchema = z.object({ days: z.string().optional() });
    const q = querySchema.parse(req.query ?? {});
    const days = Math.min(Math.max(parseInt(q.days || "30", 10) || 30, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const orgId = req.user!.orgId;

    const [authEvents, intentEvents, decisions, bundles, downloads] = await Promise.all([
      prisma.authAuditLog.count({ where: { orgId, createdAt: { gte: since } } }),
      prisma.intentEvent.count({ where: { intent: { orgId }, createdAt: { gte: since } } }),
      prisma.decision.count({ where: { intent: { orgId }, createdAt: { gte: since } } }),
      prisma.auditBundle.count({ where: { intent: { orgId }, createdAt: { gte: since } } }),
      (prisma as any).evidenceDownload?.count?.({ where: { orgId, createdAt: { gte: since } } }) ?? 0,
    ]);

    const totalActions = authEvents + intentEvents + decisions + downloads;
    const signedActions = decisions + bundles; // decisions + bundle manifests are signed

    return {
      rangeDays: days,
      totalActions,
      signedActions,
      unsignedActions: Math.max(totalActions - signedActions, 0),
      reportsGenerated: 0, // placeholder until we persist report runs
      breakdown: { authEvents, intentEvents, decisions, bundles, downloads },
    };
  });

  app.get("/compliance/retention", async (req) => {
    const orgId = req.user!.orgId;
    const policy = await (prisma as any).complianceRetentionPolicy?.findUnique?.({ where: { orgId } });
    return (
      policy ?? {
        orgId,
        authAuditRetentionDays: 180,
        evidenceBundleRetentionDays: 365,
        wormEnabled: false,
      }
    );
  });

  app.put("/compliance/retention", async (req) => {
    const orgId = req.user!.orgId;
    const bodySchema = z.object({
      authAuditRetentionDays: z.number().int().min(1).max(3650).optional(),
      evidenceBundleRetentionDays: z.number().int().min(1).max(3650).optional(),
      wormEnabled: z.boolean().optional(),
    });
    const body = bodySchema.parse(req.body ?? {});

    const updated = await (prisma as any).complianceRetentionPolicy.upsert({
      where: { orgId },
      update: {
        authAuditRetentionDays: body.authAuditRetentionDays,
        evidenceBundleRetentionDays: body.evidenceBundleRetentionDays,
        wormEnabled: body.wormEnabled,
      },
      create: {
        id: `ret_${orgId}`,
        orgId,
        authAuditRetentionDays: body.authAuditRetentionDays ?? 180,
        evidenceBundleRetentionDays: body.evidenceBundleRetentionDays ?? 365,
        wormEnabled: body.wormEnabled ?? false,
      },
    });

    return updated;
  });

  app.get("/compliance/legal-holds", async (req) => {
    const orgId = req.user!.orgId;
    const rows = await (prisma as any).legalHold.findMany({
      where: { orgId, releasedAt: null },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return rows.map((r: any) => ({
      id: r.id,
      orgId: r.orgId,
      intentId: r.intentId ?? null,
      bundleId: r.bundleId ?? null,
      reason: r.reason,
      createdByUserId: r.createdByUserId,
      createdAt: r.createdAt.toISOString(),
      releasedAt: r.releasedAt ? r.releasedAt.toISOString() : null,
      releasedByUserId: r.releasedByUserId ?? null,
    }));
  });

  app.post("/compliance/legal-holds", async (req, reply) => {
    const orgId = req.user!.orgId;
    const bodySchema = z.object({
      intentId: z.string().min(1).optional(),
      bundleId: z.string().min(1).optional(),
      reason: z.string().min(3).max(500),
    });
    const body = bodySchema.parse(req.body ?? {});
    if (!body.intentId && !body.bundleId) {
      return reply.code(400).send({ error: "Must provide intentId or bundleId" });
    }

    // Tenant guardrails
    if (body.intentId) {
      const intent = await prisma.intent.findFirst({ where: { id: body.intentId, orgId } });
      if (!intent) return reply.code(404).send({ error: "Intent not found" });
    }
    if (body.bundleId) {
      const bundle = await prisma.auditBundle.findFirst({ where: { id: body.bundleId, intent: { orgId } } });
      if (!bundle) return reply.code(404).send({ error: "Bundle not found" });
    }

    const hold = await (prisma as any).legalHold.create({
      data: {
        id: `hold_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        orgId,
        intentId: body.intentId,
        bundleId: body.bundleId,
        reason: body.reason,
        createdByUserId: req.user!.id,
      },
    });

    return {
      id: hold.id,
      orgId: hold.orgId,
      intentId: hold.intentId ?? null,
      bundleId: hold.bundleId ?? null,
      reason: hold.reason,
      createdByUserId: hold.createdByUserId,
      createdAt: hold.createdAt.toISOString(),
    };
  });

  app.post("/compliance/legal-holds/:id/release", async (req, reply) => {
    const orgId = req.user!.orgId;
    const id = (req.params as any).id as string;
    const existing = await (prisma as any).legalHold.findFirst({ where: { id, orgId } });
    if (!existing) return reply.code(404).send({ error: "Legal hold not found" });
    if (existing.releasedAt) return reply.code(409).send({ error: "Legal hold already released" });

    const updated = await (prisma as any).legalHold.update({
      where: { id },
      data: { releasedAt: new Date(), releasedByUserId: req.user!.id },
    });
    return {
      id: updated.id,
      releasedAt: updated.releasedAt!.toISOString(),
      releasedByUserId: updated.releasedByUserId,
    };
  });

  // CSV: Approval history (decisions)
  app.get("/compliance/reports/approval-history.csv", async (req, reply) => {
    const querySchema = z.object({
      days: z.string().optional(),
      limit: z.string().optional(),
      verify: z.string().optional(), // "1" to include signature validity
    });
    const q = querySchema.parse(req.query ?? {});
    const days = Math.min(Math.max(parseInt(q.days || "30", 10) || 30, 1), 365);
    const limit = Math.min(Math.max(parseInt(q.limit || "2000", 10) || 2000, 1), 5000);
    const doVerify = q.verify === "1";
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await prisma.decision.findMany({
      where: { intent: { orgId: req.user!.orgId }, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const out: Array<Record<string, unknown>> = [];
    for (const d of rows) {
      let signatureValid: boolean | null = null;
      if (doVerify) {
        try {
          const key = await getSigningKey(d.signerKeyId);
          signatureValid = verifyEd25519(d.decisionPayloadCanonicalJson, d.signature, key.publicKey);
        } catch {
          signatureValid = false;
        }
      }
      out.push({
        createdAt: d.createdAt.toISOString(),
        intentId: d.intentId,
        decisionType: d.decisionType,
        createdByUserId: d.createdByUserId,
        signerKeyId: d.signerKeyId,
        decisionHash: d.decisionHash,
        signatureValid,
      });
    }

    const csv = toCsv(out, [
      "createdAt",
      "intentId",
      "decisionType",
      "createdByUserId",
      "signerKeyId",
      "decisionHash",
      "signatureValid",
    ]);

    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="approval-history_${days}d.csv"`);
    return reply.send(csv);
  });

  // CSV: Security history (auth audit log)
  app.get("/compliance/reports/security-history.csv", async (req, reply) => {
    const querySchema = z.object({ days: z.string().optional(), limit: z.string().optional() });
    const q = querySchema.parse(req.query ?? {});
    const days = Math.min(Math.max(parseInt(q.days || "180", 10) || 180, 1), 365);
    const limit = Math.min(Math.max(parseInt(q.limit || "5000", 10) || 5000, 1), 10000);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await prisma.authAuditLog.findMany({
      where: { orgId: req.user!.orgId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const csv = toCsv(
      rows.map((r) => ({
        createdAt: r.createdAt.toISOString(),
        eventType: r.eventType,
        userId: r.userId ?? "",
        sessionId: r.sessionId ?? "",
        ipAddress: r.ipAddress ?? "",
        userAgent: r.userAgent ?? "",
        detailsJson: r.detailsJson ?? "",
      })),
      ["createdAt", "eventType", "userId", "sessionId", "ipAddress", "userAgent", "detailsJson"]
    );

    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="security-history_${days}d.csv"`);
    return reply.send(csv);
  });

  // CSV: Org-level audit events (tamper-evident chain for non-intent domains)
  app.get("/compliance/reports/org-audit-events.csv", async (req, reply) => {
    const querySchema = z.object({ days: z.string().optional(), limit: z.string().optional() });
    const q = querySchema.parse(req.query ?? {});
    const days = Math.min(Math.max(parseInt(q.days || "180", 10) || 180, 1), 365);
    const limit = Math.min(Math.max(parseInt(q.limit || "5000", 10) || 5000, 1), 20000);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await (prisma as any).orgAuditEvent.findMany({
      where: { orgId: req.user!.orgId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const csv = toCsv(
      rows.map((r: any) => ({
        createdAt: r.createdAt.toISOString(),
        seq: r.seq,
        eventType: r.eventType,
        actorUserId: r.actorUserId ?? "",
        requestId: r.requestId ?? "",
        correlationId: r.correlationId ?? "",
        prevHash: r.prevHash ?? "",
        eventHash: r.eventHash,
        payloadCanonicalJson: r.payloadCanonicalJson,
      })),
      [
        "createdAt",
        "seq",
        "eventType",
        "actorUserId",
        "requestId",
        "correlationId",
        "prevHash",
        "eventHash",
        "payloadCanonicalJson",
      ]
    );

    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="org-audit-events_${days}d.csv"`);
    return reply.send(csv);
  });

  // PDF: Audit trail summary (period + counts + signed evidence pointers)
  app.get("/compliance/reports/audit-trail.pdf", async (req, reply) => {
    const querySchema = z.object({ days: z.string().optional(), watermark: z.string().optional() });
    const q = querySchema.parse(req.query ?? {});
    const days = Math.min(Math.max(parseInt(q.days || "30", 10) || 30, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const orgId = req.user!.orgId;

    const [authEvents, intentEvents, decisions, bundles, downloads] = await Promise.all([
      prisma.authAuditLog.count({ where: { orgId, createdAt: { gte: since } } }),
      prisma.intentEvent.count({ where: { intent: { orgId }, createdAt: { gte: since } } }),
      prisma.decision.count({ where: { intent: { orgId }, createdAt: { gte: since } } }),
      prisma.auditBundle.count({ where: { intent: { orgId }, createdAt: { gte: since } } }),
      (prisma as any).evidenceDownload?.count?.({ where: { orgId, createdAt: { gte: since } } }) ?? 0,
    ]);

    const title = `WIRE Audit Trail Summary (${days}d)`;
    const lines = [
      `Org: ${orgId}`,
      `Generated at: ${new Date().toISOString()}`,
      `Range start: ${since.toISOString()}`,
      "",
      `Auth events: ${authEvents}`,
      `Intent events (hash-chain): ${intentEvents}`,
      `Decisions (signed): ${decisions}`,
      `Bundles (signed manifests): ${bundles}`,
      `Bundle downloads (audited): ${downloads}`,
      "",
      "Notes:",
      "- Decisions are signed (Ed25519) and verifiable via signerKeyId public keys.",
      "- Bundles include canonical JSON manifests and signatures (Ed25519).",
      "- Intent events are linked via a tamper-evident hash chain (prevHash/eventHash).",
    ];

    const pdf = makeSimplePdf({ title, lines, watermark: q.watermark || "CONFIDENTIAL" });
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="audit-trail_${days}d.pdf"`);
    return reply.send(pdf);
  });

  // Purge workflow (preview + run). Does not run automatically; intended for ops/admin tooling.
  app.get("/compliance/purge/preview", async (req) => {
    const orgId = req.user!.orgId;
    const policy = await (prisma as any).complianceRetentionPolicy?.findUnique?.({ where: { orgId } });
    const retentionDays = policy?.evidenceBundleRetentionDays ?? 365;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const heldBundleIds = await (prisma as any).legalHold.findMany({
      where: { orgId, releasedAt: null, bundleId: { not: null } },
      select: { bundleId: true },
    });
    const heldSet = new Set(heldBundleIds.map((h: any) => h.bundleId!).filter(Boolean));

    const candidates = await (prisma as any).auditBundle.findMany({
      where: { intent: { orgId }, createdAt: { lt: cutoff }, deletedAt: null } as any,
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    const eligible = candidates.filter((b: any) => !heldSet.has(b.id));

    return {
      retentionDays,
      cutoff: cutoff.toISOString(),
      candidates: candidates.length,
      eligible: eligible.length,
      sample: eligible.slice(0, 25).map((b: any) => ({
        id: b.id,
        intentId: b.intentId,
        createdAt: b.createdAt.toISOString(),
        retentionUntil: b.retentionUntil ? b.retentionUntil.toISOString() : null,
      })),
    };
  });

  // NOTE: This is destructive. Keep ADMIN-only.
  app.post("/compliance/purge/run", async (req, reply) => {
    if (req.user!.role !== "ADMIN") {
      return reply.code(403).send({ error: "ADMIN role required" });
    }

    const orgId = req.user!.orgId;
    const bodySchema = z.object({ limit: z.number().int().min(1).max(500).optional() });
    const body = bodySchema.parse(req.body ?? {});
    const limit = body.limit ?? 100;

    const policy = await (prisma as any).complianceRetentionPolicy?.findUnique?.({ where: { orgId } });
    const retentionDays = policy?.evidenceBundleRetentionDays ?? 365;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const held = await (prisma as any).legalHold.findMany({
      where: { orgId, releasedAt: null, bundleId: { not: null } },
      select: { bundleId: true },
    });
    const heldSet = new Set(held.map((h: any) => h.bundleId!).filter(Boolean));

    const candidates = await (prisma as any).auditBundle.findMany({
      where: { intent: { orgId }, createdAt: { lt: cutoff }, deletedAt: null } as any,
      orderBy: { createdAt: "asc" },
      take: limit * 2, // allow filtering out held bundles
    });

    const toDelete = candidates.filter((b: any) => !heldSet.has(b.id)).slice(0, limit);
    const storage = getStorage();

    let deleted = 0;
    for (const b of toDelete) {
      try {
        await storage.delete(b.id);
      } catch (error) {
        app.log.warn({ error, bundleId: b.id }, "Failed to delete bundle from storage (continuing)");
      }
      await prisma.auditBundle.update({
        where: { id: b.id },
        data: { deletedAt: new Date() } as any,
      });
      deleted++;
    }

    return { deleted, requested: limit, retentionDays, cutoff: cutoff.toISOString() };
  });
};

