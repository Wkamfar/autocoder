/**
 * Agent B: Authentication & Authorization Plugin
 * 
 * Supports production session auth (Bearer token) and optional OIDC mode (SSO)
 * Enforces RBAC and maker-checker rules based on authenticated identity
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma.js";
import type { UserRole } from "@prisma/client";
import { getAuthMode } from "./config.js";
import { getSessionByToken, revokeSession } from "./session.js";
import { logAuthEvent } from "./audit.js";
import { rateLimiters } from "./rateLimit.js";

export type AuthedUser = {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: string[];
  sessionId?: string;
};

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthedUser;
  }
}

/**
 * Main authentication plugin
 * Routes requests to demo or OIDC auth based on AUTH_MODE
 * 
 * Note: This plugin applies to routes registered with prefix "/api/wire"
 * Health/ready endpoints at root level bypass this plugin
 */
export const authPlugin: FastifyPluginAsync = async (app) => {
  await registerAuthHooks(app);
};

/**
 * Register auth hooks directly on a Fastify instance.
 * This is used to ensure auth applies across all routes registered on that instance.
 */
export async function registerAuthHooks(app: FastifyInstance): Promise<void> {
  // Apply secure headers globally
  app.addHook("onRequest", async (req, reply) => {
    applySecureHeaders(reply);
  });
  
  // Try API key authentication first (before session auth)
  app.addHook("preHandler", async (req, reply) => {
    // Skip API key auth for public endpoints
    if (
      req.url.includes("/invitations/accept") ||
      req.url.includes("/invitations/token/") ||
      req.url.startsWith("/api/public/intents")
    ) {
      return;
    }
    
    try {
      const { apiKeyAuthMiddleware } = await import("../../middleware/apiKeyAuth.js");
      await apiKeyAuthMiddleware(req, reply);
    } catch (error) {
      // If API key auth fails, continue to session auth
      console.error("API key auth error:", error);
    }
  });
  
  // Apply global rate limiting (with error handling)
  app.addHook("preHandler", async (req, reply) => {
    try {
      await rateLimiters.global(req, reply);
    } catch (error) {
      // Don't fail request if rate limiting errors
      console.error("Rate limiting error:", error);
    }
  });
  
  // Authentication hook - must run before route handlers
  app.addHook("preHandler", async (req, reply) => {
    console.log("[AUTH HOOK] Executing for:", req.url, req.method);
    
    // Skip auth for health/ready endpoints (these are at root, not under /api/wire)
    const url = req.url.split("?")[0]; // Remove query params
    const shouldSkipAuth =
      url === "/health" ||
      url === "/ready" ||
      url === "/metrics" ||
      // Agent 7.1: Public receipt verification materials (unauthenticated)
      url === "/.well-known/pose-jwks.json" ||
      url === "/api/wire/keys/jwks" ||
      url === "/api/wire/verify/pose-receipt" ||
      // Wire (app) health endpoints are also safe to expose without auth.
      url === "/api/wire/health" ||
      url === "/api/wire/health/ready" ||
      url === "/api/wire/metrics" ||
      // Provider webhooks are authenticated by provider signatures (not by user sessions).
      url.startsWith("/api/wire/provider-webhooks/plaid/") ||
      url === "/api/signup" ||
      // Security reporting endpoints must remain unauthenticated
      url === "/api/security/csp-report" ||
      url.startsWith("/api/public/intents") ||
      // Auth endpoints that must remain unauthenticated:
      url === "/api/auth/login" ||
      url === "/api/auth/refresh" ||
      url === "/api/auth/magic/consume" ||
      url === "/api/auth/password/reset/request" ||
      url === "/api/auth/password/reset/confirm" ||
      url.startsWith("/api/auth/oidc/");

    if (shouldSkipAuth) {
      console.log("[AUTH HOOK] Skipping auth for:", url);
      return;
    }
    
    console.log("[AUTH HOOK] Processing auth, mode:", getAuthMode());
    
    try {
      // If a Bearer token is present, always prefer session auth (works in demo and oidc modes)
      const authHeader = req.headers["authorization"];
      const bearer =
        typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : undefined;

      if (bearer) {
        const session = await getSessionByToken(bearer);
        if (session) {
          const user = await prisma.user.findUnique({ where: { id: session.userId } });
          if (user) {
            req.user = {
              id: user.id,
              orgId: user.orgId,
              email: user.email,
              name: user.name,
              role: user.role,
              permissions: user.permissions,
              sessionId: session.id,
            };
            console.log("[AUTH HOOK] Session auth successful, user:", req.user.id);

            // Post-auth rate limiting (per-user/org) once req.user is known.
            try {
              await rateLimiters.authenticated(req, reply);
              if (reply.sent) return;
            } catch (error) {
              console.error("Rate limiting error:", error);
            }
            return;
          }
        }
      }

      const mode = getAuthMode();
      if (mode === "oidc") {
        await handleOidcAuth(req, reply);
      } else if (mode === "demo") {
        await handleDemoAuth(req, reply);
      } else {
        // Password/session mode: requires Bearer token on protected routes.
        if (!reply.sent) {
          reply.code(401).send({ error: "Authentication required", code: "AUTH_REQUIRED" });
        }
      }
      
      // If reply was sent (error case), stop processing
      if (reply.sent) {
        console.log("[AUTH HOOK] Reply already sent, stopping");
        return;
      }
      
      // Verify user was set - this should always be true if auth succeeded
      if (!req.user) {
        console.error("[AUTH HOOK] Authentication failed: req.user not set after auth handler", {
          url: req.url,
          method: req.method,
        });
        if (!reply.sent) {
          reply.code(401).send({
            error: "Authentication failed",
            code: "AUTH_FAILED",
          });
        }
        return;
      }

      // Post-auth rate limiting (per-user/org)
      try {
        await rateLimiters.authenticated(req, reply);
        if (reply.sent) return;
      } catch (error) {
        console.error("Rate limiting error:", error);
      }
      
      console.log("[AUTH HOOK] Auth successful, user:", req.user.id);
    } catch (error) {
      // Log error and return 500
      console.error("[AUTH HOOK] Authentication error:", error);
      if (!reply.sent) {
        reply.code(500).send({
          error: "Authentication error",
          code: "AUTH_ERROR",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });
};

/**
 * OIDC mode: Use Bearer token authentication
 */
export async function handleOidcAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    await logAuthEvent({
      eventType: "failed_login",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      details: { reason: "missing_bearer_token" },
    });
    reply.code(401).send({ 
      error: "Missing or invalid Authorization header",
      code: "AUTH_REQUIRED",
    });
    return;
  }
  
  const token = authHeader.substring(7);
  const session = await getSessionByToken(token);
  
  if (!session) {
    await logAuthEvent({
      eventType: "token_invalid",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      details: { reason: "session_not_found_or_expired" },
    });
    reply.code(401).send({ 
      error: "Invalid or expired session",
      code: "AUTH_INVALID",
    });
    return;
  }
  
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    await logAuthEvent({
      eventType: "failed_login",
      userId: session.userId,
      orgId: session.orgId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      sessionId: session.id,
      details: { reason: "user_not_found" },
    });
    reply.code(401).send({ 
      error: "User not found",
      code: "AUTH_INVALID",
    });
    return;
  }
  
  req.user = {
    id: user.id,
    orgId: user.orgId,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
    sessionId: session.id,
  };
}

/**
 * Demo mode: Header-based auth for development and contract tests.
 * Uses `X-USER-ID` (required) and optionally `X-ORG-ID` to auto-provision a demo org/user.
 */
export async function handleDemoAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers["x-user-id"] || req.headers["x-user-id".toUpperCase()];
  const userId = typeof header === "string" ? header : Array.isArray(header) ? header[0] : undefined;
  if (!userId) {
    reply.code(401).send({ error: "Missing X-USER-ID header", code: "DEMO_USER_REQUIRED" });
    return;
  }

  const orgHeader = req.headers["x-org-id"] || req.headers["x-org-id".toUpperCase()];
  const orgIdRaw = typeof orgHeader === "string" ? orgHeader : Array.isArray(orgHeader) ? orgHeader[0] : undefined;
  const orgId = orgIdRaw || "org_demo";

  try {
    // Ensure org exists
    await prisma.organization.upsert({
      where: { id: orgId },
      update: {},
      create: { id: orgId, name: `Demo Org (${orgId})` },
    });

    // Ensure user exists
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: { orgId },
      create: {
        id: userId,
        orgId,
        email: `${userId}@demo.local`,
        name: `Demo User (${userId})`,
        role: "ADMIN" as UserRole,
        permissions: ["*"],
        voiceEnrolled: false,
        createdAt: new Date(),
      },
    });

    req.user = {
      id: user.id,
      orgId: user.orgId,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
    };
  } catch (e) {
    // If DB is unavailable, fail closed with a clear service error.
    reply.code(503).send({ error: "Demo auth unavailable (database not reachable)", code: "SERVICE_UNAVAILABLE" });
  }
}

