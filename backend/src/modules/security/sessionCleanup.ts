/**
 * Agent B: Session Cleanup Utility
 * 
 * Cleans up expired and revoked sessions from the database
 * Should be run periodically (e.g., via cron job or scheduled task)
 */

import { prisma } from "../../db/prisma.js";

export async function cleanupExpiredSessions(): Promise<{
  deleted: number;
  errors: number;
}> {
  const now = new Date();
  let deleted = 0;
  let errors = 0;

  try {
    // Delete sessions that are expired and revoked (or expired beyond grace period)
    // Keep expired but not revoked for a grace period (e.g., 24 hours) for audit
    const gracePeriod = 24 * 60 * 60 * 1000; // 24 hours
    const cutoffDate = new Date(now.getTime() - gracePeriod);

    const result = await prisma.session.deleteMany({
      where: {
        OR: [
          // Expired and revoked
          {
            expiresAt: { lt: now },
            revokedAt: { not: null },
          },
          // Expired beyond grace period (even if not revoked)
          {
            expiresAt: { lt: cutoffDate },
          },
        ],
      },
    });

    deleted = result.count;
  } catch (error) {
    console.error("Failed to cleanup expired sessions:", error);
    errors = 1;
  }

  return { deleted, errors };
}

/**
 * Cleanup old audit logs (optional, for compliance/retention policies)
 */
export async function cleanupOldAuditLogs(retentionDays: number = 90): Promise<{
  deleted: number;
  errors: number;
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let deleted = 0;
  let errors = 0;

  try {
    const result = await prisma.authAuditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    deleted = result.count;
  } catch (error) {
    console.error("Failed to cleanup old audit logs:", error);
    errors = 1;
  }

  return { deleted, errors };
}
