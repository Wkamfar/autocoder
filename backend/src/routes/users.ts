/**
 * User Management Routes
 * 
 * CRUD operations for users within an organization
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requirePermission } from "../modules/security/auth.js";
import { logAuthEvent } from "../modules/security/audit.js";
import { emitOrgAuditEvent } from "../modules/audit/auditEvents.js";

export const userRoutes: FastifyPluginAsync = async (app) => {
  // Current authenticated user (and org)
  app.get("/me", async (req, reply) => {
    if (!req.user) {
      return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        voiceEnrolled: true,
        enrolledAt: true,
        createdAt: true,
        orgId: true,
      },
    });

    if (!user) {
      return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { id: true, name: true, createdAt: true },
    });

    if (!org) {
      return reply.code(404).send({ error: "Organization not found" });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        voiceEnrolled: user.voiceEnrolled,
        enrolledAt: user.enrolledAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        orgId: user.orgId,
      },
      organization: {
        id: org.id,
        name: org.name,
        createdAt: org.createdAt.toISOString(),
      },
    };
  });

  // List all users in organization
  app.get(
    "/users",
    { preHandler: requirePermission("user:view") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const users = await prisma.user.findMany({
        where: { orgId: req.user.orgId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          permissions: true,
          voiceEnrolled: true,
          enrolledAt: true,
          createdAt: true,
          orgId: true,
        },
      });
      
      return users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        permissions: u.permissions,
        voiceEnrolled: u.voiceEnrolled,
        enrolledAt: u.enrolledAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        orgId: u.orgId,
      }));
    }
  );

  // Get single user
  app.get(
    "/users/:id",
    { preHandler: requirePermission("user:view") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const userId = (req.params as any).id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          permissions: true,
          voiceEnrolled: true,
          enrolledAt: true,
          createdAt: true,
          orgId: true,
        },
      });
      
      if (!user || user.orgId !== req.user.orgId) {
        return reply.code(404).send({ error: "User not found" });
      }
      
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        voiceEnrolled: user.voiceEnrolled,
        enrolledAt: user.enrolledAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        orgId: user.orgId,
      };
    }
  );

  // Create user
  app.post(
    "/users",
    { preHandler: requirePermission("user:create") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const bodySchema = z.object({
        email: z.string().email(),
        name: z.string().min(1).max(200),
        role: z.enum(["ADMIN", "TREASURY_INITIATOR", "APPROVER", "EXECUTOR", "AUDITOR", "READ_ONLY", "VIEWER"]),
        permissions: z.array(z.string()).optional(),
      });
      
      const body = bodySchema.parse(req.body);
      
      // Check if email already exists (email is not unique, use findFirst)
      const existing = await prisma.user.findFirst({
        where: { email: body.email },
      });
      
      if (existing) {
        return reply.code(409).send({ error: "User with this email already exists" });
      }
      
      // Default permissions based on role
      const defaultPermissions: Record<string, string[]> = {
        ADMIN: [
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
          "evidence:view",
          "evidence:export_full",
          "audit:read",
        ],
        TREASURY_INITIATOR: [
          "intent:create",
          "intent:approve",
          "beneficiary:create",
          "intent:view_events",
          "intent:view_bundle",
          "evidence:view",
        ],
        APPROVER: [
          "intent:approve",
          "intent:view_events",
          "intent:view_bundle",
          "evidence:view",
        ],
        EXECUTOR: [
          "intent:execute",
          "intent:view_events",
          "intent:view_bundle",
          "evidence:view",
        ],
        AUDITOR: [
          "intent:view_events",
          "intent:view_bundle",
          "audit:read",
          "evidence:view",
          "evidence:export_full",
        ],
        READ_ONLY: [
          "intent:view_events",
          "intent:view_bundle",
          "evidence:view",
        ],
        VIEWER: [
          "intent:view_events",
          "intent:view_bundle",
          "evidence:view",
        ],
      };
      
      const permissions = body.permissions ?? defaultPermissions[body.role] ?? [];
      
      // Generate user ID
      const userId = `user_${body.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;
      
      const user = await prisma.user.create({
        data: {
          id: userId,
          orgId: req.user.orgId,
          email: body.email,
          name: body.name,
          role: body.role,
          permissions,
          voiceEnrolled: false,
          createdAt: new Date(),
        },
      });
      
      await logAuthEvent({
        userId: req.user.id,
        orgId: req.user.orgId,
        eventType: "user_created",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        details: { createdUserId: userId, role: body.role },
      });

      await emitOrgAuditEvent({
        req,
        eventType: "user.created",
        subject: { type: "user", id: user.id },
        payload: {
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions,
        },
      });
      
      reply.code(201);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        voiceEnrolled: user.voiceEnrolled,
        enrolledAt: user.enrolledAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        orgId: user.orgId,
      };
    }
  );

  // Update user
  app.patch(
    "/users/:id",
    { preHandler: requirePermission("user:edit") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const userId = (req.params as any).id;
      const bodySchema = z.object({
        name: z.string().min(1).max(200).optional(),
        role: z.enum(["ADMIN", "TREASURY_INITIATOR", "APPROVER", "EXECUTOR", "AUDITOR", "READ_ONLY", "VIEWER"]).optional(),
        permissions: z.array(z.string()).optional(),
        voiceEnrolled: z.boolean().optional(),
      });
      
      const body = bodySchema.parse(req.body);
      
      // Verify user exists and belongs to same org
      const existing = await prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (!existing || existing.orgId !== req.user.orgId) {
        return reply.code(404).send({ error: "User not found" });
      }
      
      const updateData: any = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.role !== undefined) updateData.role = body.role;
      if (body.permissions !== undefined) updateData.permissions = body.permissions;
      if (body.voiceEnrolled !== undefined) {
        updateData.voiceEnrolled = body.voiceEnrolled;
        if (body.voiceEnrolled && !existing.enrolledAt) {
          updateData.enrolledAt = new Date();
        }
      }
      
      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          permissions: true,
          voiceEnrolled: true,
          enrolledAt: true,
          createdAt: true,
          orgId: true,
        },
      });
      
      await logAuthEvent({
        userId: req.user.id,
        orgId: req.user.orgId,
        eventType: "user_updated",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        details: { updatedUserId: userId, changes: Object.keys(updateData) },
      });

      const roleChanged = body.role !== undefined && body.role !== existing.role;
      await emitOrgAuditEvent({
        req,
        eventType: roleChanged ? "user.role_changed" : "user.updated",
        subject: { type: "user", id: user.id },
        payload: {
          patch: {
            name: body.name,
            role: body.role,
            permissions: body.permissions ? "(updated)" : undefined,
            voiceEnrolled: body.voiceEnrolled,
          },
          previous: {
            name: existing.name,
            role: existing.role,
            voiceEnrolled: existing.voiceEnrolled,
          },
          resulting: {
            name: user.name,
            role: user.role,
            voiceEnrolled: user.voiceEnrolled,
          },
        },
      });
      
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        voiceEnrolled: user.voiceEnrolled,
        enrolledAt: user.enrolledAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        orgId: user.orgId,
      };
    }
  );

  // Delete user (soft delete by setting role to VIEWER and removing permissions)
  app.delete(
    "/users/:id",
    { preHandler: requirePermission("user:delete") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const userId = (req.params as any).id;
      
      // Prevent deleting yourself
      if (userId === req.user.id) {
        return reply.code(400).send({ error: "Cannot delete your own account" });
      }
      
      const existing = await prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (!existing || existing.orgId !== req.user.orgId) {
        return reply.code(404).send({ error: "User not found" });
      }
      
      // Soft delete: remove permissions and set to VIEWER
      await prisma.user.update({
        where: { id: userId },
        data: {
          role: "VIEWER",
          permissions: [],
        },
      });
      
      await logAuthEvent({
        userId: req.user.id,
        orgId: req.user.orgId,
        eventType: "user_deleted",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        details: { deletedUserId: userId },
      });

      await emitOrgAuditEvent({
        req,
        eventType: "user.deleted_soft",
        subject: { type: "user", id: userId },
        payload: { previousRole: existing.role, previousPermissionsCount: existing.permissions?.length ?? 0 },
      });
      
      return { success: true };
    }
  );
};
