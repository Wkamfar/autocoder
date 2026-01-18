import { prisma } from "../../db/prisma.js";

export type ManualReviewResolutionType = "APPROVED" | "DENIED" | "RETRY_VOICE";

export async function createManualReviewCase(params: {
  orgId: string;
  intentId: string;
  sessionId: string;
  lockReason: string;
  requestedByUserId: string;
}): Promise<void> {
  await prisma.manualReviewCase.upsert({
    where: { sessionId: params.sessionId },
    update: {
      lockReason: params.lockReason,
      updatedAt: new Date(),
    },
    create: {
      id: `mrc_${params.intentId}_${Date.now()}`,
      orgId: params.orgId,
      intentId: params.intentId,
      sessionId: params.sessionId,
      lockReason: params.lockReason,
      status: "OPEN",
      requestedByUserId: params.requestedByUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function resolveManualReviewCase(params: {
  orgId: string;
  sessionId: string;
  resolvedByUserId: string;
  resolution: ManualReviewResolutionType;
  reason: string;
}): Promise<void> {
  await prisma.manualReviewCase.update({
    where: { sessionId: params.sessionId },
    data: {
      status: "RESOLVED",
      resolution: params.resolution,
      reason: params.reason,
      resolvedByUserId: params.resolvedByUserId,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function recordRetryVoice(params: {
  orgId: string;
  sessionId: string;
  resolvedByUserId: string;
  reason?: string;
}): Promise<void> {
  await prisma.manualReviewCase.update({
    where: { sessionId: params.sessionId },
    data: {
      resolution: "RETRY_VOICE",
      reason: params.reason ?? null,
      resolvedByUserId: params.resolvedByUserId,
      updatedAt: new Date(),
    },
  });
}

export async function listManualReviewCases(params: {
  orgId: string;
  status?: "OPEN" | "RESOLVED";
}) {
  return await prisma.manualReviewCase.findMany({
    where: {
      orgId: params.orgId,
      ...(params.status ? { status: params.status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getManualReviewCaseBySession(params: {
  orgId: string;
  sessionId: string;
}) {
  return await prisma.manualReviewCase.findFirst({
    where: { orgId: params.orgId, sessionId: params.sessionId },
  });
}
