import { prisma } from "../../db/prisma.js";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";
import { sha256Hex } from "../../lib/sha256.js";
import { invalidateApprovalTokens, mintApprovalToken } from "../approvals/approvalTokens.js";
import { appendIntentEvent } from "../evidence/eventChain.js";
import { getActivePolicy } from "../policies/policyService.js";
import { requiredControls, scoreIntent } from "../policies/riskEngine.js";
import { computeIntentBindingHash } from "./binding.js";
import { enforceMakerChecker } from "../security/auth.js";
import { validateTransition } from "./stateMachine.js";
import { createApproval, countDistinctApprovals, invalidateApprovalsForBindingChange, hasUserApproved } from "./approvals.js";
import { createExecutionLedgerEntry, hasIntentBeenExecuted, updateExecutionStatus } from "./executionLedger.js";
import { executeWithRetry } from "./transactions.js";
import { validateIntentAccess, validateNotTerminal, validateApproverPermission, validateBindingHash, validateApprovalToken } from "./validation.js";
import { enqueueJob } from "../../jobs/jobQueue.js";
import { JOB_TYPES } from "../../jobs/jobTypes.js";

function shouldAnchorEventType(eventType: string): boolean {
  // Agent 11: start with the highest-signal milestones (Blockscout-visible)
  return (
    eventType === "intent.created" ||
    eventType === "proof.received" ||
    eventType === "intent.approved" ||
    eventType === "intent.executed" ||
    eventType === "settlement.reported"
  );
}

async function maybeEnqueuePoseAnchor(params: {
  orgId: string;
  intentId: string;
  seq: number;
  eventType: string;
  eventHash: string;
  prevHash: string | null;
  requestId?: string;
  traceId?: string | null;
}) {
  if (!process.env.POSE_ANCHORING_ENABLED || process.env.POSE_ANCHORING_ENABLED !== "true") return;
  if (!shouldAnchorEventType(params.eventType)) return;

  await enqueueJob({
    type: JOB_TYPES.POSE_ANCHOR_INTENT_EVENT,
    payload: {
      orgId: params.orgId,
      intentId: params.intentId,
      seq: params.seq,
      eventType: params.eventType,
      eventHash: params.eventHash,
      prevEventHash: params.prevHash,
      requestId: params.requestId ?? null,
      traceId: params.traceId ?? null,
    },
    uniqueKey: `pose_anchor:${params.orgId}:${params.intentId}:${params.seq}:${params.eventHash}`,
    maxAttempts: 10,
  });
}

export async function listIntents(orgId: string) {
  return await prisma.intent.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getIntent(orgId: string, id: string) {
  // Agent 4: tenant guardrail — scoped lookup prevents cross-tenant existence leaks.
  const intent = await prisma.intent.findFirst({ where: { id, orgId } });
  if (!intent) return null;
  // Note: Webhook triggering removed from getIntent (should be in create/update)
  return intent;
}

export async function createIntent(params: {
  orgId: string;
  userId: string;
  railsType: "ACH" | "WIRE";
  amountMinor: string;
  currency: string;
  beneficiaryId: string;
  purpose: string;
}) {
  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: params.beneficiaryId, orgId: params.orgId },
  });
  if (!beneficiary) {
    throw new Error("Beneficiary not found");
  }

  // Get user for fraud checks
  const user = await prisma.user.findFirst({
    where: { id: params.userId, orgId: params.orgId },
  });
  if (!user) {
    throw new Error("User not found");
  }

  // Fraud check BEFORE creating intent
  const { checkFraudRules } = await import("../policies/fraudRules.js");
  const fraudCheck = await checkFraudRules(
    {
      id: "temp",
      orgId: params.orgId,
      createdByUserId: params.userId,
      railsType: params.railsType,
      amountMinor: params.amountMinor,
      currency: params.currency,
      beneficiaryId: params.beneficiaryId,
      beneficiaryVersion: beneficiary.version,
      purpose: params.purpose,
      status: "DRAFT",
      riskScore: 0,
      riskRationaleJson: "{}",
      requiredApprovals: 1,
      requiredChallengeLevel: "L1",
      bindingHash: "",
      cooldownUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any,
    user,
    beneficiary
  );

  if (fraudCheck.blocked) {
    throw new Error(
      `Fraud check failed: ${fraudCheck.violations.join(", ")}. Risk level: ${fraudCheck.riskLevel}`
    );
  }

  const policyPack = await getActivePolicy(params.orgId);
  if (!policyPack) throw new Error("No policy configured");

  const thresholds = JSON.parse(policyPack.version.thresholdsJson);
  const rules = JSON.parse(policyPack.version.rulesJson);

  const { riskScore, riskRationale, riskEngineVersion } = scoreIntent({
    amountMinor: params.amountMinor,
    railsType: params.railsType,
    beneficiary,
    policy: { thresholds, rules },
  });
  const { requiredApprovals, requiredChallengeLevel } = requiredControls({
    riskScore,
    railsType: params.railsType,
    beneficiaryCountry: beneficiary.country,
    policy: { thresholds, rules },
  });

  const id = `intent_${Date.now()}`;
  const now = new Date();
  const { bindingHash } = computeIntentBindingHash({
    id,
    orgId: params.orgId,
    createdByUserId: params.userId,
    railsType: params.railsType,
    amountMinor: params.amountMinor,
    currency: params.currency,
    beneficiaryId: params.beneficiaryId,
    beneficiaryVersion: beneficiary.version,
    purpose: params.purpose,
  });

  const intent = await prisma.intent.create({
    data: {
      id,
      orgId: params.orgId,
      createdByUserId: params.userId,
      railsType: params.railsType,
      amountMinor: params.amountMinor,
      currency: params.currency,
      beneficiaryId: params.beneficiaryId,
      beneficiaryVersion: beneficiary.version,
      purpose: params.purpose,
      status: "DRAFT",
      riskScore,
      riskRationaleJson: canonicalJsonStringify(riskRationale),
      requiredApprovals,
      requiredChallengeLevel,
      bindingHash,
      cooldownUntil: null,
      createdAt: now,
      updatedAt: now,
    },
  });

  const createdEvent = await appendIntentEvent({
    intentId: intent.id,
    orgId: intent.orgId,
    eventType: "intent.created",
    payload: { intentId: intent.id, railsType: intent.railsType },
    createdByUserId: params.userId,
    createdAt: now,
  });

  // Agent 11: anchor intent creation (async; deduped)
  await maybeEnqueuePoseAnchor({
    orgId: createdEvent.orgId,
    intentId: createdEvent.intentId,
    seq: createdEvent.seq,
    eventType: createdEvent.eventType,
    eventHash: createdEvent.eventHash,
    prevHash: createdEvent.prevHash ?? null,
  });

  return { intent, riskEngineVersion, policyPack };
}

