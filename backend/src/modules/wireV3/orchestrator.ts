import { prisma } from "../../db/prisma.js";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";
import { sha256Hex } from "../../lib/sha256.js";
import { logger } from "../../lib/observability.js";
import { computeIntentBindingHash } from "../intents/binding.js";
import { createIntent, getIntent, submitProof, createDecision, executeIntent } from "../intents/intentService.js";
import { countDistinctApprovals } from "../intents/approvals.js";
import { validateTransition } from "../intents/stateMachine.js";
import { appendIntentEvent } from "../evidence/eventChain.js";
import { cancelIntent } from "../intents/cancelIntent.js";
import { getExecutionLedgerEntries } from "../intents/executionLedger.js";
import { invalidateApprovalTokens, mintApprovalToken } from "../approvals/approvalTokens.js";
import { enqueueJob } from "../../jobs/jobQueue.js";
import { JOB_TYPES } from "../../jobs/jobTypes.js";
import { createManualReviewCase } from "./manualReview.js";
import type {
  CreateConfirmationSessionRequest,
  CreateConfirmationSessionResponse,
  SubmitVoiceRequest,
  SubmitVoiceResponse,
  GetSessionResponse,
  CancelSessionResponse,
  ConfirmationSession,
  DeviceTrustLevel,
} from "./types.js";
import { createSession, getSession, updateSession, linkClientConfirmationId, getSessionByClientConfirmationId } from "./sessionStore.js";
import { lookupByClientConfirmationId, storeClientConfirmationId } from "./idempotency.js";
import { generateConfirmPhrase, isPhraseMatch } from "./utils.js";

const SESSION_TTL_MS = 5 * 60 * 1000;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function buildSessionId(intentId: string) {
  return `v3_${intentId}_${Date.now()}`;
}

function extractIntentIdFromSessionId(sessionId: string): string | null {
  if (!sessionId.startsWith("v3_")) return null;
  const parts = sessionId.split("_");
  if (parts.length < 3) return null;
  return parts[1] || null;
}

function computeDeviceTrustLevel(deviceFingerprint?: string): DeviceTrustLevel {
  if (!deviceFingerprint) return "unknown";
  // Placeholder: treat unseen device as "new" until historical tracking is implemented.
  return "new";
}

function buildSession(params: {
  orgId: string;
  userId: string;
  intentId: string;
  challengeId: string;
  challengePhrase: string;
  clientConfirmationId: string;
  deviceTrustLevel: DeviceTrustLevel;
  sessionContinuityHash: string | null;
  policyOutcome?: string | null;
}): ConfirmationSession {
  const now = new Date();
  return {
    id: buildSessionId(params.intentId),
    orgId: params.orgId,
    userId: params.userId,
    intentId: params.intentId,
    challengeId: params.challengeId,
    challengePhrase: params.challengePhrase,
    challengePhraseDisplay: "Confirm",
    clientConfirmationId: params.clientConfirmationId,
    deviceTrustLevel: params.deviceTrustLevel,
    isNewDevice: params.deviceTrustLevel === "new",
    sessionContinuityHash: params.sessionContinuityHash,
    state: "voice_required",
    voiceRetryAttempted: false,
    policyOutcome: params.policyOutcome ?? null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };
}

async function createDynamicChallenge(params: {
  orgId: string;
  userId: string;
  intentId: string;
  phrase: string;
}) {
  const intent = await getIntent(params.orgId, params.intentId);
  if (!intent) throw new Error("Intent not found");

  const now = new Date();
  validateTransition(intent.status, "CHALLENGING", "v3 challenge creation");

  const challengeNonce = sha256Hex(`${params.intentId}:${params.phrase}`).slice(0, 16);
  const expectedSlotsJson = canonicalJsonStringify({
    slots: [{ name: "phrase", type: "words", value: params.phrase }],
  });

  const challenge = await prisma.voiceChallenge.create({
    data: {
      id: `challenge_${params.intentId}_${Date.now()}`,
      intentId: intent.id,
      orgId: intent.orgId,
      language: "EN",
      level: intent.requiredChallengeLevel,
      grammarVersion: "v3.confirm",
      challengeNonce,
      challengeText: params.phrase,
      expectedSlotsJson,
      expiresAt: new Date(now.getTime() + 10 * 60_000),
      createdAt: now,
    },
  });

  await prisma.intent.update({
    where: { id: intent.id },
    data: { status: "CHALLENGING", version: { increment: 1 }, updatedAt: now },
  });

  await appendIntentEvent({
    intentId: intent.id,
    orgId: intent.orgId,
    eventType: "challenge.created",
    payload: { challengeId: challenge.id, level: intent.requiredChallengeLevel },
    createdByUserId: params.userId,
    createdAt: now,
  });

  return challenge;
}

