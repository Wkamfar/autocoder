/**
 * Agent D: Audit Trail Helpers
 * 
 * Comprehensive audit logging for intent operations
 */

import { appendIntentEvent } from "../evidence/eventChain.js";

export interface AuditContext {
  userId: string;
  orgId: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

/**
 * Audit intent operation with full context
 */
export async function auditIntentOperation(params: {
  intentId: string;
  operation: string;
  context: AuditContext;
  metadata?: Record<string, unknown>;
  success: boolean;
}): Promise<void> {
  await appendIntentEvent({
    intentId: params.intentId,
    orgId: params.context.orgId,
    eventType: `audit.${params.operation}`,
    payload: {
      operation: params.operation,
      success: params.success,
      metadata: params.metadata || {},
      context: {
        userId: params.context.userId,
        orgId: params.context.orgId,
        ipAddress: params.context.ipAddress,
        userAgent: params.context.userAgent,
      },
    },
    createdByUserId: params.context.userId,
    createdAt: new Date(),
    correlationId: params.context.correlationId,
  });
}

/**
 * Audit state transition
 */
export async function auditStateTransition(params: {
  intentId: string;
  fromStatus: string;
  toStatus: string;
  context: AuditContext;
  reason?: string;
}): Promise<void> {
  await auditIntentOperation({
    intentId: params.intentId,
    operation: "state_transition",
    context: params.context,
    metadata: {
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      reason: params.reason,
    },
    success: true,
  });
}

/**
 * Audit security event
 */
export async function auditSecurityEvent(params: {
  intentId: string;
  eventType: string;
  context: AuditContext;
  details: Record<string, unknown>;
  severity: "low" | "medium" | "high" | "critical";
}): Promise<void> {
  await appendIntentEvent({
    intentId: params.intentId,
    orgId: params.context.orgId,
    eventType: `security.${params.eventType}`,
    payload: {
      severity: params.severity,
      details: params.details,
      context: {
        userId: params.context.userId,
        orgId: params.context.orgId,
        ipAddress: params.context.ipAddress,
      },
    },
    createdByUserId: params.context.userId,
    createdAt: new Date(),
    correlationId: params.context.correlationId,
  });
}
