import type { FastifyRequest } from "fastify";
import { appendOrgAuditEvent } from "../evidence/orgEventChain.js";

export type AuditSubject = { type: string; id: string } | null;

function getHeader(req: FastifyRequest, name: string): string | undefined {
  const v = (req.headers as any)?.[name.toLowerCase()];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

export function getRequestId(req: FastifyRequest): string | undefined {
  return getHeader(req, "x-request-id") || (req as any).id;
}

export function getCorrelationId(req: FastifyRequest): string | undefined {
  return getHeader(req, "x-correlation-id");
}

/**
 * Emit a canonical, org-level audit event into a tamper-evident chain.
 *
 * This is the *P0* emitter for non-intent sensitive domains (API keys, webhooks, beneficiary/policy changes).
 * Payload should be safe-to-store (no secrets). Use redaction or omit fields as needed.
 */
export async function emitOrgAuditEvent(params: {
  req: FastifyRequest;
  eventType: string;
  subject?: AuditSubject;
  payload?: Record<string, unknown>;
  outcome?: { success: boolean; error?: string; code?: string };
}) {
  const reqAny = params.req as any;
  const user = reqAny.user as { id: string; orgId: string; role?: string; email?: string } | undefined;
  if (!user?.orgId) {
    // In practice all callers are protected routes. Keep a guardrail.
    throw new Error("emitOrgAuditEvent requires authenticated request with orgId");
  }

  const now = new Date();
  const requestId = getRequestId(params.req);
  const correlationId = getCorrelationId(params.req);

  const envelope = {
    schemaVersion: "1.0",
    eventType: params.eventType,
    occurredAt: now.toISOString(),
    tenant: { orgId: user.orgId },
    actor: user?.id
      ? {
          type: "user",
          userId: user.id,
          role: user.role ?? undefined,
          email: user.email ?? undefined,
        }
      : { type: "system" as const },
    subject: params.subject ?? null,
    request: {
      requestId: requestId ?? null,
      correlationId: correlationId ?? null,
      method: (params.req as any).method ?? null,
      path: (params.req as any).url ?? null,
      ipAddress: (params.req as any).ip ?? null,
      userAgent: getHeader(params.req, "user-agent") ?? null,
      authType: getHeader(params.req, "authorization") ? "bearer_or_basic" : null,
    },
    outcome: {
      success: params.outcome?.success ?? true,
      code: params.outcome?.code ?? null,
      error: params.outcome?.error ?? null,
    },
    payload: params.payload ?? {},
  };

  await appendOrgAuditEvent({
    orgId: user.orgId,
    eventType: params.eventType,
    payload: envelope,
    actorUserId: user.id ?? null,
    createdAt: now,
    requestId,
    correlationId,
  });
}

/**
 * Emit an org-level audit event when there is no authenticated request context (public endpoints, background jobs).
 * Prefer `emitOrgAuditEvent` when possible.
 */
export async function emitOrgAuditEventBare(params: {
  orgId: string;
  actorUserId?: string | null;
  eventType: string;
  subject?: AuditSubject;
  payload?: Record<string, unknown>;
  request?: {
    requestId?: string | null;
    correlationId?: string | null;
    method?: string | null;
    path?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    authType?: string | null;
  };
  outcome?: { success: boolean; error?: string; code?: string };
}) {
  const now = new Date();
  const envelope = {
    schemaVersion: "1.0",
    eventType: params.eventType,
    occurredAt: now.toISOString(),
    tenant: { orgId: params.orgId },
    actor: params.actorUserId ? { type: "user", userId: params.actorUserId } : { type: "system" as const },
    subject: params.subject ?? null,
    request: {
      requestId: params.request?.requestId ?? null,
      correlationId: params.request?.correlationId ?? null,
      method: params.request?.method ?? null,
      path: params.request?.path ?? null,
      ipAddress: params.request?.ipAddress ?? null,
      userAgent: params.request?.userAgent ?? null,
      authType: params.request?.authType ?? null,
    },
    outcome: {
      success: params.outcome?.success ?? true,
      code: params.outcome?.code ?? null,
      error: params.outcome?.error ?? null,
    },
    payload: params.payload ?? {},
  };

  await appendOrgAuditEvent({
    orgId: params.orgId,
    eventType: params.eventType,
    payload: envelope,
    actorUserId: params.actorUserId ?? null,
    createdAt: now,
    requestId: params.request?.requestId ?? undefined,
    correlationId: params.request?.correlationId ?? undefined,
  });
}
