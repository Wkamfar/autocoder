import { prisma } from "../../db/prisma.js";
import { appendIntentEvent } from "./eventChain.js";

/**
 * Records a bundle download event for compliance and investigations.
 * Best-effort; callers should swallow failures.
 */
export async function logBundleDownload(params: {
  orgId: string;
  userId: string;
  bundleId: string;
  intentId: string;
  mode: "full" | "redacted" | string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const now = new Date();

  // Persist an org-level download trail (for exports + investigations)
  await (prisma as any).evidenceDownload.create({
    data: {
      id: `evdl_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`,
      orgId: params.orgId,
      userId: params.userId,
      bundleId: params.bundleId,
      intentId: params.intentId,
      mode: String(params.mode ?? "full"),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      createdAt: now,
    },
  });

  // Append an immutable event into the intent's event chain (court-ready linkage)
  await appendIntentEvent({
    intentId: params.intentId,
    orgId: params.orgId,
    eventType: "bundle.downloaded",
    payload: {
      bundleId: params.bundleId,
      mode: params.mode ?? "full",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
    createdByUserId: params.userId,
    createdAt: now,
  });
}

