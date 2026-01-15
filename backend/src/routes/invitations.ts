/**
 * User Invitation Routes
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePermission } from "../modules/security/auth.js";
import { emitOrgAuditEvent, emitOrgAuditEventBare, getRequestId, getCorrelationId } from "../modules/audit/auditEvents.js";
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  getInvitationByToken,
  acceptInvitation,
} from "../modules/invitations/invitationService.js";

export const invitationRoutes: FastifyPluginAsync = async (app) => {
  // List invitations (requires auth)
  app.get(
    "/invitations",
    { preHandler: requirePermission("user:view") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const invitations = await listInvitations(req.user.orgId);
      
      return invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        permissions: inv.permissions,
        expiresAt: inv.expiresAt.toISOString(),
        acceptedAt: inv.acceptedAt?.toISOString() ?? null,
        revokedAt: inv.revokedAt?.toISOString() ?? null,
        createdAt: inv.createdAt.toISOString(),
      }));
    }
  );

  // Create invitation
  app.post(
    "/invitations",
    { preHandler: requirePermission("user:create") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const bodySchema = z.object({
        email: z.string().email(),
        role: z.enum(["ADMIN", "TREASURY_INITIATOR", "APPROVER", "EXECUTOR", "AUDITOR", "READ_ONLY", "VIEWER"]),
        permissions: z.array(z.string()).optional(),
        expiresInDays: z.number().int().min(1).max(30).optional(),
      });
      
      const body = bodySchema.parse(req.body);
      
      try {
        const { invitation, inviteUrl } = await createInvitation({
          orgId: req.user.orgId,
          invitedByUserId: req.user.id,
          email: body.email,
          role: body.role,
          permissions: body.permissions,
          expiresInDays: body.expiresInDays,
        });

        await emitOrgAuditEvent({
          req,
          eventType: "invitation.created",
          subject: { type: "invitation", id: invitation.id },
          payload: {
            email: invitation.email,
            role: invitation.role,
            expiresAt: invitation.expiresAt.toISOString(),
          },
        });
        
        reply.code(201);
        return {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt.toISOString(),
          inviteUrl, // For testing - in production, email is sent
          createdAt: invitation.createdAt.toISOString(),
        };
      } catch (error: any) {
        if (error.message.includes("already exists")) {
          return reply.code(409).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Revoke invitation
  app.post(
    "/invitations/:id/revoke",
    { preHandler: requirePermission("user:edit") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const invitationId = (req.params as any).id;
      const success = await revokeInvitation(req.user.orgId, invitationId);
      
      if (!success) {
        return reply.code(404).send({ error: "Invitation not found or already accepted" });
      }

      await emitOrgAuditEvent({
        req,
        eventType: "invitation.revoked",
        subject: { type: "invitation", id: invitationId },
        payload: {},
      });
      
      return { success: true };
    }
  );

  // Get invitation by token (public endpoint for acceptance)
  app.get("/invitations/token/:token", async (req, reply) => {
    const token = (req.params as any).token;
    const invitation = await getInvitationByToken(token);
    
    if (!invitation) {
      return reply.code(404).send({ error: "Invalid invitation token" });
    }
    
    if (invitation.revokedAt) {
      return reply.code(410).send({ error: "Invitation has been revoked" });
    }
    
    if (invitation.acceptedAt) {
      return reply.code(410).send({ error: "Invitation has already been accepted" });
    }
    
    if (invitation.expiresAt.getTime() < Date.now()) {
      return reply.code(410).send({ error: "Invitation has expired" });
    }
    
    // Get organization info
    const { prisma } = await import("../db/prisma.js");
    const org = await prisma.organization.findUnique({
      where: { id: invitation.orgId },
    });
    
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      permissions: invitation.permissions,
      orgName: org?.name,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  });

  // Accept invitation (public endpoint)
  app.post("/invitations/accept", async (req, reply) => {
    const bodySchema = z.object({
      token: z.string().min(1),
      name: z.string().min(1).max(200),
      password: z.string().optional(), // For future password-based auth
    });
    
    const body = bodySchema.parse(req.body);
    
    try {
      const { userId, orgId, invitationId, email, role } = await acceptInvitation({
        token: body.token,
        name: body.name,
        password: body.password,
      });

      await emitOrgAuditEventBare({
        orgId,
        actorUserId: userId,
        eventType: "invitation.accepted",
        subject: { type: "invitation", id: invitationId },
        payload: { userId, email, role },
        request: {
          requestId: getRequestId(req) ?? null,
          correlationId: getCorrelationId(req) ?? null,
          method: (req as any).method ?? null,
          path: (req as any).url ?? null,
          ipAddress: (req as any).ip ?? null,
          userAgent: (req.headers as any)?.["user-agent"] ?? null,
          authType: null,
        },
      });
      
      return {
        success: true,
        userId,
        orgId,
        message: "Invitation accepted successfully",
      };
    } catch (error: any) {
      if (error.message.includes("Invalid") || error.message.includes("expired") || error.message.includes("revoked")) {
        return reply.code(400).send({ error: error.message });
      }
      if (error.message.includes("already exists")) {
        return reply.code(409).send({ error: error.message });
      }
      throw error;
    }
  });
};