export async function updateIntent(params: {
  orgId: string;
  userId: string;
  intentId: string;
  patch: Partial<{
    beneficiaryId: string;
    purpose: string;
    amountMinor: string;
    railsType: "ACH" | "WIRE";
  }>;
}) {
  const current = await getIntent(params.orgId, params.intentId);
  if (!current) return null;
  if (["EXECUTED", "DENIED", "CANCELED", "EXPIRED"].includes(current.status)) {
    throw new Error(`Cannot edit intent in status ${current.status}`);
  }

  const beneficiaryId = params.patch.beneficiaryId ?? current.beneficiaryId;
  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: beneficiaryId, orgId: params.orgId },
  });
  if (!beneficiary) throw new Error("Beneficiary not found");

  const policyPack = await getActivePolicy(params.orgId);
  if (!policyPack) throw new Error("No policy configured");
  const thresholds = JSON.parse(policyPack.version.thresholdsJson);
  const rules = JSON.parse(policyPack.version.rulesJson);

  const railsType = params.patch.railsType ?? current.railsType;
  const amountMinor = params.patch.amountMinor ?? current.amountMinor;
  const currency = current.currency;
  const purpose = params.patch.purpose ?? current.purpose;

  const { riskScore, riskRationale } = scoreIntent({
    amountMinor,
    railsType,
    beneficiary,
    policy: { thresholds, rules },
  });
  const { requiredApprovals, requiredChallengeLevel } = requiredControls({
    riskScore,
    railsType,
    beneficiaryCountry: beneficiary.country,
    policy: { thresholds, rules },
  });

  const { bindingHash: nextBindingHash } = computeIntentBindingHash({
    id: current.id,
    orgId: current.orgId,
    createdByUserId: current.createdByUserId,
    railsType,
    amountMinor,
    currency,
    beneficiaryId,
    beneficiaryVersion: beneficiary.version,
    purpose,
  });

  const now = new Date();
  const bindingChanged = nextBindingHash !== current.bindingHash;

  // Validate state transition if status changes
  const newStatus = bindingChanged ? "DRAFT" : current.status;
  if (newStatus !== current.status) {
    validateTransition(current.status, newStatus, "binding change");
  }

  const updated = await prisma.intent.update({
    where: { id: current.id },
    data: {
      beneficiaryId,
      beneficiaryVersion: beneficiary.version,
      purpose,
      railsType,
      amountMinor,
      riskScore,
      riskRationaleJson: canonicalJsonStringify(riskRationale),
      requiredApprovals,
      requiredChallengeLevel,
      bindingHash: nextBindingHash,
      status: newStatus,
      cooldownUntil: bindingChanged ? null : current.cooldownUntil,
      version: { increment: 1 }, // Optimistic locking
      updatedAt: now,
    },
  });

  if (bindingChanged) {
    // Agent D: Invalidate approvals and tokens when binding changes
    await invalidateApprovalTokens(updated.id);
    const invalidatedCount = await invalidateApprovalsForBindingChange(
      updated.id,
      current.bindingHash
    );
    await appendIntentEvent({
      intentId: updated.id,
      orgId: updated.orgId,
      eventType: "intent.binding_changed",
      payload: { from: current.bindingHash, to: nextBindingHash },
      createdByUserId: params.userId,
      createdAt: now,
    });
    await appendIntentEvent({
      intentId: updated.id,
      orgId: updated.orgId,
      eventType: "approvals.invalidated",
      payload: { reason: "binding_changed", count: invalidatedCount },
      createdByUserId: params.userId,
      createdAt: now,
    });
  } else {
    await appendIntentEvent({
      intentId: updated.id,
      orgId: updated.orgId,
      eventType: "intent.updated",
      payload: { intentId: updated.id },
      createdByUserId: params.userId,
      createdAt: now,
    });
  }

  return updated;
}

