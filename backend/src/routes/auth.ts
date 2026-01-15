/**
 * Agent B: Authentication Routes
 * 
 * Login, logout, refresh, and session management endpoints
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { getAuthMode, isOidcEnabled, isOidcMode, isSsoEnforcementEnabled } from "../modules/security/config.js";
import {
  createPasswordResetSession,
  createSession,
  refreshSession,
  revokeSession,
  revokeAllUserSessions,
  revokeAllOtherUserSessions,
} from "../modules/security/session.js";
import { logAuthEvent } from "../modules/security/audit.js";
import { rateLimiters } from "../modules/security/rateLimit.js";
import { exchangeCodeForUserInfo, findOrCreateUserFromOidc, getOidcAuthorizationUrl } from "../modules/security/oidc.js";
import { requirePermission } from "../modules/security/auth.js";
import { sha256Hex } from "../lib/sha256.js";
import { hashPassword, verifyPassword } from "../modules/security/passwords.js";
import { sendEmail, generateEmailTemplate } from "../modules/email/emailService.js";
import { enqueueEmail } from "../modules/email/emailJobs.js";
import { emitOrgAuditEvent } from "../modules/audit/auditEvents.js";

function emailDomainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase().trim() || "";
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Magic-link consume endpoint (public).
   *
   * The frontend receives `t` from the email link and exchanges it here for a fresh session token.
   * We revoke the magic-link session on first use to make the link one-time.
   */
  app.post("/auth/magic/consume", { preHandler: rateLimiters.login }, async (req, reply) => {
    const bodySchema = z.object({
      token: z.string().min(10).max(800),
    });

    let token: string;
    try {
      ({ token } = bodySchema.parse(req.body));
    } catch {
      return reply.code(400).send({ error: "Invalid request", code: "INVALID_REQUEST" });
    }

    const now = new Date();
    const tokenHash = sha256Hex(token);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      await logAuthEvent({
        eventType: "token_invalid",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        details: { reason: "magic_link_not_found" },
      });
      return reply.code(400).send({
        error: "This link is invalid. Request a new sign-in link or sign in with email instead.",
        code: "MAGIC_LINK_INVALID",
      });
    }

    // Ensure token is for a magic-link session (not e.g. a password reset token).
    if (!session.id.startsWith("magic_") || session.refreshTokenHash !== null) {
      return reply.code(400).send({
        error: "This link is invalid. Request a new sign-in link or sign in with email instead.",
        code: "MAGIC_LINK_INVALID",
      });
    }

    if (session.expiresAt < now) {
      return reply.code(410).send({
        error: "This link has expired. Request a new sign-in link or sign in with email instead.",
        code: "MAGIC_LINK_EXPIRED",
      });
    }

    if (session.revokedAt) {
      return reply.code(410).send({
        error: "This link has already been used. Sign in to continue.",
        code: "MAGIC_LINK_USED",
      });
    }

    // One-time: revoke the magic session immediately.
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: now },
    });

    // Mint a fresh normal session for the browser.
    const newSession = await createSession({
      userId: session.userId,
      orgId: session.orgId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await logAuthEvent({
      userId: session.userId,
      orgId: session.orgId,
      eventType: "magic_link_consumed",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      sessionId: newSession.sessionId,
      details: { previousMagicSessionId: session.id },
    });

    return {
      token: newSession.accessToken,
      sessionId: newSession.sessionId,
      user: {
        id: session.userId,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      },
    };
  });

  /**
   * Password reset request (public).
   * Always returns 200 to prevent user enumeration.
   */
  app.post("/auth/password/reset/request", { preHandler: rateLimiters.login }, async (req, reply) => {
    try {
      const bodySchema = z.object({
        email: z.string().email().min(1).max(200),
      });

      let email: string;
      try {
        ({ email } = bodySchema.parse(req.body));
      } catch {
        return reply.code(200).send({ success: true });
      }

    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase().trim() } });
    if (user) {
      try {
        const { token, expiresAt } = await createPasswordResetSession({
          userId: user.id,
          orgId: user.orgId,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        const baseUrl = (process.env.FRONTEND_URL || "https://wire.pose.xyz").replace(/\/$/, "");
        const resetUrl = `${baseUrl}/v2/reset-password?t=${encodeURIComponent(token)}`;

        const tpl = generateEmailTemplate("password_reset", {
          name: user.name,
          resetUrl,
          expiresAt: expiresAt.toLocaleString(),
        });

        const emailOptions = {
          to: user.email,
          templateType: "password_reset" as const,
          subject: tpl.subject,
          bodyHtml: tpl.bodyHtml,
          bodyText: tpl.bodyText,
          variables: { name: user.name, resetUrl, expiresAt: expiresAt.toLocaleString() },
        };

        const result =
          process.env.EMAIL_ASYNC === "true"
            ? (await enqueueEmail({ ...emailOptions, orgId: user.orgId, userId: user.id }), { success: true, messageId: "queued" })
            : await sendEmail(emailOptions);

        if (!result.success) {
          req.log.warn({ err: result.error }, "password reset email delivery failed");
        }
      } catch (e: any) {
        req.log.warn({ err: e?.message || e }, "password reset request failed");
      }
    }

      return reply.code(200).send({ success: true });
    } catch (error: any) {
      req.log.error({ err: error }, "Password reset request error");
      // Always return 200 to prevent user enumeration, even on errors
      return reply.code(200).send({ success: true });
    }
  });

  /**
   * Password reset confirm (public).
   * Exchanges a one-time reset token for a new password + a fresh session.
   */
  app.post("/auth/password/reset/confirm", { preHandler: rateLimiters.login }, async (req, reply) => {
    try {
      const bodySchema = z.object({
        token: z.string().min(10).max(800),
        newPassword: z.string().min(8).max(200),
      });

      let token: string;
      let newPassword: string;
      try {
        ({ token, newPassword } = bodySchema.parse(req.body));
      } catch {
        return reply.code(400).send({ error: "Invalid request", code: "INVALID_REQUEST" });
      }

    const now = new Date();
    const tokenHash = sha256Hex(token);
    const resetSession = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetSession || !resetSession.id.startsWith("reset_") || resetSession.refreshTokenHash !== null) {
      return reply.code(400).send({ error: "Invalid reset link", code: "RESET_INVALID" });
    }
    if (resetSession.expiresAt < now) {
      return reply.code(410).send({ error: "Reset link expired", code: "RESET_EXPIRED" });
    }
    if (resetSession.revokedAt) {
      return reply.code(410).send({ error: "Reset link already used", code: "RESET_USED" });
    }

    // One-time: revoke reset session immediately.
    await prisma.session.update({
      where: { id: resetSession.id },
      data: { revokedAt: now },
    });

    // Update password hash and revoke all existing sessions.
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: resetSession.userId },
      data: { passwordHash: newHash },
    });
    await revokeAllUserSessions(resetSession.userId);

    await logAuthEvent({
      userId: resetSession.userId,
      orgId: resetSession.orgId,
      eventType: "password_reset_completed",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      details: { resetSessionId: resetSession.id },
    });

    // Send password reset confirmation email
    try {
      const { sendPasswordResetConfirmation } = await import("../modules/email/intentNotifications.js");
      await sendPasswordResetConfirmation({
        userId: resetSession.userId,
        orgId: resetSession.orgId,
        email: resetSession.user.email,
        name: resetSession.user.name || resetSession.user.email.split("@")[0],
      });
    } catch (error) {
      req.log.warn({ err: error }, "Failed to send password reset confirmation email");
      // Don't fail the operation if email fails
    }

      const newSession = await createSession({
        userId: resetSession.userId,
        orgId: resetSession.orgId,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return {
        token: newSession.accessToken,
        sessionId: newSession.sessionId,
        user: {
          id: resetSession.userId,
          email: resetSession.user.email,
          name: resetSession.user.name,
          role: resetSession.user.role,
        },
      };
    } catch (error: any) {
      req.log.error({ err: error }, "Password reset confirm error");
      if (reply.sent) {
        return;
      }
      
      // Handle database errors
      if (error.code && error.code.startsWith("P")) {
        return reply.code(500).send({
          error: "Database error occurred",
          code: "INTERNAL_ERROR",
        });
      }
      
      // Generic error response
      return reply.code(500).send({
        error: "Password reset failed",
        code: "INTERNAL_ERROR",
        details: process.env.NODE_ENV === "development" ? { message: error.message } : undefined,
      });
    }
  });

  // OIDC: Get authorization URL
  app.get("/auth/oidc/authorize", async (req, reply) => {
    if (!isOidcEnabled()) {
      return reply.code(400).send({ error: "OIDC mode not enabled" });
    }

    const query = req.query as { orgId?: string; returnTo?: string };
    const { url, state } = getOidcAuthorizationUrl({ orgId: query.orgId, returnTo: query.returnTo });
    await logAuthEvent({
      eventType: "oidc_authorize",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      details: { orgId: query.orgId ?? null, returnTo: query.returnTo ?? null },
    });
    // In production, store state in session/Redis and return URL
    // For now, return both (frontend should store state securely)
    return { authorizationUrl: url, state };
  });
  
  // OIDC: Callback handler
  app.get("/auth/oidc/callback", { preHandler: rateLimiters.login }, async (req, reply) => {
    if (!isOidcEnabled()) {
      return reply.code(400).send({ error: "OIDC mode not enabled" });
    }
    
    const query = req.query as { code?: string; state?: string; error?: string };
    
    if (query.error) {
      await logAuthEvent({
        eventType: "failed_login",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        details: { reason: "oidc_provider_error", error: query.error },
      });
      await logAuthEvent({
        eventType: "oidc_callback_failed",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        details: { reason: "oidc_provider_error", error: query.error },
      });
      return reply.code(400).send({ error: `OIDC error: ${query.error}` });
    }
    
    if (!query.code) {
      return reply.code(400).send({ error: "Missing authorization code" });
    }
    
    if (!query.state) {
      return reply.code(400).send({ error: "Missing state parameter" });
    }
    
    const exchange = await exchangeCodeForUserInfo(
      query.code,
      query.state,
      req.ip,
      req.headers["user-agent"]
    );
    
    const userInfo = exchange.userInfo;
    if (!userInfo) {
      await logAuthEvent({
        eventType: "oidc_callback_failed",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        details: { reason: "no_user_info" },
      });
      return reply.code(401).send({ error: "Failed to authenticate" });
    }
    
    const userMapping = await findOrCreateUserFromOidc(userInfo);
    if (!userMapping) {
      await logAuthEvent({
        eventType: "oidc_callback_failed",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        details: { reason: "user_not_provisioned", email: userInfo.email },
      });
      return reply.code(403).send({ 
        error: "User not provisioned. Contact administrator.",
        code: "USER_NOT_PROVISIONED",
      });
    }

    const stateOrgId = exchange.orgId;
    const returnTo = exchange.returnTo;
    if (stateOrgId && userMapping.orgId !== stateOrgId) {
      await logAuthEvent({
        userId: userMapping.userId,
        orgId: userMapping.orgId,
        eventType: "oidc_callback_failed",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        details: { reason: "org_mismatch", expectedOrgId: stateOrgId },
      });
      return reply.code(403).send({ error: "Organization mismatch", code: "ORG_MISMATCH" });
    }

    // Enforce org SSO email domain allowlist (if configured) for this user/org.
    const sso = await prisma.orgSsoConfig.findUnique({ where: { orgId: userMapping.orgId } });
    const allowedEmailDomains: string[] = Array.isArray(sso?.allowedEmailDomains)
      ? (sso.allowedEmailDomains as string[])
      : [];
    if (allowedEmailDomains.length) {
      const d = emailDomainOf(userInfo.email);
      const allowed = new Set(allowedEmailDomains.map((x) => String(x).toLowerCase()));
      if (!allowed.has(d)) {
        await logAuthEvent({
          userId: userMapping.userId,
          orgId: userMapping.orgId,
          eventType: "permission_denied",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          details: { reason: "oidc_domain_denied", domain: d },
        });
        await logAuthEvent({
          userId: userMapping.userId,
          orgId: userMapping.orgId,
          eventType: "oidc_callback_failed",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          details: { reason: "domain_denied", domain: d },
        });
        return reply.code(403).send({
          error: "Email domain not allowed by org SSO policy",
          code: "SSO_DOMAIN_DENIED",
        });
      }
    }
    
    const session = await createSession({
      userId: userMapping.userId,
      orgId: userMapping.orgId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await logAuthEvent({
      userId: userMapping.userId,
      orgId: userMapping.orgId,
      eventType: "login",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      sessionId: session.sessionId,
      details: { method: "oidc" },
    });
    await logAuthEvent({
      userId: userMapping.userId,
      orgId: userMapping.orgId,
      eventType: "oidc_callback_succeeded",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      sessionId: session.sessionId,
      details: { returnTo: returnTo ?? null, orgBound: stateOrgId ?? null },
    });

    // Browser-friendly redirect: send tokens in URL fragment (not sent to servers) to complete UI login.
    const frontendBase = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
    const accept = String(req.headers["accept"] || "");
    if (frontendBase && accept.includes("text/html")) {
      const target = `${frontendBase}/v2/oidc/callback#accessToken=${encodeURIComponent(
        session.accessToken
      )}&refreshToken=${encodeURIComponent(session.refreshToken)}&returnTo=${encodeURIComponent(returnTo || "/")}`;
      return reply.redirect(target);
    }

    // API clients: return tokens.
    return { sessionId: session.sessionId, accessToken: session.accessToken, refreshToken: session.refreshToken, returnTo };
  });
  
  // Login endpoint (works in demo and OIDC mode)
  app.post("/auth/login", { preHandler: rateLimiters.login }, async (req, reply) => {
    try {
      const bodySchema = z.object({
        email: z.string().email().min(1).max(200),
        password: z.string().min(8).max(200),
      });
      
      let email: string;
      let password: string;
      try {
        ({ email, password } = bodySchema.parse(req.body));
      } catch (error) {
        return reply.code(400).send({ 
          error: "Invalid email address",
          code: "INVALID_REQUEST",
        });
      }
    
    // Find user by email
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      await logAuthEvent({
        eventType: "failed_login",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        details: { reason: "user_not_found", email },
      });
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    // Org-level SSO policy enforcement
    // NOTE: Some deployments may not have the OrgSsoConfig table migrated yet.
    // In that case, we treat SSO as not configured (non-fatal) rather than failing login.
    let sso: any = null;
    try {
      sso = await prisma.orgSsoConfig.findUnique({ where: { orgId: user.orgId } });
    } catch (e: any) {
      // Prisma "table does not exist" during partial migrations
      if (e?.code === "P2021") {
        sso = null;
      } else {
        throw e;
      }
    }
    const allowedEmailDomains: string[] = Array.isArray(sso?.allowedEmailDomains)
      ? (sso.allowedEmailDomains as string[])
      : [];
    if (allowedEmailDomains.length) {
      const d = emailDomainOf(user.email);
      const allowed = new Set(allowedEmailDomains.map((x: string) => x.toLowerCase()));
      if (!allowed.has(d)) {
        return reply.code(403).send({
          error: "Email domain not allowed by org SSO policy",
          code: "SSO_DOMAIN_DENIED",
        });
      }
    }
    // If SSO is enforced, require OIDC mode in production-like setups.
    // In demo mode we allow /auth/login for usability.
    if (sso?.enforced && isSsoEnforcementEnabled() && !isOidcEnabled()) {
      return reply.code(403).send({
        error: "SSO is required for this organization",
        code: "SSO_REQUIRED",
      });
    }
    
    // Password auth (production)
    // If the user record doesn't have a password hash yet (legacy accounts),
    // we set it on first successful login.
    if (user.passwordHash) {
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        await logAuthEvent({
          userId: user.id,
          orgId: user.orgId,
          eventType: "failed_login",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          details: { reason: "invalid_password", email },
        });
        return reply.code(401).send({ error: "Invalid email or password", code: "INVALID_CREDENTIALS" });
      }
    } else {
      // Bootstrap: set password hash on first login.
      const newHash = await hashPassword(password);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
    }
    
    const session = await createSession({
      userId: user.id,
      orgId: user.orgId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    
    await logAuthEvent({
      userId: user.id,
      orgId: user.orgId,
      eventType: "login",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      sessionId: session.sessionId,
    });
    
      return {
        token: session.accessToken,
        sessionId: session.sessionId,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error: any) {
      req.log.error({ err: error }, "Login error");
      if (reply.sent) {
        return;
      }
      
      // Handle database errors
      if (error.code && error.code.startsWith("P")) {
        return reply.code(500).send({
          error: "Database error occurred",
          code: "INTERNAL_ERROR",
        });
      }
      
      // Generic error response
      return reply.code(500).send({
        error: "Login failed",
        code: "INTERNAL_ERROR",
        details: process.env.NODE_ENV === "development" ? { message: error.message } : undefined,
      });
    }
  });
  
  // Backwards compat: if in OIDC mode, block password login.
  // (OIDC deployments should use /auth/oidc/* endpoints.)
  if (getAuthMode() === "oidc") {
    // noop - route exists above but is guarded by org policy and can be disabled in env as needed
  }
  
  // Refresh token endpoint
  app.post("/auth/refresh", { preHandler: rateLimiters.login }, async (req, reply) => {
    const bodySchema = z.object({
      refreshToken: z.string().min(1).max(500), // Sanitize input length
    });
    
    let refreshToken: string;
    try {
      ({ refreshToken } = bodySchema.parse(req.body));
    } catch (error) {
      return reply.code(400).send({ 
        error: "Invalid request body",
        code: "INVALID_REQUEST",
        details: error instanceof z.ZodError ? error.errors : undefined,
      });
    }
    
    const session = await refreshSession({
      refreshToken,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    
    if (!session) {
      await logAuthEvent({
        eventType: "token_invalid",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        details: { reason: "invalid_refresh_token" },
      });
      return reply.code(401).send({ error: "Invalid or expired refresh token" });
    }
    
    return {
      sessionId: session.sessionId,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  });
  
  // Logout endpoint
  app.post("/auth/logout", async (req, reply) => {
    if (!req.user) {
      return reply.code(401).send({ error: "Not authenticated" });
    }
    
    const sessionId = req.user.sessionId;
    if (sessionId) {
      await revokeSession(sessionId, req.user.id);
    }
    
    await logAuthEvent({
      userId: req.user.id,
      orgId: req.user.orgId,
      eventType: "logout",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      sessionId,
    });

    await emitOrgAuditEvent({
      req,
      eventType: "session.logout",
      subject: { type: "session", id: sessionId || "unknown" },
      payload: { sessionId: sessionId ?? null },
    });
    
    return { success: true };
  });

  /**
   * Log out everywhere (self-service).
   *
   * This is the "verifiable" path: call this, then call GET /auth/sessions to confirm
   * that all sessions are revoked.
   */
  app.post("/auth/logout_all", async (req, reply) => {
    if (!req.user) {
      return reply.code(401).send({ error: "Not authenticated", code: "AUTH_REQUIRED" });
    }

    const q = req.query as { includeCurrent?: string };
    const includeCurrent = q.includeCurrent === "1" || q.includeCurrent?.toLowerCase() === "true";
    const currentSessionId = req.user.sessionId;

    const revoked =
      !currentSessionId || includeCurrent
        ? await revokeAllUserSessions(req.user.id)
        : await revokeAllOtherUserSessions(req.user.id, currentSessionId);

    await logAuthEvent({
      userId: req.user.id,
      orgId: req.user.orgId,
      eventType: "logout_all",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      details: { revoked, includeCurrent },
    });

    await emitOrgAuditEvent({
      req,
      eventType: "session.logout_all",
      subject: { type: "user", id: req.user.id },
      payload: { revoked, includeCurrent },
    });

    return { success: true, revoked, includeCurrent };
  });

  /**
   * List sessions for the authenticated user (verifiability for revocation + device inventory).
   */
  app.get("/auth/sessions", async (req, reply) => {
    if (!req.user) {
      return reply.code(401).send({ error: "Not authenticated", code: "AUTH_REQUIRED" });
    }

    const sessions = await prisma.session.findMany({
      where: { userId: req.user.id, orgId: req.user.orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        lastActivityAt: true,
        expiresAt: true,
        revokedAt: true,
        ipAddress: true,
        userAgent: true,
        deviceFingerprint: true,
      },
    });

    return {
      currentSessionId: req.user.sessionId ?? null,
      sessions,
    };
  });
  
  // Revoke all sessions (requires permission)
  app.post(
    "/auth/sessions/revoke-all",
    { preHandler: requirePermission("session:revoke") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Not authenticated" });
      }
      
      const count = await revokeAllUserSessions(req.user.id);
      
      await logAuthEvent({
        userId: req.user.id,
        orgId: req.user.orgId,
        eventType: "revoke_all",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      await emitOrgAuditEvent({
        req,
        eventType: "session.revoked_all",
        subject: { type: "user", id: req.user.id },
        payload: { revoked: count },
      });
      
      return { revoked: count };
    }
  );
};