// NOTE: demo auth implementation lives in exported `handleDemoAuth` below.

/**
 * Permission-based authorization middleware
 * Enforces RBAC with audit logging
 */
export function requirePermission(permission: string) {
  return async function permissionGuard(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) {
      reply.code(401).send({ 
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
      return;
    }
    
    const perms: string[] = req.user.permissions ?? [];
    if (!perms.includes(permission)) {
      await logAuthEvent({
        userId: req.user.id,
        orgId: req.user.orgId,
        eventType: "permission_denied",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        sessionId: req.user.sessionId,
        details: { 
          permission,
          path: req.url,
          method: req.method,
        },
      });
      
      reply.code(403).send({ 
        error: `Missing permission: ${permission}`,
        code: "PERMISSION_DENIED",
        permission,
      });
      return;
    }
  };
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...roles: AuthedUser["role"][]) {
  return async function roleGuard(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) {
      reply.code(401).send({ 
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
      return;
    }
    
    if (!roles.includes(req.user.role)) {
      await logAuthEvent({
        userId: req.user.id,
        orgId: req.user.orgId,
        eventType: "permission_denied",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        sessionId: req.user.sessionId,
        details: { 
          requiredRoles: roles,
          userRole: req.user.role,
          path: req.url,
          method: req.method,
        },
      });
      
      reply.code(403).send({ 
        error: `Insufficient role. Required: ${roles.join(" or ")}`,
        code: "ROLE_DENIED",
        requiredRoles: roles,
      });
      return;
    }
  };
}

/**
 * Maker-checker enforcement: Ensure distinct approvers
 * This enforces that the same user cannot approve the same intent twice
 * and that the initiator cannot approve their own intent
 */
export async function enforceMakerChecker(
  orgId: string,
  userId: string,
  intentId: string,
  decisionType: "APPROVE" | "DENY" | "STEP_UP"
): Promise<{ allowed: boolean; reason?: string }> {
  // Agent 4: tenant guardrail — never read intents cross-org.
  const intent = await prisma.intent.findFirst({
    where: { id: intentId, orgId },
  });
  
  if (!intent) {
    return { allowed: false, reason: "Intent not found" };
  }
  
  // Rule 1: Initiator cannot approve their own intent
  if (decisionType === "APPROVE" && userId === intent.createdByUserId) {
    return { 
      allowed: false, 
      reason: "Maker-checker: initiator cannot approve their own intent" 
    };
  }
  
  // Rule 2: Check for duplicate approvals by same user for same bindingHash
  if (decisionType === "APPROVE") {
    const existingApproval = await prisma.decision.findFirst({
      where: {
        intentId,
        createdByUserId: userId,
        decisionType: "APPROVE",
        decisionPayloadCanonicalJson: { 
          contains: `"bindingHash":"${intent.bindingHash}"` 
        },
      },
    });
    
    if (existingApproval) {
      return { 
        allowed: false, 
        reason: "Maker-checker: user has already approved this intent with this binding hash" 
      };
    }
  }
  
  return { allowed: true };
}

/**
 * Apply secure headers for production
 */
function applySecureHeaders(reply: FastifyReply): void {
  const authMode = getAuthMode();
  const cspMode = (process.env.CSP_MODE || "report-only").toLowerCase(); // report-only | enforce | off
  const cspReportPath = process.env.CSP_REPORT_PATH || "/api/security/csp-report";
  const cspReportEndpoint = process.env.CSP_REPORT_ENDPOINT || cspReportPath;
  
  // Security headers
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("X-XSS-Protection", "1; mode=block");
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // HSTS (only in production/OIDC mode)
  if (authMode === "oidc") {
    reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  
  // Content Security Policy:
  // - Start report-only by default to gather real violations and tighten safely.
  // - Intended primarily for any HTML/doc surfaces; harmless on JSON responses.
  if (cspMode !== "off") {
    // Modern Reporting API header
    reply.header("Reporting-Endpoints", `csp="${cspReportEndpoint}"`);

    // NOTE: This baseline keeps 'unsafe-inline' initially to reduce breakage risk.
    // Tightening toward enforce mode should remove it (nonce/hashes) after reviewing reports.
    const policy =
      `default-src 'self'; ` +
      `script-src 'self' 'unsafe-inline'; ` +
      `style-src 'self' 'unsafe-inline'; ` +
      `base-uri 'self'; ` +
      `frame-ancestors 'none'; ` +
      `report-uri ${cspReportPath}; ` +
      `report-to csp;`;

    if (cspMode === "enforce") {
      reply.header("Content-Security-Policy", policy);
    } else {
      reply.header("Content-Security-Policy-Report-Only", policy);
    }
  }
}