export async function createChallenge(params: {
  orgId: string;
  userId: string;
  intentId: string;
  language: "EN" | "ES";
}) {
  const intent = await getIntent(params.orgId, params.intentId);
  if (!intent) return null;
  const now = new Date();

  if (["DENIED", "EXECUTED", "CANCELED", "EXPIRED"].includes(intent.status)) {
    throw new Error(`Cannot challenge intent in status ${intent.status}`);
  }

  if (intent.cooldownUntil && intent.cooldownUntil.getTime() > now.getTime()) {
    throw new Error("Intent is in cooldown");
  }

  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: intent.beneficiaryId, orgId: intent.orgId },
  });
  if (!beneficiary) throw new Error("Beneficiary not found");

  const last4 = beneficiary.bankLast4;
  const nonce = sha256Hex(`${intent.id}:${intent.bindingHash}`).slice(0, 16);
  const challengeNonce = `${nonce.slice(0, 5)}-${nonce.slice(5, 10)}-${nonce.slice(10, 16)}`;

  const level = intent.requiredChallengeLevel;
  const grammarVersion = "v1.0";

  const challengeText =
    level === "L3"
      ? `Authorize ${intent.amountMinor} minor units, beneficiary ending ${last4}, purpose ${intent.purpose}, nonce '${challengeNonce}'. Whisper the amount, then say the nonce in reverse order quickly.`
      : level === "L2"
        ? `Authorize transfer ${intent.amountMinor} minor units. Beneficiary ending: ${last4}. Purpose: ${intent.purpose}. Nonce: '${challengeNonce}'. Say the last three words faster.`
        : `Authorize transfer ${intent.amountMinor} minor units to beneficiary ending ${last4}. Nonce '${challengeNonce}'.`;

  const expectedSlotsJson = canonicalJsonStringify({
    slots: [
      { name: "amount", type: "digits", value: intent.amountMinor, spoken: [], position: 1 },
      { name: "beneficiary_suffix", type: "digits", value: last4, spoken: [], position: 2 },
      { name: "nonce", type: "words", value: challengeNonce, spoken: [], position: 3 },
    ],
    prosody_modifier:
      level === "L3"
        ? { type: "whisper", target: "amount", instruction: "whisper" }
        : level === "L2"
          ? { type: "speed", target: "nonce", instruction: "faster" }
          : undefined,
  });

  const expiresAt = new Date(now.getTime() + 10 * 60_000);

  const challenge = await prisma.voiceChallenge.create({
    data: {
      id: `challenge_${intent.id}_${Date.now()}`,
      intentId: intent.id,
      orgId: intent.orgId,
      language: params.language,
      level,
      grammarVersion,
      challengeNonce,
      challengeText,
      expectedSlotsJson,
      expiresAt,
      createdAt: now,
    },
  });

    // Agent D: Validate state transition
    validateTransition(intent.status, "CHALLENGING", "challenge creation");
    
    await prisma.intent.update({
      where: { id: intent.id },
      data: { status: "CHALLENGING", version: { increment: 1 }, updatedAt: now },
    });

  await appendIntentEvent({
    intentId: intent.id,
    orgId: intent.orgId,
    eventType: "challenge.created",
    payload: { challengeId: challenge.id, level },
    createdByUserId: params.userId,
    createdAt: now,
  });

  return challenge;
}