function computeSessionContinuityHash(userId: string, deviceFingerprint?: string) {
  if (!deviceFingerprint) return null;
  return sha256Hex(`${userId}:${deviceFingerprint}:${new Date().toISOString().slice(0, 13)}`);
}

async function deriveSessionStatusFromIntent(params: { orgId: string; intentId: string }): Promise<GetSessionResponse> {
  const intent = await getIntent(params.orgId, params.intentId);
  if (!intent) {
    return {
      status: "failed",
      intentId: params.intentId,
      message: "Transfer not found.",
    };
  }

  const ledgerEntries = await getExecutionLedgerEntries(intent.id, intent.orgId);
  const hasLedger = ledgerEntries.length > 0;

  switch (intent.status) {
    case "EXECUTED":
      return {
        status: "sent",
        intentId: intent.id,
        transferId: hasLedger ? ledgerEntries[0]?.executionRef : undefined,
      };
    case "APPROVED":
      return {
        status: "ready_to_send",
        intentId: intent.id,
        message: "Transfer is ready to send. Processing...",
      };
    case "PENDING_APPROVALS":
      return {
        status: "awaiting_confirmation",
        intentId: intent.id,
        message: "We've sent a confirmation request to your team. You'll be notified when it's confirmed.",
      };
    case "CHALLENGING":
      return {
        status: "voice_required",
        intentId: intent.id,
      };
    case "CANCELED":
      return {
        status: "cancelled",
        intentId: intent.id,
        message: "Transfer cancelled.",
      };
    case "EXPIRED":
      return {
        status: "expired",
        intentId: intent.id,
        message: "Transfer expired.",
      };
    default:
      return {
        status: "pending",
        intentId: intent.id,
      };
  }
}

async function enqueueExecutionRetry(params: {
  orgId: string;
  userId: string;
  intentId: string;
  sessionId: string;
  clientConfirmationId: string;
}) {
  await enqueueJob({
    type: JOB_TYPES.WIRE_V3_EXECUTE_INTENT,
    payload: {
      orgId: params.orgId,
      userId: params.userId,
      intentId: params.intentId,
      sessionId: params.sessionId,
      clientConfirmationId: params.clientConfirmationId,
    },
    uniqueKey: `wirev3_execute:${params.orgId}:${params.intentId}`,
    maxAttempts: 8,
  });
}

async function resolveIdempotencyIntent(params: {
  orgId: string;
  userId: string;
  request: CreateConfirmationSessionRequest;
  recordIntentId: string;
  recordBindingHash: string;
}): Promise<{ intent: any } | { error: string }> {
  const intent = await getIntent(params.orgId, params.recordIntentId);
  if (!intent) {
    return { error: "Transfer not found." };
  }
  if (intent.createdByUserId !== params.userId) {
    return { error: "clientConfirmationId already used for another transfer." };
  }

  if (params.request.purpose && params.request.purpose !== intent.purpose) {
    return { error: "clientConfirmationId already used for another transfer." };
  }

  const { bindingHash } = computeIntentBindingHash({
    id: intent.id,
    orgId: intent.orgId,
    createdByUserId: intent.createdByUserId,
    railsType: intent.railsType,
    amountMinor: params.request.amountMinor,
    currency: params.request.currency,
    beneficiaryId: params.request.beneficiaryId,
    beneficiaryVersion: intent.beneficiaryVersion,
    purpose: params.request.purpose ?? intent.purpose,
  });

  if (bindingHash !== intent.bindingHash || bindingHash !== params.recordBindingHash) {
    return { error: "clientConfirmationId already used for another transfer." };
  }

  return { intent };
}

function shouldQueueExecution(error: unknown) {
  const message = typeof error === "string" ? error : (error as any)?.message;
  if (!message || typeof message !== "string") return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("plaid") ||
    normalized.includes("provider") ||
    normalized.includes("transfer") ||
    normalized.includes("network") ||
    normalized.includes("connection")
  );
}

