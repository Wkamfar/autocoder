import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { registerAuthHooks } from "./modules/security/auth.js";
import { wireRoutes } from "./routes/wire.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { adminRoutes } from "./routes/admin.js";
import { organizationRoutes } from "./routes/organizations.js";
import { apiKeyRoutes } from "./routes/apiKeys.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { invitationRoutes } from "./routes/invitations.js";
import { publicRoutes } from "./routes/public.js";
import { sandboxRoutes } from "./routes/sandbox.js";
import { publicIntentRoutes, publicIntentProtectedRoutes } from "./routes/publicIntents.js";
import { fastWireRoutes } from "./routes/fastWire.js";
import { domainRoutes } from "./routes/domains.js";
import { securityHistoryRoutes } from "./routes/securityHistory.js";
import { securityReportsRoutes } from "./routes/securityReports.js";
import { complianceRoutes } from "./routes/compliance.js";
import { auditEventRoutes } from "./routes/auditEvents.js";
import { orgGroupRoutes } from "./routes/orgGroups.js";
import { ssoRoutes } from "./routes/sso.js";
import { poseVoiceRoutes } from "./routes/poseVoice.js";
import { legalEntityRoutes } from "./routes/legalEntities.js";
import { bankRoutes } from "./routes/banks.js";
import { providerEventRoutes } from "./routes/providerEvents.js";
import { poseVerificationRoutes } from "./routes/poseVerification.js";
import { wireV3Routes } from "./routes/wireV3.js";
import { getAuthMode, isOidcMode } from "./modules/security/config.js";
import { metricsPlugin } from "./lib/observability.js";
import { getHealthStatus, getReadinessStatus } from "./lib/health.js";
import { isValidTraceparent, makeTraceparent, newSpanId, newTraceId, traceIdFromTraceparent } from "./lib/resilience/trace.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  // Accept CSP report content-types (Reporting API / legacy csp-report)
  app.addContentTypeParser(
    ["application/csp-report", "application/reports+json"],
    { parseAs: "string" },
    (req, body, done) => {
      try {
        const parsed = JSON.parse(body as string);
        done(null, parsed);
      } catch {
        // Don't fail the report if parsing fails; pass raw payload through.
        done(null, { raw: String(body) });
      }
    }
  );

  // Correlation ID: echo Fastify request id for client/support correlation
  app.addHook("onRequest", async (req, reply) => {
    reply.header("X-Request-Id", req.id);
    const incoming = String(req.headers["traceparent"] || "");
    const traceId = isValidTraceparent(incoming) ? (traceIdFromTraceparent(incoming) || newTraceId()) : newTraceId();
    const tp = makeTraceparent(traceId, newSpanId(), "01");
    (req as any).traceId = traceId;
    reply.header("X-Trace-Id", traceId);
    reply.header("traceparent", tp);
  });

  // CORS configuration: locked down for production, permissive for demo
  const corsOrigin = process.env.CORS_ORIGIN || false;
  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-POSE-APPROVAL", "X-Idempotency-Key"],
  });

  await app.register(multipart);

  // Global error handler - catch all unhandled errors
  app.setErrorHandler((error: unknown, request, reply) => {
    // Log the error
    request.log.error({ err: error }, "Unhandled error");
    
    // Don't send response if already sent
    if (reply.sent) {
      return;
    }
    
    // Type guard for error object
    const err = error as any;
    
    // Handle validation errors
    if (err?.validation) {
      return reply.code(400).send({
        error: "Validation error",
        code: "INVALID_REQUEST",
        details: err.validation,
      });
    }
    
    // Handle Prisma errors
    if (err?.code && typeof err.code === "string" && err.code.startsWith("P")) {
      request.log.error({ err: error }, "Database error");
      return reply.code(500).send({
        error: "Database error occurred",
        code: "INTERNAL_ERROR",
        details: process.env.NODE_ENV === "development" ? { message: err?.message } : undefined,
      });
    }
    
    // Default error response
    const statusCode = err?.statusCode || 500;
    return reply.code(statusCode).send({
      error: err?.message || "Internal server error",
      code: statusCode >= 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST",
      details: process.env.NODE_ENV === "development" ? { stack: err?.stack } : undefined,
    });
  });

  // Observability: metrics endpoint (before auth to allow scraping)
  await app.register(metricsPlugin);

  // Agent 7.1: Public verification materials (JWKS + receipt verifier)
  await app.register(poseVerificationRoutes);
  await app.register(wireV3Routes);

  // Register auth hooks globally (they self-skip /health, /ready, /api/auth/*, /api/signup, etc.)
  // This ensures /api/* and /api/wire/* routes both have access to req.user.
  await registerAuthHooks(app);

  // Health endpoints (no auth required for orchestration)
  app.get("/health", async () => {
    return await getHealthStatus();
  });

  app.get("/ready", async (_req, reply) => {
    const status = await getReadinessStatus();
    if (!status.ready) {
      return reply.code(503).send(status);
    }
    return status;
  });

  // Public routes (signup, etc.)
  await app.register(publicRoutes, { prefix: "/api" });
  // Public intents (no-login)
  await app.register(publicIntentRoutes, { prefix: "/api" });
  // Fast Wire routes (no-login, public)
  await app.register(fastWireRoutes, { prefix: "/api" });
  // Security reporting endpoints (unauthenticated)
  await app.register(securityReportsRoutes, { prefix: "/api" });
  
  // Sandbox routes (testing)
  await app.register(sandboxRoutes, { prefix: "/api" });

  // Auth routes (login, logout, refresh)
  await app.register(authRoutes, { prefix: "/api" });

  // POSE identity primitives (voice onboarding + verify)
  await app.register(poseVoiceRoutes, { prefix: "/api" });

  // Organization routes (protected; uses req.user)
  await app.register(organizationRoutes, { prefix: "/api" });
  
  // Register wire routes (auth hooks from plugin above will apply)
  await app.register(wireRoutes, { prefix: "/api/wire" });
  
  // Register user management routes (auth hooks apply)
  await app.register(userRoutes, { prefix: "/api/wire" });
  
  // Register admin routes (auth hooks apply)
  await app.register(adminRoutes, { prefix: "/api/wire" });
  
  // Register API key routes (auth hooks apply)
  await app.register(apiKeyRoutes, { prefix: "/api/wire" });
  
  // Register webhook routes (auth hooks apply)
  await app.register(webhookRoutes, { prefix: "/api/wire" });

  // Agent 7: bank connectivity + provider events/reconciliation scaffold
  await app.register(bankRoutes, { prefix: "/api/wire" });
  await app.register(providerEventRoutes, { prefix: "/api/wire" });
  
  // Register invitation routes (auth hooks apply, except accept endpoint)
  await app.register(invitationRoutes, { prefix: "/api/wire" });

  // Domains & email domains (org settings)
  await app.register(domainRoutes, { prefix: "/api/wire" });

  // Security history (audit logs)
  await app.register(securityHistoryRoutes, { prefix: "/api/wire" });

  // Compliance & reporting (exports, retention, legal holds)
  await app.register(complianceRoutes, { prefix: "/api/wire" });

  // Agent 6: Org-level audit event chain (non-intent sensitive domains)
  await app.register(auditEventRoutes, { prefix: "/api/wire" });

  // Org groups (rollups)
  await app.register(orgGroupRoutes, { prefix: "/api/wire" });

  // Agent 4: Org → LegalEntity → FinancialAccount hierarchy
  await app.register(legalEntityRoutes, { prefix: "/api/wire" });

  // SSO config (org-level)
  await app.register(ssoRoutes, { prefix: "/api/wire" });

  // Public intent claim routes (requires auth)
  await app.register(publicIntentProtectedRoutes, { prefix: "/api/wire" });

  return app;
}

