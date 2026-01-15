/**
 * Agent B: Session Management Service
 * 
 * Handles session lifecycle: creation, refresh, rotation, revocation
 */

import { randomBytes } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { SESSION_CONFIG } from "./config.js";
import { sha256Hex } from "../../lib/sha256.js";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";
import { logAuthEvent } from "./audit.js";
import {
  cacheDelTokenSession,
  cacheGetTokenSession,
  cacheGetUserRevokeAllAt,
  cacheSetTokenSession,
  cacheSetUserRevokeAllAt,
} from "./sessionCache.js";

export type SessionData = {
  id: string;
  userId: string;
  orgId: string;
  tokenHash: string;
  refreshTokenHash: string | null;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  lastActivityAt: Date;
  createdAt: Date;
};

export async function createSession(params: {
  userId: string;
  orgId: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ sessionId: string; accessToken: string; refreshToken: string }> {
  try {
    const now = new Date();
    const sessionId = `session_${Date.now()}_${randomBytes(8).toString("base64url")}`;
    
    // Generate tokens (in production, use proper JWT library)
    const accessToken = generateToken(sessionId, params.userId, "access");
    const refreshToken = generateToken(sessionId, params.userId, "refresh");
    
    const tokenHash = sha256Hex(accessToken);
    const refreshTokenHash = sha256Hex(refreshToken);
    
    const expiresAt = new Date(now.getTime() + SESSION_CONFIG.accessTokenTTL);
    const refreshExpiresAt = new Date(now.getTime() + SESSION_CONFIG.refreshTokenTTL);
    
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: params.userId,
        orgId: params.orgId,
        tokenHash,
        refreshTokenHash,
        deviceFingerprint: params.deviceFingerprint,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        expiresAt: refreshExpiresAt, // Session expires when refresh token expires
        lastActivityAt: now,
      },
    });

    // Cache: enable fast-path lookups for this token (best-effort).
    await cacheSetTokenSession(tokenHash, sessionId, 60);

    // NOTE: callers are responsible for emitting the "login" audit event, because they
    // have context (password vs OIDC vs magic-link) and because double-logging is harmful.
    return { sessionId, accessToken, refreshToken };
  } catch (error) {
    // Log error but don't expose internal details
    console.error("Failed to create session:", error);
    throw new Error("Failed to create session");
  }
}

/**
 * Create a short-lived, one-time magic-link session.
 *
 * This session:
 * - Has NO refresh token
 * - Expires quickly (default 15 minutes)
 * - Should be revoked on first use by the magic-link consume endpoint
 *
 * This allows enterprise-grade email "confirm & sign in" UX without adding new tables.
 */
export async function createMagicLinkSession(params: {
  userId: string;
  orgId: string;
  ipAddress?: string;
  userAgent?: string;
  ttlMs?: number;
}): Promise<{ sessionId: string; token: string; expiresAt: Date }> {
  const now = new Date();
  const ttlMs = params.ttlMs ?? 15 * 60 * 1000;
  const sessionId = `magic_${Date.now()}_${randomBytes(8).toString("base64url")}`;

  const token = generateToken(sessionId, params.userId, "access");
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(now.getTime() + ttlMs);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: params.userId,
      orgId: params.orgId,
      tokenHash,
      refreshTokenHash: null,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      expiresAt,
      lastActivityAt: now,
    },
  });

  await logAuthEvent({
    userId: params.userId,
    orgId: params.orgId,
    eventType: "magic_link_issued",
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    sessionId,
    details: { ttlMs },
  });

  return { sessionId, token, expiresAt };
}

/**
 * Create a short-lived, one-time password-reset session.
 *
 * This session:
 * - Has NO refresh token
 * - Expires quickly (default 60 minutes)
 * - Must never be accepted as a normal Bearer session for API auth
 * - Is revoked on first successful password reset
 */
export async function createPasswordResetSession(params: {
  userId: string;
  orgId: string;
  ipAddress?: string;
  userAgent?: string;
  ttlMs?: number;
}): Promise<{ sessionId: string; token: string; expiresAt: Date }> {
  const now = new Date();
  const ttlMs = params.ttlMs ?? 60 * 60 * 1000;
  const sessionId = `reset_${Date.now()}_${randomBytes(8).toString("base64url")}`;

  const token = generateToken(sessionId, params.userId, "access");
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(now.getTime() + ttlMs);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: params.userId,
      orgId: params.orgId,
      tokenHash,
      refreshTokenHash: null,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      expiresAt,
      lastActivityAt: now,
    },
  });

  await logAuthEvent({
    userId: params.userId,
    orgId: params.orgId,
    eventType: "password_reset_requested",
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    sessionId,
    details: { ttlMs },
  });

  return { sessionId, token, expiresAt };
}

