/**
 * Agent D: Expire Intent
 * 
 * Expires an intent that has been approved but not executed within the timeout period.
 * Typically called by a background job.
 */

import { prisma } from "../../db/prisma.js";
import { validateTransition } from "./stateMachine.js";
import { appendIntentEvent } from "../evidence/eventChain.js";

export async function expireIntent(params: {
  intentId: string;
  orgId: string;
  reason?: string;
}) {
  const intent = await prisma.intent.findFirst({
    where: { id: params.intentId, orgId: params.orgId },
  });

  if (!intent) {
    return null;
  }

  // Only expire APPROVED intents
  if (intent.status !== "APPROVED") {
    return null;
  }

  // Validate transition to EXPIRED
  validateTransition(intent.status, "EXPIRED", "approval timeout");

  const now = new Date();

  await prisma.intent.update({
    where: { id: intent.id },
    data: {
      status: "EXPIRED",
      version: { increment: 1 },
      updatedAt: now,
    },
  });

  await appendIntentEvent({
    intentId: intent.id,
    orgId: intent.orgId,
    eventType: "intent.expired",
    payload: { reason: params.reason || "Approval timeout" },
    createdByUserId: null, // System-initiated
    createdAt: now,
  });

  return { status: "EXPIRED" };
}