export async function createConfirmationSession(params: {
  ctx: { orgId: string; userId: string };
  request: CreateConfirmationSessionRequest;
}): Promise<CreateConfirmationSessionResponse> {
  const { orgId, userId } = params.ctx;
  const request = params.request;

  if (!request.clientConfirmationId) {
    return { status: "failed", error: "clientConfirmationId is required." };
  }

  const existingSession = await getSessionByClientConfirmationId({
    orgId,
    userId,
    clientConfirmationId: request.clientConfirmationId,
  });
  if (existingSession) {
    return {
      sessionId: existingSession.id,
      challengeId: existingSession.challengeId || "",
      challengePhrase: existingSession.challengePhrase || "",
      challengePhraseDisplay: existingSession.challengePhraseDisplay || "Confirm",
      intentId: existingSession.intentId,
      expiresAt: existingSession.expiresAt,
      state: "voice_required",
    };
  }

  const idempotencyRecord = await lookupByClientConfirmationId({
    orgId,
    userId,
    clientConfirmationId: request.clientConfirmationId,
  });
  if (idempotencyRecord?.intentId) {
    const resolved = await resolveIdempotencyIntent({
      orgId,
      userId,
      request,
      recordIntentId: idempotencyRecord.intentId,
      recordBindingHash: idempotencyRecord.intentBindingHash,
    });
    if ("error" in resolved) {
      return { status: "failed", error: resolved.error };
    }

    const intentStatus = resolved.intent.status;
    if (["EXECUTED", "CANCELED", "EXPIRED", "DENIED"].includes(intentStatus)) {
      return { status: "failed", error: "Confirmation already processed." };
    }
    if (intentStatus === "CHALLENGING" || intentStatus === "DRAFT") {
      const phrase = generateConfirmPhrase();
      const challenge = await createDynamicChallenge({
        orgId,
        userId,
        intentId: resolved.intent.id,
        phrase,
      });

      const session = buildSession({
        orgId,
        userId,
        intentId: resolved.intent.id,
        challengeId: challenge.id,
        challengePhrase: phrase,
        clientConfirmationId: request.clientConfirmationId,
        deviceTrustLevel: computeDeviceTrustLevel(request.deviceFingerprint),
        sessionContinuityHash: computeSessionContinuityHash(userId, request.deviceFingerprint),
      });

      await createSession(session);
      await linkClientConfirmationId({
        orgId,
        userId,
        clientConfirmationId: request.clientConfirmationId,
        sessionId: session.id,
        expiresAt: session.expiresAt,
      });

      await storeClientConfirmationId({
        orgId,
        userId,
        intentBindingHash: resolved.intent.bindingHash,
        clientConfirmationId: request.clientConfirmationId,
        ttlMs: IDEMPOTENCY_TTL_MS,
        intentId: resolved.intent.id,
        sessionId: session.id,
      });

      return {
        sessionId: session.id,
        challengeId: challenge.id,
        challengePhrase: phrase,
        challengePhraseDisplay: "Confirm",
        intentId: resolved.intent.id,
        expiresAt: session.expiresAt,
        state: "voice_required",
      };
    }

    return { status: "failed", error: "Confirmation already in progress. Please check status." };
  }

  const deviceTrustLevel = computeDeviceTrustLevel(request.deviceFingerprint);
  const sessionContinuityHash = computeSessionContinuityHash(userId, request.deviceFingerprint);

  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: request.beneficiaryId, orgId },
  });
  if (!beneficiary) {
    return { status: "failed", error: "Recipient not found." };
  }

  const { intent } = await createIntent({
    orgId,
    userId,
    railsType: "WIRE",
    amountMinor: request.amountMinor,
    currency: request.currency,
    beneficiaryId: request.beneficiaryId,
    purpose: request.purpose || "Wire transfer confirmation",
  });

  if (deviceTrustLevel === "new" && intent.requiredApprovals < 2) {
    const updated = await prisma.intent.update({
      where: { id: intent.id },
      data: {
        requiredApprovals: 2,
        updatedAt: new Date(),
        version: { increment: 1 },
      },
    });
    (intent as any).requiredApprovals = updated.requiredApprovals;
  }

  const { bindingHash } = computeIntentBindingHash({
    id: intent.id,
    orgId: intent.orgId,
    createdByUserId: intent.createdByUserId,
    railsType: intent.railsType,
    amountMinor: intent.amountMinor,
    currency: intent.currency,
    beneficiaryId: intent.beneficiaryId,
    beneficiaryVersion: beneficiary.version,
    purpose: intent.purpose,
  });

  await storeClientConfirmationId({
    orgId,
    userId,
    intentBindingHash: bindingHash,
    clientConfirmationId: request.clientConfirmationId,
    ttlMs: IDEMPOTENCY_TTL_MS,
    intentId: intent.id,
  });

  const policyOutcome =
    beneficiary.version === 1
      ? "This recipient requires verification."
      : intent.requiredApprovals > 1
        ? "We need one more confirmation."
        : null;

  const phrase = generateConfirmPhrase();
  const challenge = await createDynamicChallenge({
    orgId,
    userId,
    intentId: intent.id,
    phrase,
  });

  const session = buildSession({
    orgId,
    userId,
    intentId: intent.id,
    challengeId: challenge.id,
    challengePhrase: phrase,
    clientConfirmationId: request.clientConfirmationId,
    deviceTrustLevel,
    sessionContinuityHash,
    policyOutcome,
  });

  await createSession(session);
  await linkClientConfirmationId({
    orgId,
    userId,
    clientConfirmationId: request.clientConfirmationId,
    sessionId: session.id,
    expiresAt: session.expiresAt,
  });

  await storeClientConfirmationId({
    orgId,
    userId,
    intentBindingHash: bindingHash,
    clientConfirmationId: request.clientConfirmationId,
    ttlMs: IDEMPOTENCY_TTL_MS,
    intentId: intent.id,
    sessionId: session.id,
  });

  return {
    sessionId: session.id,
    challengeId: challenge.id,
    challengePhrase: phrase,
    challengePhraseDisplay: "Confirm",
    intentId: intent.id,
    expiresAt: session.expiresAt,
    state: "voice_required",
    ...(policyOutcome ? { policyOutcome } : {}),
  };
}

