/**
 * Public Routes (No Authentication Required)
 * 
 * Signup, invitation acceptance, etc.
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sendEmail, generateEmailTemplate } from "../modules/email/emailService.js";
import { enqueueEmail } from "../modules/email/emailJobs.js";
import { prisma } from "../db/prisma.js";
import crypto from "crypto";
import { createMagicLinkSession } from "../modules/security/session.js";
import { sha256Hex } from "../lib/sha256.js";
import { canonicalJsonStringify } from "../lib/canonicalJson.js";

export const publicRoutes: FastifyPluginAsync = async (app) => {
  // Public organization signup
  app.post("/signup", async (req, reply) => {
    try {
      const bodySchema = z.object({
        organizationName: z.string().min(1).max(200),
        adminName: z.string().min(1).max(200),
        adminEmail: z.string().email(),
        password: z.string().min(8).max(200),
      });
      
      let body;
      try {
        body = bodySchema.parse(req.body);
      } catch (error) {
        return reply.code(400).send({ 
          error: "Invalid request data",
          code: "INVALID_REQUEST",
        });
      }
    
    // NOTE: Organization names are not globally unique in most real systems.
    // We intentionally allow duplicate names and rely on the generated orgId as the unique identifier.
    
    // Check if admin email already exists (email is not unique, use findFirst)
    const existingUser = await prisma.user.findFirst({
      where: { email: body.adminEmail },
    });
    
    if (existingUser) {
      return reply.code(409).send({ error: "User with this email already exists" });
    }
    
    // Create organization and admin user
    const orgId = `org_${body.organizationName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;
    const userId = `user_${body.adminEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;
    
    // Create organization
    const org = await prisma.organization.create({
      data: {
        id: orgId,
        name: body.organizationName,
        createdAt: new Date(),
      },
    });
    
    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        id: userId,
        orgId,
        email: body.adminEmail,
        name: body.adminName,
        role: "ADMIN",
        passwordHash: await (async () => {
          const { hashPassword } = await import("../modules/security/passwords.js");
          return await hashPassword(body.password);
        })(),
        permissions: [
          "intent:create",
          "intent:approve",
          "intent:execute",
          "intent:view_events",
          "intent:view_bundle",
          "beneficiary:create",
          "beneficiary:lock",
          "policy:edit",
          "user:create",
          "user:view",
          "user:edit",
          "user:delete",
          "org:edit",
          "admin:view",
          "api:create",
          "api:view",
          "webhook:create",
          "webhook:view",
          "webhook:edit",
          "webhook:delete",
          "bank:connect",
          "bank:view",
          "bank:admin",
          "evidence:view",
          "evidence:export_full",
          "audit:read",
        ],
        voiceEnrolled: false,
        createdAt: new Date(),
      },
    });
    
    // Create default policy
    const policyId = `policy_${orgId}_v1`;
    await prisma.policy.create({
      data: {
        id: policyId,
        orgId,
        name: "Default Policy",
        activeVersion: 1,
        createdAt: new Date(),
      },
    });
    
    await prisma.policyVersion.create({
      data: {
        id: `${policyId}_v1`,
        policyId,
        version: 1,
        effectiveAt: new Date(),
        thresholdsJson: JSON.stringify({
          amountStepUpMinor: "1000000",
          dualApprovalRiskScore: 60,
          criticalRiskScore: 85,
          newBeneficiaryDays: 7,
          outOfHoursStartHourLocal: 18,
          outOfHoursEndHourLocal: 8,
        }),
        rulesJson: JSON.stringify({
          requireDualApprovalForInternationalWire: true,
          requirePhoneForL3IfMicDenied: true,
          cooldownMinutesForHighRisk: 10,
          lockoutAfterFailedAttempts: 3,
        }),
        createdAt: new Date(),
      },
    });
    
    // Email delivery (best-effort).
    // NOTE: There is currently no persisted email-verification token flow.
    // If EMAIL_PROVIDER is not configured (default "console"), the email will not be delivered.
    const emailProvider = process.env.EMAIL_PROVIDER || "console";
    let emailDelivery: { provider: string; delivered: boolean; messageId?: string; error?: string } = {
      provider: emailProvider,
      delivered: false,
    };
    try {
      const baseUrl = (process.env.FRONTEND_URL || "https://wire.pose.xyz").replace(/\/$/, "");
      const loginUrl = `${baseUrl}/v2/login`;

      // Enterprise-grade "confirm & sign in" magic link.
      const magic = await createMagicLinkSession({
        userId: adminUser.id,
        orgId: adminUser.orgId,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        ttlMs: 15 * 60 * 1000,
      });
      const magicUrl = `${baseUrl}/v2/magic?t=${encodeURIComponent(magic.token)}`;
      const emailTemplate = generateEmailTemplate("signup_confirmation", {
        name: body.adminName,
        confirmationUrl: magicUrl,
        fallbackUrl: loginUrl,
        orgName: body.organizationName,
      });
      const emailOptions = {
        to: body.adminEmail,
        templateType: "signup_confirmation" as const,
        subject: emailTemplate.subject,
        bodyHtml: emailTemplate.bodyHtml,
        bodyText: emailTemplate.bodyText,
        variables: {
          name: body.adminName,
          confirmationUrl: magicUrl,
          fallbackUrl: loginUrl,
          orgName: body.organizationName,
        },
      };

      const sent =
        process.env.EMAIL_ASYNC === "true"
          ? (await enqueueEmail({ ...emailOptions, orgId, userId }), { success: true, messageId: "queued" })
          : await sendEmail(emailOptions);
      emailDelivery = {
        provider: emailProvider,
        delivered: !!sent.success && emailProvider !== "console",
        ...(sent.messageId ? { messageId: sent.messageId } : {}),
        ...(sent.error ? { error: sent.error } : {}),
      };
      // Log email delivery status
      if (emailDelivery.delivered) {
        req.log.info({ emailDelivery }, "Signup email sent successfully");
      } else {
        req.log.warn({ emailDelivery }, "Signup email delivery failed or skipped");
      }
    } catch (err: any) {
      emailDelivery = {
        provider: emailProvider,
        delivered: false,
        error: err?.message || "Email send failed",
      };
      // Do NOT fail signup on email issues.
      req.log.warn({ err, emailDelivery }, "Signup email delivery failed with exception");
    }
    
      reply.code(201);
      return {
        organization: {
          id: org.id,
          name: org.name,
          createdAt: org.createdAt.toISOString(),
        },
        adminUser: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          role: adminUser.role,
        },
        emailDelivery,
        message: "Organization created successfully. You can sign in now.",
      };
    } catch (error: any) {
      req.log.error({ err: error }, "Signup error");
      if (reply.sent) {
        return;
      }
      
      // Handle specific database errors
      if (error.code === "P2002") {
        return reply.code(409).send({
          error: "User with this email already exists",
          code: "INVALID_REQUEST",
        });
      }
      
      // Generic error response
      return reply.code(500).send({
        error: "Failed to create organization",
        code: "INTERNAL_ERROR",
        details: process.env.NODE_ENV === "development" ? { message: error.message } : undefined,
      });
    }
  });

  // Public beneficiary confirmation endpoint (no auth required)
  app.get("/beneficiaries/confirm", async (req, reply) => {
    const token = (req.query as any).token;
    if (!token || typeof token !== "string") {
      return reply.code(400).send({ error: "Missing confirmation token" });
    }

    const beneficiary = await prisma.beneficiary.findFirst({
      where: {
        confirmationToken: token,
        confirmationTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!beneficiary) {
      return reply.code(404).send({ error: "Invalid or expired confirmation token" });
    }

    // Return beneficiary info for the confirmation page
    return {
      beneficiaryId: beneficiary.id,
      displayName: beneficiary.displayName,
      email: beneficiary.email,
      status: beneficiary.status,
    };
  });

  // Public beneficiary confirmation submission (voice proof + account details)
  app.post("/beneficiaries/confirm", async (req, reply) => {
    const bodySchema = z.object({
      token: z.string().min(1),
      accountNumber: z.string().min(4).max(17),
      routingNumber: z.string().min(4).max(20),
      bankName: z.string().min(1).max(200),
      audio: z.string().optional(), // Base64 encoded audio blob
    });

    let body;
    try {
      body = bodySchema.parse(req.body);
    } catch (error) {
      return reply.code(400).send({ error: "Invalid request data", code: "INVALID_REQUEST" });
    }

    const beneficiary = await prisma.beneficiary.findFirst({
      where: {
        confirmationToken: body.token,
        confirmationTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!beneficiary) {
      return reply.code(404).send({ error: "Invalid or expired confirmation token" });
    }

    // Update beneficiary with account details and mark as confirmed
    const bankTokenHash = sha256Hex(
      canonicalJsonStringify({
        orgId: beneficiary.orgId,
        beneficiaryId: beneficiary.id,
        accountNumber: body.accountNumber,
        routingNumber: body.routingNumber,
        bankName: body.bankName,
        ts: Date.now(),
      })
    );

    // Extract last 4 digits of account number for display
    const bankLast4 = body.accountNumber.slice(-4);

    const updated = await prisma.beneficiary.update({
      where: { id: beneficiary.id },
      data: {
        bankTokenHash,
        bankLast4,
        status: "ACTIVE",
        confirmedAt: new Date(),
        confirmationToken: null, // Clear token after use
        confirmationTokenExpiresAt: null,
        updatedAt: new Date(),
        lastChangedAt: new Date(),
      },
    });

    // TODO: Process voice proof if audio is provided
    // This would integrate with the voice verification service

    // Create an intent automatically if beneficiary is confirmed
    // For now, just return success - the frontend can create the intent

    return {
      success: true,
      beneficiary: {
        id: updated.id,
        displayName: updated.displayName,
        status: updated.status,
      },
      message: "Beneficiary confirmed successfully. You can now receive transfers.",
    };
  });
};
