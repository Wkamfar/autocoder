/**
 * Sandbox Mode Routes
 * 
 * Provides test endpoints and mock data for development/testing
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sandboxClear, sandboxReset, sandboxSeed } from "../modules/sandbox/sandboxService.js";

export const sandboxRoutes: FastifyPluginAsync = async (app) => {
  function assertSandboxAllowed(req: any, reply: any): boolean {
    if (process.env.NODE_ENV === "production") {
      reply.code(403).send({ error: "Sandbox endpoints are disabled in production" });
      return false;
    }
    if (process.env.SANDBOX_MODE !== "true") {
      reply.code(403).send({ error: "Sandbox mode must be enabled" });
      return false;
    }
    const expected = process.env.SANDBOX_ADMIN_TOKEN;
    if (expected) {
      const got = String(req.headers["x-sandbox-admin"] || "");
      if (got !== expected) {
        reply.code(401).send({ error: "Missing or invalid sandbox admin token" });
        return false;
      }
    }
    return true;
  }

  // Toggle sandbox mode (for testing)
  app.post("/sandbox/toggle", async (req, reply) => {
    const bodySchema = z.object({
      enabled: z.boolean(),
    });
    
    const body = bodySchema.parse(req.body);
    
    // Store in environment or database
    process.env.SANDBOX_MODE = body.enabled ? "true" : "false";
    
    return {
      sandboxMode: body.enabled,
      message: `Sandbox mode ${body.enabled ? "enabled" : "disabled"}`,
    };
  });

  // Get sandbox status
  app.get("/sandbox/status", async (req, reply) => {
    return {
      sandboxMode: process.env.SANDBOX_MODE === "true",
      testDataAvailable: true,
      mockVoiceVerification: process.env.SANDBOX_MODE === "true",
    };
  });

  // Seed test data
  app.post("/sandbox/seed", async (req, reply) => {
    const bodySchema = z.object({
      seed: z.string().min(1).max(80).default("default"),
    });
    
    const body = bodySchema.parse(req.body);

    if (!assertSandboxAllowed(req, reply)) return;

    const seeded = await sandboxSeed({ seed: body.seed });
    return { success: true, seeded };
  });

  // Clear test data
  app.post("/sandbox/clear", async (req, reply) => {
    const bodySchema = z.object({
      seed: z.string().min(1).max(80).default("default"),
    });
    
    const body = bodySchema.parse(req.body);

    if (!assertSandboxAllowed(req, reply)) return;

    const cleared = await sandboxClear({ seed: body.seed });
    return { success: true, cleared };
  });

  // Reset = clear then seed (deterministic)
  app.post("/sandbox/reset", async (req, reply) => {
    const bodySchema = z.object({
      seed: z.string().min(1).max(80).default("default"),
    });
    const body = bodySchema.parse(req.body);

    if (!assertSandboxAllowed(req, reply)) return;

    const seeded = await sandboxReset({ seed: body.seed });
    return { success: true, seeded };
  });
};