export async function submitVoice(params: {
  ctx: { orgId: string; userId: string };
  sessionId: string;
  request: SubmitVoiceRequest;
}): Promise<SubmitVoiceResponse> {
  const { orgId, userId } = params.ctx;
  const session = await getSession(params.sessionId);
  if (!session) {
    return { status: "failed", error: "Session not found." };
  }

  if (session.state !== "voice_required") {
    return { status: "failed", error: `Session is ${session.state}.` };
  }

  const phrase = session.challengePhrase || "";
  const transcript = params.request.transcript?.trim() ?? "";
  if (!isPhraseMatch(phrase, transcript)) {
    if (!session.voiceRetryAttempted) {
      await updateSession(session.id, { voiceRetryAttempted: true });
      return { status: "voice_required", error: "Say the full phrase to confirm.", challengePhrase: phrase };
    }
    await updateSession(session.id, {
      state: "locked",
      lockReason: "voice_verification_failed",
    });
    await createManualReviewCase({
      orgId,
      intentId: session.intentId,
      sessionId: session.id,
      lockReason: "voice_verification_failed",
      requestedByUserId: userId,
    });
    return {
      status: "locked",
      intentId: session.intentId,
      message: "We couldn't verify that. This transfer needs additional confirmation.",
    };
  }

  let proof;
  try {
    proof = await submitProof({
      orgId,
      userId,
      challengeId: session.challengeId || "",
      channel: "BROWSER",
      transcript,
      deviceMetadata: {
        audioBuffer: params.request.audioBuffer,
        deviceFingerprint: params.request.deviceFingerprint,
      },
    });
  } catch (error: any) {
    logger.error("v3 submitVoice proof failed", { error: error?.message, sessionId: session.id });
    await updateSession(session.id, { state: "locked", lockReason: "voice_service_unavailable" });
    await createManualReviewCase({
      orgId,
      intentId: session.intentId,
      sessionId: session.id,
      lockReason: "voice_service_unavailable",
      requestedByUserId: userId,
    });
    await appendIntentEvent({
      intentId: session.intentId,
      orgId,
      eventType: "manual_review.required",
      payload: { reason: "voice_service_unavailable", sessionId: session.id },
      createdByUserId: userId,
      createdAt: new Date(),
    });
    return {
      status: "locked",
      intentId: session.intentId,
      message: "Transfer requires manual review. You'll be notified when it's processed.",
    };
  }

  const intent = await getIntent(orgId, session.intentId);
  if (!intent) return { status: "failed", error: "Transfer not found." };
  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: intent.beneficiaryId, orgId },
    select: { version: true },
  });
  if (beneficiary && intent.beneficiaryVersion !== beneficiary.version) {
    await updateSession(session.id, { state: "locked", lockReason: "beneficiary_version_changed" });
    return {
      status: "locked",
      intentId: intent.id,
      message: "Recipient details changed. Please confirm the transfer again.",
    };
  }

  if (intent.createdByUserId !== userId) {
    await createDecision({
      orgId,
      userId,
      intentId: intent.id,
      decisionType: "APPROVE",
      proofId: proof.id,
    });
  }

  const approvalsCount = await countDistinctApprovals(intent.id, intent.bindingHash);
  if (approvalsCount < intent.requiredApprovals || intent.status === "PENDING_APPROVALS") {
    await updateSession(session.id, { state: "awaiting_confirmation" });
    return {
      status: "awaiting_confirmation",
      intentId: intent.id,
      message: "We've sent a confirmation request to your team. You'll be notified when it's confirmed.",
    };
  }

  if (intent.status !== "APPROVED") {
    await updateSession(session.id, { state: "ready_to_send" });
    await enqueueExecutionRetry({
      orgId,
      userId,
      intentId: intent.id,
      sessionId: session.id,
      clientConfirmationId: session.clientConfirmationId,
    });
    return {
      status: "ready_to_send",
      intentId: intent.id,
      message: "Transfer is ready to send. Processing...",
    };
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
      orgId,
      userId,
      intentId: intent.id,
      approvalToken: approvalToken.token,
      idempotencyKey: session.clientConfirmationId,
    });
    if (!execution.executionRef) {
      throw new Error("Execution reference missing");
    }

    await updateSession(session.id, { state: "sent", transferId: execution.executionRef });
    return {
      status: "sent",
      transferId: execution.executionRef,
      intentId: intent.id,
      sentAt: new Date().toISOString(),
    };
  } catch (error: any) {
    logger.error("v3 submitVoice execute failed", { error: error?.message, sessionId: session.id });
    await updateSession(session.id, { state: "ready_to_send" });
    await enqueueExecutionRetry({
      orgId,
      userId,
      intentId: intent.id,
      sessionId: session.id,
      clientConfirmationId: session.clientConfirmationId,
    });
    return {
      status: "ready_to_send",
      intentId: intent.id,
      message: "Transfer is ready to send. Processing...",
      ...(shouldQueueExecution(error)
        ? { estimatedSendAt: new Date(Date.now() + 5 * 60_000).toISOString() }
        : {}),
    };
  }
}

