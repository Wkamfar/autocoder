import type {
  Beneficiary,
  Decision,
  Intent,
  Policy,
  PolicyVersion,
  ServiceHealth,
  VoiceChallenge,
  VoiceProof,
} from "@prisma/client";

export function parseJson<T>(json: string): T {
  return JSON.parse(json) as T;
}

export function asTransferIntent(i: Intent) {
  return {
    id: i.id,
    orgId: i.orgId,
    createdByUserId: i.createdByUserId,
    railsType: i.railsType,
    amountMinor: i.amountMinor,
    currency: i.currency,
    beneficiaryId: i.beneficiaryId,
    beneficiaryVersion: i.beneficiaryVersion ?? undefined,
    purpose: i.purpose,
    status: i.status,
    riskScore: i.riskScore,
    riskRationaleJson: parseJson(i.riskRationaleJson),
    requiredApprovals: i.requiredApprovals,
    requiredChallengeLevel: i.requiredChallengeLevel,
    bindingHash: i.bindingHash,
    cooldownUntil: i.cooldownUntil ? i.cooldownUntil.toISOString() : null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

export function asBeneficiary(b: Beneficiary) {
  return {
    id: b.id,
    orgId: b.orgId,
    displayName: b.displayName,
    country: b.country,
    railsAllowed: b.railsAllowed,
    bankLast4: b.bankLast4,
    bankTokenHash: b.bankTokenHash,
    version: b.version,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    lastChangedAt: b.lastChangedAt.toISOString(),
    lastChangedBy: b.lastChangedBy,
  };
}

export function asVoiceChallenge(c: VoiceChallenge) {
  return {
    id: c.id,
    intentId: c.intentId,
    language: c.language,
    level: c.level,
    grammarVersion: c.grammarVersion,
    challengeNonce: c.challengeNonce,
    challengeText: c.challengeText,
    expectedSlotsJson: parseJson(c.expectedSlotsJson),
    expiresAt: c.expiresAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
  };
}

export function asVoiceProof(p: VoiceProof) {
  return {
    id: p.id,
    intentId: p.intentId,
    challengeId: p.challengeId,
    userId: p.userId,
    channel: p.channel,
    transcript: p.transcript,
    transcriptLanguage: p.transcriptLanguage,
    scoresJson: parseJson(p.scoresJson),
    deviceMetadataJson: parseJson(p.deviceMetadataJson),
    audioEncryptedRef: p.audioEncryptedRef ?? undefined,
    audioHash: p.audioHash ?? undefined,
    modelVersion: p.modelVersion ?? undefined,
    createdAt: p.createdAt.toISOString(),
  };
}

export function asDecision(d: Decision) {
  return {
    id: d.id,
    intentId: d.intentId,
    decisionType: d.decisionType,
    reasonCodesJson: parseJson(d.reasonCodesJson),
    approvalTokenHash: d.approvalTokenHash ?? null,
    expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
    signerKeyId: d.signerKeyId,
    decisionPayloadCanonicalJson: d.decisionPayloadCanonicalJson,
    decisionHash: d.decisionHash,
    signature: d.signature,
    policyId: d.policyId ?? undefined,
    policyVersion: d.policyVersion ?? undefined,
    riskEngineVersion: d.riskEngineVersion ?? undefined,
    createdByUserId: d.createdByUserId,
    createdAt: d.createdAt.toISOString(),
  };
}

export function asActivePolicy(policy: Policy, version: PolicyVersion) {
  return {
    policyId: policy.id,
    version: version.version,
    effectiveAt: version.effectiveAt.toISOString(),
    thresholds: parseJson(version.thresholdsJson),
    rules: parseJson(version.rulesJson),
  };
}

export function asServiceHealth(row: ServiceHealth) {
  return {
    voiceService: row.voiceService,
    phoneService: row.phoneService,
    storageService: row.storageService,
  };
}