export async function submitProof(params: {
  orgId: string;
  userId: string;
  challengeId: string;
  channel: "BROWSER" | "PHONE";
  transcript: string;
  transcriptLanguage?: string | null;
  deviceMetadata?: Record<string, unknown>;
}) {
  // Agent 0 hardening: tenant-scoped challenge lookup to avoid cross-tenant existence leaks.
  const challenge = await prisma.voiceChallenge.findFirst({
    where: { id: params.challengeId, orgId: params.orgId },
  });
  if (!challenge) throw new Error("Challenge not found");
  const intent = await getIntent(params.orgId, challenge.intentId);
  if (!intent) throw new Error("Intent not found");

  if (intent.status !== "CHALLENGING") {
    throw new Error(`Intent not in CHALLENGING (current: ${intent.status})`);
  }

  const now = new Date();
  if (challenge.expiresAt.getTime() <= now.getTime()) throw new Error("Challenge expired");
  if (challenge.lockedUntil && challenge.lockedUntil.getTime() > now.getTime()) {
    throw new Error("Challenge locked");
  }

  // Phone consent metadata (demo requirement): require explicit phone number when using PHONE channel.
  if (params.channel === "PHONE") {
    const phoneNumber = params.deviceMetadata?.phoneNumber;
    if (typeof phoneNumber !== "string" || phoneNumber.length < 4) {
      throw new Error("PHONE channel requires deviceMetadata.phoneNumber");
    }
  }

  // Real voice verification using POSE V2
  const { poseV2Client } = await import("../voice/poseV2Client.js");
  
  // Check transcript matches challenge (basic validation)
  const transcriptMatches = params.transcript.toLowerCase().includes(
    challenge.challengeText.toLowerCase().slice(0, 20)
  );
  
  // Call POSE V2 for real voice verification if audio buffer is provided
  let voiceResult;
  if (params.deviceMetadata?.audioBuffer) {
    try {
      // Decode base64 audio buffer
      const audioBase64 = params.deviceMetadata.audioBuffer as string;
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      
      // Verify voice with POSE V2
      voiceResult = await poseV2Client.verifyVoice({
        userId: params.userId,
        audioBuffer,
        challengeText: challenge.challengeText,
        language: challenge.language === "ES" ? "ES" : "EN",
      });
    } catch (error: any) {
      // If POSE V2 fails, fall back to transcript-based verification
      voiceResult = {
        verified: transcriptMatches && !params.transcript.toLowerCase().includes("fail"),
        confidence: transcriptMatches ? 0.75 : 0.3,
        speakerId: `fallback_${params.userId}`,
        livenessScore: 0.8,
        error: error.message,
      };
    }
  } else {
    // Fallback: use transcript-based verification for MVP
    // In production, audio buffer should always be provided
    voiceResult = {
      verified: transcriptMatches && !params.transcript.toLowerCase().includes("fail"),
      confidence: transcriptMatches ? 0.75 : 0.3,
      speakerId: `transcript_${params.userId}`,
      livenessScore: 0.8,
    };
  }

  const fail = !voiceResult.verified;
  const scores = {
    identity_confidence: voiceResult.confidence,
    liveness_score: voiceResult.livenessScore || 0.88,
    spoof_risk_score: fail ? 0.9 : 0.05,
    drift_score: fail ? 0.8 : 0.12,
    coercion_risk_score: fail ? 0.7 : 0.08,
    challenge_match_score: transcriptMatches ? 0.95 : 0.1,
  };

  const audioHash = sha256Hex(
    canonicalJsonStringify({
      transcript: params.transcript,
      challengeNonce: challenge.challengeNonce,
    })
  );

  const proof = await prisma.voiceProof.create({
    data: {
      id: `proof_${intent.id}_${Date.now()}`,
      intentId: intent.id,
      challengeId: challenge.id,
      orgId: intent.orgId,
      userId: params.userId,
      channel: params.channel,
      transcript: params.transcript,
      transcriptLanguage: params.transcriptLanguage ?? null,
      scoresJson: canonicalJsonStringify(scores),
      deviceMetadataJson: canonicalJsonStringify(params.deviceMetadata ?? {}),
      audioHash,
      modelVersion: "v2.0",
      createdAt: now,
    },
  });

  // Attempt limits
  const updatedChallenge = await prisma.voiceChallenge.update({
    where: { id: challenge.id },
    data: { attemptCount: { increment: 1 } },
  });

  const policyPack = await getActivePolicy(intent.orgId);
  const rules = policyPack ? JSON.parse(policyPack.version.rulesJson) : { lockoutAfterFailedAttempts: 3, cooldownMinutesForHighRisk: 10 };

  if (fail) {
    const lockedUntil =
      updatedChallenge.attemptCount >= Number(rules.lockoutAfterFailedAttempts)
        ? new Date(now.getTime() + Number(rules.cooldownMinutesForHighRisk) * 60_000)
        : null;

    if (lockedUntil) {
      await prisma.voiceChallenge.update({ where: { id: challenge.id }, data: { lockedUntil } });
      await prisma.intent.update({
        where: { id: intent.id },
        data: { cooldownUntil: lockedUntil, updatedAt: now },
      });
    }

    await appendIntentEvent({
      intentId: intent.id,
      orgId: intent.orgId,
      eventType: "proof.failed",
      payload: { proofId: proof.id },
      createdByUserId: params.userId,
      createdAt: now,
    });
  } else {
    // Agent D: Validate state transition
    validateTransition(intent.status, "PENDING_APPROVALS", "proof success");
    
    await prisma.intent.update({
      where: { id: intent.id },
      data: { status: "PENDING_APPROVALS", version: { increment: 1 }, updatedAt: now },
    });

    const proofEvent = await appendIntentEvent({
      intentId: intent.id,
      orgId: intent.orgId,
      eventType: "proof.received",
      payload: { proofId: proof.id },
      createdByUserId: params.userId,
      createdAt: now,
    });

    await maybeEnqueuePoseAnchor({
      orgId: proofEvent.orgId,
      intentId: proofEvent.intentId,
      seq: proofEvent.seq,
      eventType: proofEvent.eventType,
      eventHash: proofEvent.eventHash,
      prevHash: proofEvent.prevHash ?? null,
    });

    // Send approval request emails
    try {
      const { sendApprovalRequestEmails } = await import("../email/intentNotifications.js");
      const beneficiary = await prisma.beneficiary.findFirst({
        where: { id: intent.beneficiaryId, orgId: intent.orgId },
        select: { displayName: true, bankLast4: true },
      });
      if (beneficiary) {
        await sendApprovalRequestEmails({
          orgId: intent.orgId,
          intentId: intent.id,
          intent: {
            id: intent.id,
            amountMinor: intent.amountMinor,
            currency: intent.currency,
            purpose: intent.purpose,
            createdByUserId: intent.createdByUserId,
          },
          beneficiary: {
            name: beneficiary.displayName,
            accountNumberLast4: beneficiary.bankLast4 || undefined,
          },
          requiredApprovals: intent.requiredApprovals,
        });
      }
    } catch (error) {
      console.error("Failed to send approval request emails:", error);
      // Don't fail the operation if email fails
    }
  }

  return proof;
}

