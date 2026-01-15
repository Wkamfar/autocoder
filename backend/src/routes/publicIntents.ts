/**
 * Public Intent Routes
 *
 * Enables "use WIRE without login":
 * - Anyone can create a PublicIntent (no auth)
 * - A logged-in user can claim it into their org (auth)
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db/prisma.js";
import { sha256Hex } from "../lib/sha256.js";
import { requirePermission } from "../modules/security/auth.js";
import { createBeneficiary } from "../modules/beneficiaries/beneficiaryService.js";
import { createIntent } from "../modules/intents/intentService.js";

function normalizeDomain(input: string): string {
  return input.trim().toUpperCase();
}

export const publicIntentRoutes: FastifyPluginAsync = async (app) => {
  // Create a public intent (no auth)
  app.post("/public/intents", async (req, reply) => {
    const bodySchema = z.object({
      railsType: z.enum(["ACH", "WIRE"]),
      amountMinor: z.string().regex(/^\d+$/),
      currency: z.string().length(3).default("USD"),
      purpose: z.string().min(1).max(500),
      beneficiary: z.object({
        displayName: z.string().min(1).max(200),
        country: z.string().min(2).max(2),
        bankLast4: z.string().min(4).max(4),
        // This is NOT raw account/routing info; it is any opaque token the caller provides.
        // We hash it before storing.
        bankToken: z.string().min(8).max(500),
      }),
      requestor: z
        .object({
          email: z.string().email().optional(),
          name: z.string().min(1).max(200).optional(),
        })
        .optional(),
      expiresInMinutes: z.number().int().min(5).max(60 * 24 * 7).optional(), // up to 7 days
    });

    const body = bodySchema.parse(req.body);

    const id = `pubi_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
    const claimToken = crypto.randomBytes(32).toString("hex");
    const claimTokenHash = sha256Hex(claimToken);
    const expiresInMinutes = body.expiresInMinutes ?? 60 * 24; // default 24h
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    const record = await prisma.publicIntent.create({
      data: {
        id,
        claimTokenHash,
        expiresAt,
        railsType: body.railsType,
        amountMinor: body.amountMinor,
        currency: normalizeDomain(body.currency),
        purpose: body.purpose,
        beneficiaryDisplayName: body.beneficiary.displayName,
        beneficiaryCountry: body.beneficiary.country.toUpperCase(),
        beneficiaryBankLast4: body.beneficiary.bankLast4,
        beneficiaryTokenHash: sha256Hex(body.beneficiary.bankToken),
        requestorEmail: body.requestor?.email ?? null,
        requestorName: body.requestor?.name ?? null,
      },
    });

    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3001";
    const claimUrl = `${baseUrl.replace(/\/$/, "")}/v2/public/intents/${record.id}?claim=${claimToken}`;

    reply.code(201);
    return {
      id: record.id,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
      claimToken, // one-time reveal
      claimUrl,
    };
  });

  // Get a public intent (no auth, safe fields only)
  app.get("/public/intents/:id", async (req, reply) => {
    const id = (req.params as any).id as string;
    const record = await prisma.publicIntent.findUnique({ where: { id } });
    if (!record) return reply.code(404).send({ error: "Public intent not found" });

    return {
      id: record.id,
      status: record.status,
      railsType: record.railsType,
      amountMinor: record.amountMinor,
      currency: record.currency,
      purpose: record.purpose,
      beneficiary: {
        displayName: record.beneficiaryDisplayName,
        country: record.beneficiaryCountry,
        bankLast4: record.beneficiaryBankLast4,
      },
      requestor: {
        email: record.requestorEmail,
        name: record.requestorName,
      },
      createdAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
      claimedAt: record.claimedAt?.toISOString() ?? null,
      linkedIntentId: record.linkedIntentId ?? null,
    };
  });
};

export const publicIntentProtectedRoutes: FastifyPluginAsync = async (app) => {
  // Claim a public intent into the caller's org
  app.post(
    "/public-intents/:id/claim",
    { preHandler: requirePermission("intent:create") },
    async (req, reply) => {
      if (!req.user) return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });

      const id = (req.params as any).id as string;
      const bodySchema = z.object({
        claimToken: z.string().min(16),
      });
      const body = bodySchema.parse(req.body);

      const record = await prisma.publicIntent.findUnique({ where: { id } });
      if (!record) return reply.code(404).send({ error: "Public intent not found" });

      if (record.status !== "PENDING") {
        return reply.code(409).send({ error: "Public intent is not claimable" });
      }

      if (record.expiresAt.getTime() < Date.now()) {
        await prisma.publicIntent.update({
          where: { id },
          data: { status: "EXPIRED" },
        });
        return reply.code(410).send({ error: "Public intent has expired" });
      }

      const tokenHash = sha256Hex(body.claimToken);
      if (tokenHash !== record.claimTokenHash) {
        return reply.code(403).send({ error: "Invalid claim token" });
      }

      // Create (or reuse) a beneficiary inside org
      const beneficiaryId = `ben_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
      const { beneficiary } = await createBeneficiary({
        orgId: req.user.orgId,
        userId: req.user.id,
        displayName: record.beneficiaryDisplayName,
        country: record.beneficiaryCountry,
        railsAllowed: [record.railsType],
        bankLast4: record.beneficiaryBankLast4,
        bankTokenHash: record.beneficiaryTokenHash,
      });

      const { intent } = await createIntent({
        orgId: req.user.orgId,
        userId: req.user.id,
        railsType: record.railsType,
        amountMinor: record.amountMinor,
        currency: record.currency,
        beneficiaryId: beneficiary.id || beneficiaryId,
        purpose: record.purpose,
      });

      await prisma.publicIntent.update({
        where: { id },
        data: {
          status: "CLAIMED",
          claimedAt: new Date(),
          claimedByUserId: req.user.id,
          claimedToOrgId: req.user.orgId,
          linkedIntentId: intent.id,
        },
      });

      reply.code(201);
      return {
        success: true,
        linkedIntentId: intent.id,
        message: "Public intent claimed successfully",
      };
    }
  );
};

