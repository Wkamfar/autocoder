/**
 * Agent D: Cancel Intent
 * 
 * Allows canceling an intent that is not in a terminal state.
 */

import { prisma } from "../../db/prisma.js";
import { validateTransition } from "./stateMachine.js";
import { appendIntentEvent } from "../evidence/eventChain.js";

export async function cancelIntent(params: {
  orgId: string;
  userId: string;
  intentId: string;
  reason?: string;
}) {
  const intent = await prisma.intent.findFirst({
    where: { id: params.intentId, orgId: params.orgId },
  });

  if (!intent) {
    return null;
  }

  // Validate transition to CANCELED
  validateTransition(intent.status, "CANCELED", "user cancellation");

  const now = new Date();

  await prisma.intent.update({
    where: { id: intent.id },
    data: {
      status: "CANCELED",
      version: { increment: 1 },
      updatedAt: now,
    },
  });

  await appendIntentEvent({
    intentId: intent.id,
    orgId: intent.orgId,
    eventType: "intent.canceled",
    payload: { reason: params.reason || "User canceled" },
    createdByUserId: params.userId,
    createdAt: now,
  });

  return { status: "CANCELED" };
}