export async function refreshSession(params: {
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ sessionId: string; accessToken: string; refreshToken: string } | null> {
  const refreshTokenHash = sha256Hex(params.refreshToken);
  
  // Handle case where refreshTokenHash might be null
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash },
    include: { user: true },
  });
  
  if (!session || !session.refreshTokenHash || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }
  
  const now = new Date();
  const shouldRotate = 
    session.createdAt.getTime() + SESSION_CONFIG.rotationThreshold < now.getTime();

  // Rotation strategy (P0): keep a single DB session row per device/sessionId.
  // This avoids unique constraint issues on refreshTokenHash and keeps "log out everywhere" simple.
  const newAccessToken = generateToken(session.id, session.userId, "access");
  const newTokenHash = sha256Hex(newAccessToken);
  const newRefreshToken = shouldRotate
    ? generateToken(session.id, session.userId, "refresh")
    : params.refreshToken;
  const newRefreshTokenHash = shouldRotate ? sha256Hex(newRefreshToken) : refreshTokenHash;

  await prisma.session.update({
    where: { id: session.id },
    data: {
      tokenHash: newTokenHash,
      refreshTokenHash: newRefreshTokenHash,
      ipAddress: params.ipAddress || session.ipAddress,
      userAgent: params.userAgent || session.userAgent,
      lastActivityAt: now,
    },
  });

  // Cache: update token hash mapping for faster auth lookups (best-effort).
  await cacheSetTokenSession(newTokenHash, session.id, 60);
  // Old access token should no longer resolve to a session.
  await cacheDelTokenSession(session.tokenHash);
  
  await logAuthEvent({
    userId: session.userId,
    orgId: session.orgId,
    eventType: "refresh",
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    sessionId: session.id,
    details: { rotatedRefresh: shouldRotate },
  });
  
  return { sessionId: session.id, accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function revokeSession(sessionId: string, userId?: string): Promise<boolean> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  
  if (!session) return false;
  if (userId && session.userId !== userId) return false; // Can only revoke own sessions
  if (session.revokedAt) return true; // Already revoked
  
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });

  // Cache: ensure the session becomes invalid immediately even if other instances cached it.
  await cacheDelTokenSession(session.tokenHash);
  
  await logAuthEvent({
    userId: session.userId,
    orgId: session.orgId,
    eventType: "revoke",
    sessionId,
  });
  
  return true;
}

export async function revokeAllUserSessions(userId: string): Promise<number> {
  const now = new Date();
  const rows = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    select: { id: true, tokenHash: true },
  });

  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    data: { revokedAt: now },
  });

  // Cache: delete cached mappings for all revoked sessions (best-effort).
  await Promise.all(rows.map((r) => cacheDelTokenSession(r.tokenHash).catch(() => null)));

  // Cache: fast-path "log out everywhere" for this user for a short window.
  await cacheSetUserRevokeAllAt(userId, now.getTime(), 60 * 60);
  
  await logAuthEvent({
    userId,
    eventType: "revoke_all",
  });
  
  return result.count;
}

/**
 * Revoke all sessions for a user except the current session.
 * This supports a verifiable “revoke other sessions” UX without logging out the user.
 */
export async function revokeAllOtherUserSessions(userId: string, exceptSessionId: string): Promise<number> {
  const now = new Date();
  const rows = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now }, NOT: { id: exceptSessionId } },
    select: { id: true, tokenHash: true },
  });

  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now }, NOT: { id: exceptSessionId } },
    data: { revokedAt: now },
  });

  await Promise.all(rows.map((r) => cacheDelTokenSession(r.tokenHash).catch(() => null)));
  return result.count;
}

export async function getSessionByToken(accessToken: string): Promise<SessionData | null> {
  try {
    const tokenHash = sha256Hex(accessToken);

    // Cache fast-path: resolve tokenHash -> sessionId, then fetch by id (still DB for source of truth).
    const cachedSessionId = await cacheGetTokenSession(tokenHash);
    if (cachedSessionId) {
      const s = await prisma.session.findUnique({ where: { id: cachedSessionId } });
      if (!s || s.revokedAt || s.expiresAt < new Date()) return null;
      if (s.id.startsWith("magic_") || s.id.startsWith("reset_")) return null;
      if (!s.refreshTokenHash) return null;
      // Per-user "logout everywhere" cache (belt-and-suspenders).
      const revokeAllAt = await cacheGetUserRevokeAllAt(s.userId);
      if (revokeAllAt && s.createdAt.getTime() <= revokeAllAt) return null;
      return {
        id: s.id,
        userId: s.userId,
        orgId: s.orgId,
        tokenHash: s.tokenHash,
        refreshTokenHash: s.refreshTokenHash,
        deviceFingerprint: s.deviceFingerprint ?? undefined,
        ipAddress: s.ipAddress ?? undefined,
        userAgent: s.userAgent ?? undefined,
        expiresAt: s.expiresAt,
        lastActivityAt: s.lastActivityAt,
        createdAt: s.createdAt,
      };
    }

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    
    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;
    // Never treat one-time sessions as authenticated API sessions.
    // These are only meant to be consumed by dedicated endpoints.
    if (session.id.startsWith("magic_") || session.id.startsWith("reset_")) return null;
    if (!session.refreshTokenHash) return null;

    // Per-user "logout everywhere" cache (belt-and-suspenders).
    const revokeAllAt = await cacheGetUserRevokeAllAt(session.userId);
    if (revokeAllAt && session.createdAt.getTime() <= revokeAllAt) return null;
    
    // Update last activity (non-blocking)
    prisma.session.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    }).catch((err) => {
      // Log but don't fail the request
      console.error("Failed to update session activity:", err);
    });
    
    return {
      id: session.id,
      userId: session.userId,
      orgId: session.orgId,
      tokenHash: session.tokenHash,
      refreshTokenHash: session.refreshTokenHash,
      deviceFingerprint: session.deviceFingerprint ?? undefined,
      ipAddress: session.ipAddress ?? undefined,
      userAgent: session.userAgent ?? undefined,
      expiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
    };
  } catch (error) {
    console.error("Failed to get session by token:", error);
    return null;
  }
}

function generateToken(sessionId: string, userId: string, type: "access" | "refresh"): string {
  // Generate cryptographically secure random token
  // In production, consider using proper JWT library (e.g., jose, jsonwebtoken)
  // For now, use randomBytes for security
  const randomPart = randomBytes(32).toString("base64url");
  const payload = canonicalJsonStringify({
    sessionId,
    userId,
    type,
    iat: Math.floor(Date.now() / 1000),
  });
  
  // Combine payload hash with random part for security
  const payloadHash = sha256Hex(payload).substring(0, 16);
  return `${payloadHash}.${randomPart}`;
}