export async function getSessionStatus(params: {
  ctx: { orgId: string; userId: string };
  sessionId: string;
}): Promise<GetSessionResponse> {
  const { orgId } = params.ctx;
  const session = await getSession(params.sessionId);
  if (session) {
    const derived = await deriveSessionStatusFromIntent({ orgId, intentId: session.intentId });
    if (derived.status !== "failed" && derived.status !== session.state) {
      await updateSession(session.id, {
        state: derived.status,
        transferId: derived.transferId ?? session.transferId ?? null,
      });
    }

    return {
      status: derived.status === "failed" ? session.state : derived.status,
      transferId: derived.transferId ?? session.transferId ?? undefined,
      intentId: session.intentId,
      message: derived.message ?? session.policyOutcome ?? undefined,
      policyOutcome: session.policyOutcome ?? undefined,
      expiresAt: session.expiresAt,
    };
  }

  const intentId = extractIntentIdFromSessionId(params.sessionId);
  if (!intentId) {
    return { status: "failed", intentId: params.sessionId, message: "Session not found." };
  }

  return await deriveSessionStatusFromIntent({ orgId, intentId });
}

export async function cancelSession(params: {
  ctx: { orgId: string; userId: string };
  sessionId: string;
}): Promise<CancelSessionResponse> {
  const { orgId, userId } = params.ctx;
  const session = await getSession(params.sessionId);
  if (!session) {
    return { status: "failed", error: "Session not found." };
  }

  if (session.state === "sent" || session.state === "executing") {
    return { status: "failed", error: "Transfer already sent." };
  }

  if (session.userId !== userId) {
    return { status: "failed", error: "Only the requester can cancel this transfer." };
  }

  await cancelIntent({ orgId, userId, intentId: session.intentId, reason: "User canceled" });
  await updateSession(session.id, { state: "cancelled" });

  return {
    status: "cancelled",
    intentId: session.intentId,
    cancelledAt: new Date().toISOString(),
    message: "Transfer cancelled successfully.",
  };
}
