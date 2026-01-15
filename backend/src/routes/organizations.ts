/**
 * Organization Management Routes
 * 
 * CRUD operations for organizations
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requirePermission } from "../modules/security/auth.js";
import { logAuthEvent } from "../modules/security/audit.js";

export const organizationRoutes: FastifyPluginAsync = async (app) => {
  // Get current organization
  app.get("/organizations/current", async (req, reply) => {
    if (!req.user) {
      return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }
    
    const org = await prisma.organization.findUnique({
      where: { id: req.user.orgId },
    });
    
    if (!org) {
      return reply.code(404).send({ error: "Organization not found" });
    }
    
    return {
      id: org.id,
      name: org.name,
      createdAt: org.createdAt.toISOString(),
    };
  });

  // Update organization
  app.patch(
    "/organizations/current",
    { preHandler: requirePermission("org:edit") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      
      const bodySchema = z.object({
        name: z.string().min(1).max(200).optional(),
      });
      
      const body = bodySchema.parse(req.body);
      
      if (Object.keys(body).length === 0) {
        return reply.code(400).send({ error: "No fields to update" });
      }
      
      const org = await prisma.organization.update({
        where: { id: req.user.orgId },
        data: body,
      });
      
      await logAuthEvent({
        userId: req.user.id,
        orgId: req.user.orgId,
        eventType: "org_updated",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        details: { changes: Object.keys(body) },
      });
      
      return {
        id: org.id,
        name: org.name,
        createdAt: org.createdAt.toISOString(),
      };
    }
  );

  // Create organization (for onboarding)
  app.post("/organizations", async (req, reply) => {
    const bodySchema = z.object({
      name: z.string().min(1).max(200),
      adminEmail: z.string().email(),
      adminName: z.string().min(1).max(200),
    });
    
    const body = bodySchema.parse(req.body);
    
    // Check if organization name already exists
    const existingOrg = await prisma.organization.findFirst({
      where: { name: body.name },
    });
    
    if (existingOrg) {
      return reply.code(409).send({ error: "Organization with this name already exists" });
    }
    
    // Check if admin email already exists (email is not unique, use findFirst)
    const existingUser = await prisma.user.findFirst({
      where: { email: body.adminEmail },
    });
    
    if (existingUser) {
      return reply.code(409).send({ error: "User with this email already exists" });
    }
    
    // Generate org ID
    const orgId = `org_${body.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;
    
    // Create organization
    const org = await prisma.organization.create({
      data: {
        id: orgId,
        name: body.name,
        createdAt: new Date(),
      },
    });
    
    // Create admin user
    const userId = `user_${body.adminEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;
    
    const adminUser = await prisma.user.create({
      data: {
        id: userId,
        orgId,
        email: body.adminEmail,
        name: body.adminName,
        role: "ADMIN",
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
    };
  });
};