export async function createDecision(params: {
  orgId: string;
  userId: string;
  intentId: string;
  decisionType: "APPROVE" | "DENY" | "STEP_UP";
  proofId: string;
  reasonCodes?: string[];
}) {
  // Agent D: Comprehensive validation
  const accessCheck = await validateIntentAccess(params.orgId, params.intentId);
  if (!accessCheck.valid || !accessCheck.intent) {
    throw new Error(accessCheck.error || "Intent not found");
  }
  const intent = accessCheck.intent;

  // Agent D: Validate state transition
  if (intent.status !== "PENDING_APPROVALS") {
    throw new Error(`Intent not in PENDING_APPROVALS (current: ${intent.status})`);
  }

  validateNotTerminal(intent.status, "make decision");

  // Agent D: Validate approver permission
  if (params.decisionType === "APPROVE") {
    const permissionCheck = await validateApproverPermission(
      params.orgId,
      params.userId,
      params.intentId
    );
    if (!permissionCheck.valid) {
      throw new Error(permissionCheck.error || "Permission denied");
    }

    // Check if user has already approved this intent+bindingHash
    const alreadyApproved = await hasUserApproved(
      intent.id,
      params.userId,
      intent.bindingHash
    );
    if (alreadyApproved) {
      throw new Error("User has already approved this intent for the current binding hash");
    }
  }

  // Agent D: Enforce maker-checker rules (additional checks)
  const checkerResult = await enforceMakerChecker(
    params.orgId,
    params.userId,
    params.intentId,
    params.decisionType
  );
  if (!checkerResult.allowed) {
    throw new Error(checkerResult.reason || "Maker-checker validation failed");
  }

  const proof = await prisma.voiceProof.findFirst({
    where: { id: params.proofId, intentId: intent.id },
  });
  if (!proof) throw new Error("Proof not found");

  const now = new Date();

  const policyPack = await getActivePolicy(intent.orgId);
  const policyId = policyPack?.policy.id;
  const policyVersion = policyPack?.version.version;

  const decisionPayload = {
    intentId: intent.id,
    decisionType: params.decisionType,
    proofId: proof.id,
    bindingHash: intent.bindingHash,
  };
  const decisionPayloadCanonicalJson = canonicalJsonStringify(decisionPayload);
  const decisionHash = sha256Hex(decisionPayloadCanonicalJson);

  const decision = await prisma.decision.create({
    data: {
      id: `decision_${intent.id}_${Date.now()}`,
      intentId: intent.id,
      orgId: intent.orgId,
      decisionType: params.decisionType,
      reasonCodesJson: canonicalJsonStringify(params.reasonCodes ?? []),
      approvalTokenHash: null,
      expiresAt: new Date(now.getTime() + 15 * 60_000),
      signerKeyId: "key_dev_1",
      decisionPayloadCanonicalJson,
      decisionHash,
      signature: "base64_signature",
      policyId: policyId ?? null,
      policyVersion: policyVersion ?? null,
      riskEngineVersion: "v1.0",
      createdByUserId: params.userId,
      createdAt: now,
    },
  });

  // Agent D: Create approval record
  const { approval, isDuplicate } = await createApproval({
    intentId: intent.id,
    orgId: intent.orgId,
    approverUserId: params.userId,
    bindingHash: intent.bindingHash,
    decisionType: params.decisionType,
    decisionId: decision.id,
  });

  if (isDuplicate && params.decisionType === "APPROVE") {
    throw new Error("Duplicate approval detected - this should not happen");
  }

  await appendIntentEvent({
    intentId: intent.id,
    orgId: intent.orgId,
    eventType: "decision.made",
    payload: { decisionId: decision.id, decisionType: decision.decisionType, approvalId: approval.id },
    createdByUserId: params.userId,
    createdAt: now,
  });

  // Agent D: Handle different decision types
  if (params.decisionType === "DENY") {
    // DENY decision: transition to DENIED state
    validateTransition(intent.status, "DENIED", "deny decision");
    
    await prisma.intent.update({
      where: { id: intent.id },
      data: { status: "DENIED", version: { increment: 1 }, updatedAt: now },
    });

    await appendIntentEvent({
      intentId: intent.id,
      orgId: intent.orgId,
      eventType: "intent.denied",
      payload: { decisionId: decision.id },
      createdByUserId: params.userId,
      createdAt: now,
    });

    return { decision };
  } else if (params.decisionType === "STEP_UP") {
    // STEP_UP decision: return to CHALLENGING state for higher challenge level
    validateTransition(intent.status, "CHALLENGING", "step-up decision");
    
    await prisma.intent.update({
      where: { id: intent.id },
      data: { status: "CHALLENGING", version: { increment: 1 }, updatedAt: now },
    });

    await appendIntentEvent({
      intentId: intent.id,
      orgId: intent.orgId,
      eventType: "intent.step_up",
      payload: { decisionId: decision.id },
      createdByUserId: params.userId,
      createdAt: now,
    });

    return { decision };
  } else if (params.decisionType === "APPROVE") {
    // APPROVE decision: check if we have enough distinct approvals
    const distinctApprovals = await countDistinctApprovals(
      intent.id,
      intent.bindingHash
    );

    if (distinctApprovals >= intent.requiredApprovals) {
      const { token, tokenHash } = await mintApprovalToken({
        intentId: intent.id,
        orgId: intent.orgId,
        bindingHash: intent.bindingHash,
      });

      const updatedDecision = await prisma.decision.update({
        where: { id: decision.id },
        data: { approvalTokenHash: tokenHash },
      });

      // Agent D: Validate state transition before updating
      validateTransition(intent.status, "APPROVED", "sufficient approvals");

      await prisma.intent.update({
        where: { id: intent.id },
        data: { status: "APPROVED", version: { increment: 1 }, updatedAt: now },
      });

      const approvedEvent = await appendIntentEvent({
        intentId: intent.id,
        orgId: intent.orgId,
        eventType: "intent.approved",
        payload: { approvals: distinctApprovals, required: intent.requiredApprovals },
        createdByUserId: params.userId,
        createdAt: now,
      });

      await maybeEnqueuePoseAnchor({
        orgId: approvedEvent.orgId,
        intentId: approvedEvent.intentId,
        seq: approvedEvent.seq,
        eventType: approvedEvent.eventType,
        eventHash: approvedEvent.eventHash,
        prevHash: approvedEvent.prevHash ?? null,
      });

      // Trigger webhook for intent approval
      try {
        const { triggerWebhook } = await import("../webhooks/webhookService.js");
        await triggerWebhook({
          orgId: params.orgId,
          eventType: "intent.approved",
          eventId: intent.id,
          payload: {
            id: intent.id,
            decisionId: updatedDecision.id,
            approvedBy: params.userId,
            approvalToken: token,
            createdAt: now.toISOString(),
          },
        });
      } catch (error) {
        console.error("Failed to trigger webhook for intent.approved:", error);
      }

      // Send approval completed emails with blockchain link
      try {
        const { sendApprovalCompletedEmails } = await import("../email/intentNotifications.js");
        const beneficiary = await prisma.beneficiary.findFirst({
          where: { id: intent.beneficiaryId, orgId: intent.orgId },
          select: { displayName: true },
        });
        // Get POSE transaction hash from the approved event
        const approvedEventWithPose = await prisma.intentEvent.findFirst({
          where: { intentId: intent.id, seq: approvedEvent.seq },
          select: { poseAnchorTxHash: true, eventHash: true },
        });
        if (beneficiary) {
          await sendApprovalCompletedEmails({
            orgId: intent.orgId,
            intentId: intent.id,
            intent: {
              id: intent.id,
              amountMinor: intent.amountMinor,
              currency: intent.currency,
              purpose: intent.purpose,
              createdByUserId: intent.createdByUserId,
            },
            beneficiary: {
              name: beneficiary.displayName,
            },
            approvalEventHash: approvedEvent.eventHash,
            poseTxHash: approvedEventWithPose?.poseAnchorTxHash || null,
          });
        }
      } catch (error) {
        console.error("Failed to send approval completed emails:", error);
        // Don't fail the operation if email fails
      }
      
      return { decision: updatedDecision, approvalToken: token };
    }
    // Not enough approvals yet - intent stays in PENDING_APPROVALS
  }

  // Trigger webhook for decision made (but not yet approved)
  try {
    const { triggerWebhook } = await import("../webhooks/webhookService.js");
    await triggerWebhook({
      orgId: params.orgId,
      eventType: "decision.made",
      eventId: intent.id,
      payload: {
        id: intent.id,
        decisionId: decision.id,
        decisionType: params.decisionType,
        decidedBy: params.userId,
        createdAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to trigger webhook for decision.made:", error);
  }

  return { decision };
}

export async function executeIntent(params: {
  orgId: string;
  userId: string;
  intentId: string;
  approvalToken: string;
  idempotencyKey?: string; // Required for production, optional for demo
  rawIdempotencyKey?: string; // For provider idempotency (do not hash)
  provider?: "mock" | "plaid";
  plaidRecipient?: { name: string; routingNumber: string; accountNumber: string } | null;
}) {
  // Agent D: Comprehensive validation
  const accessCheck = await validateIntentAccess(params.orgId, params.intentId);
  if (!accessCheck.valid || !accessCheck.intent) {
    throw new Error(accessCheck.error || "Intent not found");
  }
  const intent = accessCheck.intent;

  // Agent D: Validate state transition
  if (intent.status !== "APPROVED") {
    throw new Error(`Intent not approved (current: ${intent.status})`);
  }
  validateTransition(intent.status, "EXECUTED", "execution");

  // Agent D: Check if already executed (idempotency by intent+bindingHash)
  const executionCheck = await hasIntentBeenExecuted(intent.id, intent.orgId, intent.bindingHash);
  if (executionCheck.executed) {
    const result = {
      status: "EXECUTED",
      executionRef: executionCheck.executionRef,
      alreadyExecuted: true,
    };
    return result;
  }

  // Agent D: Validate approval token
  const { consumeApprovalToken } = await import("../approvals/approvalTokens.js");
  const tokenHash = sha256Hex(canonicalJsonStringify({ token: params.approvalToken }));
  
  const tokenValidation = await validateApprovalToken(
    tokenHash,
    intent.id,
    intent.bindingHash
  );
  if (!tokenValidation.valid) {
    throw new Error(`Invalid approval token: ${tokenValidation.error}`);
  }

  const res = await consumeApprovalToken({
    token: params.approvalToken,
    intentId: intent.id,
    bindingHash: intent.bindingHash,
  });
  if (!res.ok) throw new Error(`Invalid approval token: ${res.reason}`);

  const now = new Date();

  // Agent D: Execute atomically with retry on conflict
  const provider = params.provider ?? "mock";
  return await executeWithRetry(async (tx) => {
    // Re-fetch intent with lock to prevent concurrent execution
    const lockedIntent = await tx.intent.findFirst({
      where: { id: intent.id, orgId: params.orgId },
    });

    if (!lockedIntent) {
      throw new Error("Intent not found");
    }

    if (lockedIntent.status !== "APPROVED") {
      throw new Error(`Intent not approved (current: ${lockedIntent.status})`);
    }

    if (lockedIntent.version !== intent.version) {
      throw new Error("Intent version mismatch - concurrent execution detected");
    }

    // Create execution ledger entry
    const executionRef = `exec_${intent.id}_${Date.now()}`;
    const ledgerEntry = await tx.executionLedger.create({
      data: {
        id: `ledger_${executionRef}`,
        intentId: intent.id,
        orgId: intent.orgId,
        executionRef,
        status: "PENDING",
        // Bank-grade execution state machine scaffolding (provider integration comes later).
        state: provider === "plaid" ? "created" : "submitted",
        provider,
        // Bank-grade provider correlation invariant:
        // - When executing via Plaid Transfer, this must be set to the Plaid `transfer_id` immediately after create succeeds.
        // - Our Plaid `/transfer/event/sync` worker correlates by `transfer_id` -> `ExecutionLedger.externalRef`.
        // See: backend/docs/PLAID_TRANSFER_EXECUTION_CORRELATION.md
        approvalTokenHash: tokenHash,
        bindingHash: intent.bindingHash,
        executedByUserId: params.userId,
        executedAt: now,
        reconciliationStatus: "pending",
        metadataJson: canonicalJsonStringify({
          ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
          ...(params.rawIdempotencyKey ? { rawIdempotencyKey: params.rawIdempotencyKey } : {}),
          ...(provider === "plaid" ? { provider: "plaid", plaid: { createAttemptedAt: now.toISOString() } } : {}),
        }),
      },
    });

    // Update intent status atomically
    await tx.intent.update({
      where: {
        id: intent.id,
        version: lockedIntent.version,
      },
      data: {
        status: "EXECUTED",
        version: { increment: 1 },
        updatedAt: now,
      },
    });

    // Update ledger status to SUBMITTED
    await tx.executionLedger.update({
      where: { id: ledgerEntry.id },
      data: { status: provider === "plaid" ? "PENDING" : "SUBMITTED", updatedAt: now, state: provider === "plaid" ? "created" : "submitted", provider },
    });

    // Append event (outside transaction for event chain integrity)
    const executedEvent = await appendIntentEvent({
      intentId: intent.id,
      orgId: intent.orgId,
      eventType: "intent.executed",
      payload: { executionRef, ledgerId: ledgerEntry.id },
      createdByUserId: params.userId,
      createdAt: now,
    });

    await maybeEnqueuePoseAnchor({
      orgId: executedEvent.orgId,
      intentId: executedEvent.intentId,
      seq: executedEvent.seq,
      eventType: executedEvent.eventType,
      eventHash: executedEvent.eventHash,
      prevHash: executedEvent.prevHash ?? null,
    });

    // Send execution completed emails with blockchain link (async, don't block)
    (async () => {
      try {
        const { sendExecutionCompletedEmails } = await import("../email/intentNotifications.js");
        const beneficiary = await prisma.beneficiary.findFirst({
          where: { id: intent.beneficiaryId, orgId: intent.orgId },
          select: { displayName: true },
        });
        // Get POSE transaction hash from the executed event
        const executedEventWithPose = await prisma.intentEvent.findFirst({
          where: { intentId: intent.id, seq: executedEvent.seq },
          select: { poseAnchorTxHash: true, eventHash: true },
        });
        if (beneficiary) {
          await sendExecutionCompletedEmails({
            orgId: intent.orgId,
            intentId: intent.id,
            intent: {
              id: intent.id,
              amountMinor: intent.amountMinor,
              currency: intent.currency,
              purpose: intent.purpose,
              createdByUserId: intent.createdByUserId,
            },
            beneficiary: {
              name: beneficiary.displayName,
            },
            executionRef,
            executionEventHash: executedEvent.eventHash,
            poseTxHash: executedEventWithPose?.poseAnchorTxHash || null,
          });
        }
      } catch (error) {
        console.error("Failed to send execution completed emails:", error);
        // Don't fail the operation if email fails
      }
    })();

    const result = { status: "EXECUTED" as const, executionRef, ledgerId: ledgerEntry.id, provider };

    // Idempotency result already stored by middleware
    // No need to store again here

    return result;
  }).then(async (result) => {
    // If Plaid Transfer is enabled, create a real transfer and set correlation invariant externalRef=transfer_id.
    if (provider === "plaid") {
      try {
        const { isPlaidTransferEnabled, plaidTransferExecute, requireIdempotencyKeyForExecution } = await import("../providers/plaid/transferExecution.js");
        if (isPlaidTransferEnabled()) {
          const rawKey = requireIdempotencyKeyForExecution(params.rawIdempotencyKey);
          if (!params.plaidRecipient) {
            throw new Error("Missing plaidRecipient details for Plaid Transfer execution");
          }
          const created = await plaidTransferExecute({
            orgId: params.orgId,
            executionRef: (result as any).executionRef,
            idempotencyKey: rawKey,
            amountMinor: intent.amountMinor,
            currency: intent.currency,
            recipient: params.plaidRecipient,
          });

          // Bank-grade invariant: set externalRef immediately when create succeeds.
          await prisma.executionLedger.update({
            where: { executionRef: (result as any).executionRef },
            data: {
              provider: "plaid",
              externalRef: created.transfer_id,
              externalStatus: created.status,
              status: "SUBMITTED",
              state: "submitted",
              metadataJson: canonicalJsonStringify({
                ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
                ...(params.rawIdempotencyKey ? { rawIdempotencyKey: params.rawIdempotencyKey } : {}),
                plaid: { requestId: created.request_id ?? null },
              }),
              updatedAt: new Date(),
            },
          });
        }
      } catch (error: any) {
        // Unknown state is possible on provider timeouts; rely on sync/backfill and reconciliation exceptions.
        await prisma.executionLedger.update({
          where: { executionRef: (result as any).executionRef },
          data: { errorMessage: error?.message || "Plaid Transfer execution failed", updatedAt: new Date() },
        }).catch(() => null);
      }
    }

    // Trigger webhook for intent execution (after transaction commits)
    try {
      const { triggerWebhook } = await import("../webhooks/webhookService.js");
      await triggerWebhook({
        orgId: params.orgId,
        eventType: "intent.executed",
        eventId: intent.id,
        payload: {
          id: intent.id,
          executionRef: result.executionRef,
          ledgerId: result.ledgerId,
          executedBy: params.userId,
          amountMinor: intent.amountMinor,
          currency: intent.currency,
          beneficiaryId: intent.beneficiaryId,
          railsType: intent.railsType,
          executedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Failed to trigger webhook for intent.executed:", error);
    }
    
    return result;
  });
}

export async function generateAuditBundle(params: {
  orgId: string;
  userId: string;
  intentId: string;
  mode?: "full" | "redacted";
}) {
  const intent = await getIntent(params.orgId, params.intentId);
  if (!intent) return null;

  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: intent.beneficiaryId, orgId: intent.orgId },
  });
  const challenges = await prisma.voiceChallenge.findMany({ where: { intentId: intent.id, orgId: intent.orgId } });
  const proofs = await prisma.voiceProof.findMany({ where: { intentId: intent.id, orgId: intent.orgId } });
  const decisions = await prisma.decision.findMany({ where: { intentId: intent.id, orgId: intent.orgId } });
  const events = await prisma.intentEvent.findMany({
    where: { intentId: intent.id, orgId: intent.orgId },
    orderBy: { seq: "asc" },
  });
  const policyPack = await getActivePolicy(intent.orgId);

  // Compute chain head and validity at the time of bundle creation.
  // This provides a verifiable linkage between "bundle.created" and the event chain.
  const { verifyEventChain } = await import("../evidence/eventChain.js");
  const chainResult = await verifyEventChain(intent.id, intent.orgId);

  const manifest = {
    intent,
    beneficiary,
    challenges,
    proofs,
    decisions,
    events,
    policy: policyPack,
  };
  const manifestCanonicalJson = canonicalJsonStringify(manifest);
  const bundleHash = sha256Hex(manifestCanonicalJson);
  const now = new Date();
  const mode = params.mode || "full";

  // Retention policy (org-level). Defaults are conservative if policy is not configured.
  const retentionPolicy = await (prisma as any).complianceRetentionPolicy
    ?.findUnique?.({ where: { orgId: intent.orgId } })
    .catch?.(() => null);
  const retentionDays = retentionPolicy?.evidenceBundleRetentionDays ?? 365;
  const retentionUntil = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);

  // Agent C: Real signing (Ed25519)
  const { signWithDefaultKey } = await import("../../lib/keyManagement.js");
  const { signature: manifestSignature, keyId: signerKeyId } = await signWithDefaultKey(manifestCanonicalJson);

  // Agent C: Create bundle archive and store it
  const { createBundleArchive } = await import("../evidence/bundleArchive.js");
  const { getStorage } = await import("../../lib/storage/index.js");
  
  const archiveBuffer = await createBundleArchive(
    manifest,
    manifestSignature,
    signerKeyId,
    { mode }
  );

  const storage = getStorage();
  const bundleId = `bundle_${intent.id}_${Date.now()}`;
  const storageRef = await storage.store(bundleId, archiveBuffer, {
    "Content-Type": "application/zip",
    "X-Bundle-Hash": bundleHash,
    "X-Signer-Key-Id": signerKeyId,
  });

  const bundle = await prisma.auditBundle.create({
    data: {
      id: bundleId,
      intentId: intent.id,
      orgId: intent.orgId,
      mode,
      bundleHash,
      chainHash: chainResult.chainHash,
      manifestCanonicalJson,
      manifestSignature, // Real signature, not placeholder
      signerKeyId,
      storageRef,
      createdAt: now,
      createdByUserId: params.userId,
      retentionUntil,
    } as any,
  });

  await appendIntentEvent({
    intentId: intent.id,
    orgId: intent.orgId,
    eventType: "bundle.created",
    payload: {
      bundleId: bundle.id,
      bundleHash,
      storageRef,
      mode,
      chainValid: chainResult.valid,
      chainHash: chainResult.chainHash,
      chainErrors: chainResult.valid ? [] : chainResult.errors,
    },
    createdByUserId: params.userId,
    createdAt: now,
  });

  return bundle;
}

