import { logger } from "../../lib/observability.js";
import { getIntent, executeIntent } from "../intents/intentService.js";
import { invalidateApprovalTokens, mintApprovalToken } from "../approvals/approvalTokens.js";
import { getSession, updateSession } from "./sessionStore.js";

export async function processWireV3ExecuteIntentJob(params: {
  orgId: string;
  userId: string;
  intentId: string;
  sessionId: string;
  clientConfirmationId: string;
}) {
  const session = await getSession(params.sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const intent = await getIntent(params.orgId, params.intentId);
  if (!intent) {
    throw new Error("Intent not found");
  }

  if (intent.status !== "APPROVED") {
    await updateSession(session.id, { state: "ready_to_send" });
    throw new Error(`Intent not approved (current: ${intent.status})`);
  }

  try {
    await invalidateApprovalTokens(intent.id);
    const approvalToken = await mintApprovalToken({
      intentId: intent.id,
      orgId: intent.orgId,
      bindingHash: intent.bindingHash,
    });

    if (!approvalToken.token) {
      throw new Error("Unable to mint execution token");
    }

    const execution = await executeIntent({
      orgId: params.orgId,
      userId: params.userId,
      intentId: intent.id,
      approvalToken: approvalToken.token,
      idempotencyKey: params.clientConfirmationId,
    });

    await updateSession(session.id, { state: "sent", transferId: execution.executionRef });
  } catch (error: any) {
    logger.error("v3 execute retry failed", { error: error?.message, intentId: params.intentId });
    await updateSession(session.id, { state: "ready_to_send" });
    throw error;
  }
}
