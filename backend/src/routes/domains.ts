/**
 * Custom Domain + Email Domain Routes (Org Settings)
 *
 * Stripe-parity primitives:
 * - Add a domain
 * - Show DNS records to set
 * - Verify via DNS lookup
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db/prisma.js";
import { requireRole } from "../modules/security/auth.js";
import { resolveTxt } from "dns/promises";

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

async function hasTxtRecord(name: string, expected: string): Promise<boolean> {
  try {
    const rows = await resolveTxt(name);
    const flat = rows.map((r) => r.join("")).join("\n");
    return flat.includes(expected);
  } catch {
    return false;
  }
}

function extractDkimPublicKeyBase64FromPem(pem: string): string {
  // PEM -> base64 body
  return pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
}

export const domainRoutes: FastifyPluginAsync = async (app) => {
  // All domain settings require ADMIN
  app.addHook("preHandler", requireRole("ADMIN"));

  // -------------------------
  // Custom domains
  // -------------------------
  app.get("/domains/custom", async (req) => {
    const domains = await prisma.customDomain.findMany({
      where: { orgId: req.user!.orgId },
      orderBy: { createdAt: "desc" },
    });
    return domains.map((d) => ({
      id: d.id,
      domain: d.domain,
      status: d.status,
      verification: {
        type: "TXT",
        name: `_wire.${d.domain}`,
        value: `wire-domain-verification=${d.verificationToken}`,
      },
      verifiedAt: d.verifiedAt?.toISOString() ?? null,
      lastCheckedAt: d.lastCheckedAt?.toISOString() ?? null,
      lastError: d.lastError ?? null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  });

  app.post("/domains/custom", async (req, reply) => {
    const bodySchema = z.object({ domain: z.string().min(3).max(253) });
    const body = bodySchema.parse(req.body);
    const domain = normalizeDomain(body.domain);
    const token = crypto.randomBytes(16).toString("hex");

    const created = await prisma.customDomain.create({
      data: {
        id: `cd_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
        orgId: req.user!.orgId,
        domain,
        verificationToken: token,
        status: "PENDING",
      },
    });

    reply.code(201);
    return { id: created.id, domain: created.domain, status: created.status };
  });

  app.post("/domains/custom/:id/verify", async (req) => {
    const id = (req.params as any).id as string;
    const domain = await prisma.customDomain.findUnique({ where: { id } });
    if (!domain || domain.orgId !== req.user!.orgId) return { ok: false, error: "Not found" };

    const txtName = `_wire.${domain.domain}`;
    const expected = `wire-domain-verification=${domain.verificationToken}`;
    const ok = await hasTxtRecord(txtName, expected);

    const updated = await prisma.customDomain.update({
      where: { id },
      data: {
        lastCheckedAt: new Date(),
        status: ok ? "VERIFIED" : "PENDING",
        verifiedAt: ok ? new Date() : null,
        lastError: ok ? null : `TXT record not found at ${txtName}`,
      },
    });

    return { ok, status: updated.status };
  });

  app.delete("/domains/custom/:id", async (req) => {
    const id = (req.params as any).id as string;
    const domain = await prisma.customDomain.findUnique({ where: { id } });
    if (!domain || domain.orgId !== req.user!.orgId) return { success: false };
    await prisma.customDomain.delete({ where: { id } });
    return { success: true };
  });

  // -------------------------
  // Email domains
  // -------------------------
  app.get("/domains/email", async (req) => {
    const domains = await prisma.emailDomain.findMany({
      where: { orgId: req.user!.orgId },
      orderBy: { createdAt: "desc" },
    });
    return domains.map((d) => ({
      id: d.id,
      domain: d.domain,
      status: d.status,
      records: {
        spf: { type: "TXT", name: d.domain, value: d.spfExpectedTxt },
        dkim: {
          type: "TXT",
          name: `${d.dkimSelector}._domainkey.${d.domain}`,
          value: `v=DKIM1; k=rsa; p=${extractDkimPublicKeyBase64FromPem(d.dkimPublicKeyPem)}`,
        },
        dmarc: { type: "TXT", name: `_dmarc.${d.domain}`, value: d.dmarcExpectedTxt },
      },
      verifiedAt: d.verifiedAt?.toISOString() ?? null,
      lastCheckedAt: d.lastCheckedAt?.toISOString() ?? null,
      lastError: d.lastError ?? null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  });

  app.post("/domains/email", async (req, reply) => {
    const bodySchema = z.object({ domain: z.string().min(3).max(253) });
    const body = bodySchema.parse(req.body);
    const domain = normalizeDomain(body.domain);

    // Generate DKIM keys (RSA 2048) for now.
    // In production you might prefer managed providers (SES/SendGrid) + per-org selectors.
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const selector = `wire${crypto.randomBytes(4).toString("hex")}`;

    const spfExpected = "v=spf1 include:wire.pose.xyz -all";
    const dmarcExpected = `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`;

    const created = await prisma.emailDomain.create({
      data: {
        id: `ed_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
        orgId: req.user!.orgId,
        domain,
        status: "PENDING",
        spfExpectedTxt: spfExpected,
        dkimSelector: selector,
        dkimPublicKeyPem: publicKey,
        dkimPrivateKeyPem: privateKey,
        dmarcExpectedTxt: dmarcExpected,
      },
    });

    reply.code(201);
    return { id: created.id, domain: created.domain, status: created.status };
  });

  app.post("/domains/email/:id/verify", async (req) => {
    const id = (req.params as any).id as string;
    const d = await prisma.emailDomain.findUnique({ where: { id } });
    if (!d || d.orgId !== req.user!.orgId) return { ok: false, error: "Not found" };

    const spfOk = await hasTxtRecord(d.domain, d.spfExpectedTxt);
    const dkimName = `${d.dkimSelector}._domainkey.${d.domain}`;
    const dkimExpected = `p=${extractDkimPublicKeyBase64FromPem(d.dkimPublicKeyPem)}`;
    const dkimOk = await hasTxtRecord(dkimName, dkimExpected);
    const dmarcName = `_dmarc.${d.domain}`;
    const dmarcOk = await hasTxtRecord(dmarcName, d.dmarcExpectedTxt);

    const ok = spfOk && dkimOk && dmarcOk;
    const lastError = ok
      ? null
      : `Missing DNS: ${[
          !spfOk ? "SPF" : null,
          !dkimOk ? "DKIM" : null,
          !dmarcOk ? "DMARC" : null,
        ]
          .filter(Boolean)
          .join(", ")}`;

    const updated = await prisma.emailDomain.update({
      where: { id },
      data: {
        lastCheckedAt: new Date(),
        status: ok ? "VERIFIED" : "PENDING",
        verifiedAt: ok ? new Date() : null,
        lastError,
      },
    });

    return { ok, status: updated.status, spfOk, dkimOk, dmarcOk };
  });

  app.delete("/domains/email/:id", async (req) => {
    const id = (req.params as any).id as string;
    const domain = await prisma.emailDomain.findUnique({ where: { id } });
    if (!domain || domain.orgId !== req.user!.orgId) return { success: false };
    await prisma.emailDomain.delete({ where: { id } });
    return { success: true };
  });
};

