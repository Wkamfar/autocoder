/**
 * Agent B: Authentication Audit Logging
 * 
 * Centralized audit logging for all authentication and authorization events
 */

import { prisma } from "../../db/prisma.js";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";

export type AuthEventType =
  | "login"
  | "logout"
  | "logout_all"
  | "oidc_authorize"
  | "oidc_callback_succeeded"
  | "oidc_callback_failed"
  | "refresh"
  | "revoke"
  | "revoke_all"
  | "failed_login"
  | "permission_denied"
  | "session_expired"
  | "token_invalid"
  | "magic_link_issued"
  | "magic_link_consumed"
  | "password_reset_requested"
  | "password_reset_completed"
  | "org_updated"
  | "user_created"
  | "user_updated"
  | "user_deleted";

export async function logAuthEvent(params: {
  userId?: string;
  orgId?: string;
  eventType: AuthEventType;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.authAuditLog.create({
      data: {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        userId: params.userId,
        orgId: params.orgId,
        eventType: params.eventType,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        sessionId: params.sessionId,
        detailsJson: params.details ? canonicalJsonStringify(params.details) : null,
      },
    });
  } catch (error) {
    // Don't fail auth flow if audit logging fails, but log the error
    console.error("Failed to log auth event:", error);
  }
}
