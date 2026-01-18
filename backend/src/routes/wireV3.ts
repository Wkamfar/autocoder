import type { FastifyPluginAsync } from "fastify";
import {
  createConfirmationSession,
  submitVoice,
  getSessionStatus,
  cancelSession,
} from "../modules/wireV3/orchestrator.js";
import { updateSession } from "../modules/wireV3/sessionStore.js";
import { appendIntentEvent } from "../modules/evidence/eventChain.js";
import { getIntent } from "../modules/intents/intentService.js";
import {
  createManualReviewCase,
  getManualReviewCaseBySession,
  listManualReviewCases,
  recordRetryVoice,
  resolveManualReviewCase,
} from "../modules/wireV3/manualReview.js";

function isV3Enabled(orgId: string | undefined): boolean {
  const enabled = process.env.WIRE_V3_ENABLED === "true";
  if (!enabled) return false;
  const allowlist = (process.env.WIRE_V3_ORG_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (allowlist.length === 0) return true;
  return orgId ? allowlist.includes(orgId) : false;
}

function requireV3Enabled(orgId: string | undefined) {
  if (!isV3Enabled(orgId)) {
    const err = new Error("WIRE v3 not enabled");
    (err as any).statusCode = 404;
    throw err;
  }
}

function requireUser(req: any, reply: any) {
  if (!req.user) {
    reply.code(401).send({ error: "Authentication required" });
    return null;
  }
  return req.user;
}

function handleV3Error(err: unknown, req: any, reply: any, fallbackMessage: string) {
  const statusCode = (err as any)?.statusCode;
  if (statusCode && statusCode < 500) {
    const message = err instanceof Error ? err.message : "Request failed";
    return reply.code(statusCode).send({ error: message });
  }

  req.log?.error?.({ err }, "WIRE v3 request failed");
  return reply.code(500).send({ error: fallbackMessage });
}

function requireManualReviewPermission(user: any) {
  if (!user) return false;
  if (user.permissions?.includes("manual_review")) return true;
  if (user.role === "ADMIN") return true;
  return false;
}

export const wireV3Routes: FastifyPluginAsync = async (app) => {
  app.post("/api/v3/confirm-sessions", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    try {
      requireV3Enabled(user.orgId);
      const response = await createConfirmationSession({
        ctx: { orgId: user.orgId, userId: user.id },
        request: req.body as any,
      });
      reply.send(response);
    } catch (err) {
      return handleV3Error(err, req, reply, "Unable to start confirmation session.");
    }
  });

  app.post("/api/v3/confirm-sessions/:sessionId/voice", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    try {
      requireV3Enabled(user.orgId);
      const response = await submitVoice({
        ctx: { orgId: user.orgId, userId: user.id },
        sessionId: (req.params as any).sessionId,
        request: req.body as any,
      });
      reply.send(response);
    } catch (err) {
      return handleV3Error(err, req, reply, "Unable to verify the voice confirmation.");
    }
  });

  app.get("/api/v3/confirm-sessions/:sessionId", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    try {
      requireV3Enabled(user.orgId);
      const response = await getSessionStatus({
        ctx: { orgId: user.orgId, userId: user.id },
        sessionId: (req.params as any).sessionId,
      });
      reply.send(response);
    } catch (err) {
      return handleV3Error(err, req, reply, "Unable to fetch confirmation status.");
    }
  });

  // Optional alias: redirect to canonical confirm-sessions endpoint
  app.get("/api/v3/confirm/:sessionId", async (req, reply) => {
    const sessionId = (req.params as any).sessionId;
    reply.redirect(301, `/api/v3/confirm-sessions/${sessionId}`);
  });

  app.post("/api/v3/confirm-sessions/:sessionId/cancel", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    try {
      requireV3Enabled(user.orgId);
      const response = await cancelSession({
        ctx: { orgId: user.orgId, userId: user.id },
        sessionId: (req.params as any).sessionId,
      });
      reply.send(response);
    } catch (err) {
      return handleV3Error(err, req, reply, "Unable to cancel the confirmation session.");
    }
  });

  // Optional internal/admin endpoints for manual review
  app.get("/api/v3/admin/manual-review-cases", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    try {
      requireV3Enabled(user.orgId);
      if (!requireManualReviewPermission(user)) {
        return reply.code(403).send({ error: "Permission denied" });
      }
      const status = (req.query as any)?.status as "OPEN" | "RESOLVED" | undefined;
      const cases = await listManualReviewCases({ orgId: user.orgId, status });
      reply.send({ cases });
    } catch (err) {
      return handleV3Error(err, req, reply, "Unable to fetch manual review cases.");
    }
  });

  app.get("/api/v3/admin/manual-review-cases/:sessionId", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    try {
      requireV3Enabled(user.orgId);
      if (!requireManualReviewPermission(user)) {
        return reply.code(403).send({ error: "Permission denied" });
      }
      const sessionId = (req.params as any).sessionId;
      const item = await getManualReviewCaseBySession({ orgId: user.orgId, sessionId });
      if (!item) return reply.code(404).send({ error: "Manual review case not found" });
      reply.send({ case: item });
    } catch (err) {
      return handleV3Error(err, req, reply, "Unable to fetch manual review case.");
    }
  });

  app.post("/api/v3/admin/locked-sessions/:sessionId/approve", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    try {
      requireV3Enabled(user.orgId);
      if (!requireManualReviewPermission(user)) {
        return reply.code(403).send({ error: "Permission denied" });
      }

      const reason = (req.body as any)?.reason;
      if (typeof reason !== "string" || reason.trim().length < 3) {
        return reply.code(400).send({ error: "Reason is required." });
      }
      const sessionId = (req.params as any).sessionId;
      const session = await updateSession(sessionId, { state: "ready_to_send" });
      if (session) {
        await resolveManualReviewCase({
          orgId: user.orgId,
          sessionId,
          resolvedByUserId: user.id,
          resolution: "APPROVED",
          reason: reason.trim(),
        });
        const intent = await getIntent(user.orgId, session.intentId);
        if (intent) {
          await appendIntentEvent({
            intentId: intent.id,
            orgId: intent.orgId,
            eventType: "manual_review.approved",
            payload: { sessionId, reason: reason.trim() },
            createdByUserId: user.id,
            createdAt: new Date(),
          });
        }
      }
      reply.send({ status: "ready_to_send" });
    } catch (err) {
      return handleV3Error(err, req, reply, "Unable to approve the locked session.");
    }
  });

  app.post("/api/v3/admin/locked-sessions/:sessionId/deny", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    try {
      requireV3Enabled(user.orgId);
      if (!requireManualReviewPermission(user)) {
        return reply.code(403).send({ error: "Permission denied" });
      }

      const reason = (req.body as any)?.reason;
      if (typeof reason !== "string" || reason.trim().length < 3) {
        return reply.code(400).send({ error: "Reason is required." });
      }
      const sessionId = (req.params as any).sessionId;
      const session = await updateSession(sessionId, { state: "failed", lockReason: "manual_review_denied" });
      if (session) {
        await resolveManualReviewCase({
          orgId: user.orgId,
          sessionId,
          resolvedByUserId: user.id,
          resolution: "DENIED",
          reason: reason.trim(),
        });
        const intent = await getIntent(user.orgId, session.intentId);
        if (intent) {
          await appendIntentEvent({
            intentId: intent.id,
            orgId: intent.orgId,
            eventType: "manual_review.denied",
            payload: { sessionId, reason: reason.trim() },
            createdByUserId: user.id,
            createdAt: new Date(),
          });
        }
      }
      reply.send({ status: "failed" });
    } catch (err) {
      return handleV3Error(err, req, reply, "Unable to deny the locked session.");
    }
  });

  app.post("/api/v3/admin/locked-sessions/:sessionId/retry-voice", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    try {
      requireV3Enabled(user.orgId);
      if (!requireManualReviewPermission(user)) {
        return reply.code(403).send({ error: "Permission denied" });
      }

      const sessionId = (req.params as any).sessionId;
      const session = await updateSession(sessionId, { state: "voice_required", voiceRetryAttempted: false });
      if (session) {
        await recordRetryVoice({
          orgId: user.orgId,
          sessionId,
          resolvedByUserId: user.id,
          reason: (req.body as any)?.reason,
        });
        const intent = await getIntent(user.orgId, session.intentId);
        if (intent) {
          await appendIntentEvent({
            intentId: intent.id,
            orgId: intent.orgId,
            eventType: "manual_review.retry_voice",
            payload: { sessionId },
            createdByUserId: user.id,
            createdAt: new Date(),
          });
        }
      }
      reply.send({ status: "voice_required" });
    } catch (err) {
      return handleV3Error(err, req, reply, "Unable to retry voice confirmation.");
    }
  });
};

