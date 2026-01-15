import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { createVoiceIdentityCommitmentV1, hmacSha256Hex, sha256HexText } from "./commitments.js";
import { generateUniquePhrase } from "./phrase.js";
import { decodeWavPcm16, detectOnsetMs, downmixToMono, quantizedEmbeddingBytes, sha256HexOfBytes } from "./audio.js";
import { encryptToBase64url, getEmbeddingKey } from "./cryptoBox.js";

export type PoseVoiceEnrollStartResponse = {
  enrollment_id: string;
  pose_id: string;
  challenge: {
    ihc_prompt: {
      tone_duration_ms: number;
      boundary_rule: "WAIT_FOR_TONE_END_THEN_SPEAK";
    };
    phrase: string;
    pose_challenge_id: string;
    policy_version: string;
  };
};

export type PoseVoiceEnrollCompleteResponse = {
  pose_id: string;
  voice_identity_commitment: string;
  voice_profile_version: string;
  public_identity_handle?: string;
};

export type PoseVoiceVerifyResponse = {
  voice_similarity_score: number;
  presence_score: number;
  liveness_score: number | null;
  final_score: number;
  decision: "pass" | "fail";
  explanation: string;
  model_version: string;
  voice_profile_version: string;
};

export function verifyAgainstVoiceProfile(params: {
  profile: { voiceIdentityCommitment: string; modelVersion: string; voiceProfileVersion: number };
  wavAudio: Buffer;
  toneDurationMs?: number | null;
}): PoseVoiceVerifyResponse {
  const profile = params.profile;

  const pcm = decodeWavPcm16(params.wavAudio);
  const mono = downmixToMono(pcm);
  const onset = detectOnsetMs({ mono, sampleRate: pcm.sampleRate });
  const onsetMs = onset.onsetMs ?? 0;
  const emb = quantizedEmbeddingBytes({ mono, sampleRate: pcm.sampleRate, onsetMs });
  const embCommit = sha256HexOfBytes(emb);

  const voiceSimilarity = hashPrefixSimilarity(profile.voiceIdentityCommitment, embCommit);

  const expectedToneMs = params.toneDurationMs ?? null;
  const presenceScore =
    expectedToneMs == null
      ? 0.5
      : scorePresence({
          expectedToneMs,
          onsetMs,
        });

  const final = 0.6 * voiceSimilarity + 0.4 * presenceScore;
  const pass = final >= 0.78 && presenceScore >= 0.55;

  return {
    voice_similarity_score: clamp01(voiceSimilarity),
    presence_score: clamp01(presenceScore),
    liveness_score: null,
    final_score: clamp01(final),
    decision: pass ? "pass" : "fail",
    explanation: pass ? "Verified." : "We couldn't verify a clean match.",
    model_version: profile.modelVersion,
    voice_profile_version: `v${profile.voiceProfileVersion}`,
  };
}

function getPolicyVersion(): string {
  return process.env.POSE_VOICE_POLICY_VERSION || "pose_voice_policy_v1";
}

function getChallengeSecret(): Buffer {
  const raw = process.env.POSE_CHALLENGE_SECRET;
  if (raw) return Buffer.from(raw, "base64url");
  // Fall back to random-but-stable-ish secret in dev; in prod set env explicitly.
  const fallback = process.env.SIGNING_PRIVATE_KEY;
  if (fallback) return Buffer.from(fallback, "base64url");
  return Buffer.from("dev_pose_challenge_secret", "utf8");
}

function newPoseId(): string {
  // base64url 16 bytes, stable prefix
  return `pose_${randomBytes(16).toString("base64url")}`;
}

function toneDurationMs(): number {
  const n = Number(process.env.POSE_IHC_TONE_MS || "2000");
  return Number.isFinite(n) && n >= 800 && n <= 5000 ? Math.floor(n) : 2000;
}

export async function getPoseVoiceStatus(userId: string): Promise<{
  has_pose_identity: boolean;
  pose_id?: string;
  voice_profile_version?: string;
}> {
  // Defensive: some deployments may not have the POSE identity tables migrated yet.
  // In that case, treat the feature as unavailable rather than throwing a 500.
  const identity = await prisma.poseIdentity
    .findUnique({ where: { userId } })
    .catch(() => null);
  if (!identity || identity.status !== "ACTIVE") return { has_pose_identity: false };
  const latest = await prisma.poseVoiceProfile
    .findFirst({
      where: { poseId: identity.poseId },
      orderBy: [{ voiceProfileVersion: "desc" }],
    })
    .catch(() => null);
  if (!latest) return { has_pose_identity: true, pose_id: identity.poseId };
  return {
    has_pose_identity: true,
    pose_id: identity.poseId,
    voice_profile_version: `v${latest.voiceProfileVersion}`,
  };
}

export async function enrollStart(params: { userId: string }): Promise<PoseVoiceEnrollStartResponse> {
  const policyVersion = getPolicyVersion();
  const secret = getChallengeSecret();
  const toneMs = toneDurationMs();

  // Create PoseIdentity if needed
  const identity =
    (await prisma.poseIdentity.findUnique({ where: { userId: params.userId } })) ??
    (await prisma.poseIdentity.create({
      data: {
        poseId: newPoseId(),
        userId: params.userId,
        status: "ACTIVE",
      },
    }));

  const enrollmentId = `enroll_${randomUUID()}`;
  const phrase = generateUniquePhrase(10);
  const poseChallengeId = hmacSha256Hex(
    secret,
    ["pose_voice_enroll", identity.poseId, enrollmentId, policyVersion, phrase].join("|")
  );

  // Store enrollment record without storing the plaintext phrase.
  await prisma.poseVoiceEnrollment.create({
    data: {
      id: enrollmentId,
      poseId: identity.poseId,
      challengeId: poseChallengeId,
      policyVersion,
      toneDurationMs: toneMs,
      takesMetadataJson: JSON.stringify({}),
      qualityMetricsJson: JSON.stringify({}),
      clientMetadataJson: JSON.stringify({}),
      createdAt: new Date(),
    },
  });

  return {
    enrollment_id: enrollmentId,
    pose_id: identity.poseId,
    challenge: {
      ihc_prompt: {
        tone_duration_ms: toneMs,
        boundary_rule: "WAIT_FOR_TONE_END_THEN_SPEAK",
      },
      phrase,
      pose_challenge_id: poseChallengeId,
      policy_version: policyVersion,
    },
  };
}

export async function enrollComplete(params: {
  userId: string;
  enrollmentId: string;
  poseId: string;
  poseChallengeId: string;
  takes: Array<{ buffer: Buffer; filename?: string; mimeType?: string; label: string }>;
  clientMetadata: Record<string, unknown>;
  consentFlags: Record<string, boolean>;
}): Promise<PoseVoiceEnrollCompleteResponse> {
  const enrollment = await prisma.poseVoiceEnrollment.findUnique({ where: { id: params.enrollmentId } });
  if (!enrollment) throw new Error("Enrollment not found");
  if (enrollment.poseId !== params.poseId) throw new Error("Enrollment pose_id mismatch");
  if (enrollment.challengeId !== params.poseChallengeId) throw new Error("Enrollment challenge mismatch");

  const identity = await prisma.poseIdentity.findUnique({ where: { poseId: params.poseId } });
  if (!identity || identity.userId !== params.userId) throw new Error("Pose identity not found");
  if (identity.status !== "ACTIVE") throw new Error("Pose identity is not active");

  const policyHash = sha256HexText(enrollment.policyVersion);
  const modelVersion = process.env.POSE_VOICE_MODEL_VERSION || "local_quant_v0";

  // Process takes: pick the best onset (for IHC) + aggregate embedding bytes.
  const takeResults = params.takes.map((t) => {
    const pcm = decodeWavPcm16(t.buffer);
    const mono = downmixToMono(pcm);
    const onset =
      t.label === "ihc"
        ? detectOnsetMs({ mono, sampleRate: pcm.sampleRate, minOnsetMs: enrollment.toneDurationMs - 50 })
        : detectOnsetMs({ mono, sampleRate: pcm.sampleRate });
    const onsetMs = onset.onsetMs;
    const db = rmsDbSafe(mono);
    return { label: t.label, pcm, mono, onset, onsetMs, rmsDb: db };
  });

  const ihcTake = takeResults.find((t) => t.label === "ihc") ?? takeResults[0]!;
  if (!ihcTake.onsetMs && params.takes.length) {
    throw new Error("We couldn't capture a clean start.");
  }

  const onsetMs = ihcTake.onsetMs ?? 0;
  const expectedToneMs = enrollment.toneDurationMs;
  const onsetDeltaMs = onsetMs - expectedToneMs;

  // IHC feature bytes (timing/onset)
  const timingBytes = Buffer.from(
    JSON.stringify({
      expectedToneMs,
      onsetMs,
      onsetDeltaMs,
      noiseDb: ihcTake.onset.noiseDb,
      speechDb: ihcTake.onset.speechDb,
    }),
    "utf8"
  );
  const ihcCommitment = sha256HexOfBytes(timingBytes);

  // Embedding placeholder: concatenate quantized bytes from each take (cap size)
  const embeddingParts: Buffer[] = [];
  for (const t of takeResults) {
    const em = quantizedEmbeddingBytes({
      mono: t.mono,
      sampleRate: t.pcm.sampleRate,
      onsetMs: t.onsetMs ?? 0,
    });
    embeddingParts.push(em);
  }
  const embeddingBytes = Buffer.concat(embeddingParts).subarray(0, 4096);
  const embeddingCommitment = sha256HexOfBytes(embeddingBytes);

  const voiceCommitment = createVoiceIdentityCommitmentV1({
    poseId: params.poseId,
    enrollmentId: params.enrollmentId,
    modelVersion,
    embeddingCommitment,
    ihcCommitment,
    policyHash,
  });

  // Encrypt embedding blob if key is available; otherwise store null and rely on commitments.
  const key = getEmbeddingKey();
  const embeddingBlobEncrypted = key
    ? encryptToBase64url(
        key,
        Buffer.from(
          JSON.stringify({
            embeddingBytesB64: embeddingBytes.toString("base64"),
          }),
          "utf8"
        )
      )
    : null;

  const latest = await prisma.poseVoiceProfile.findFirst({
    where: { poseId: params.poseId },
    orderBy: [{ voiceProfileVersion: "desc" }],
  });
  const nextVersion = (latest?.voiceProfileVersion ?? 0) + 1;

  // Update enrollment record with metadata.
  await prisma.poseVoiceEnrollment.update({
    where: { id: params.enrollmentId },
    data: {
      takesMetadataJson: JSON.stringify(
        takeResults.map((t) => ({
          label: t.label,
          sampleRate: t.pcm.sampleRate,
          channels: t.pcm.channels,
          onsetMs: t.onsetMs,
          rmsDb: t.rmsDb,
        }))
      ),
      qualityMetricsJson: JSON.stringify({
        ihc: {
          onsetMs,
          expectedToneMs,
          onsetDeltaMs,
          noiseDb: ihcTake.onset.noiseDb,
          speechDb: ihcTake.onset.speechDb,
        },
      }),
      clientMetadataJson: JSON.stringify({
        ...params.clientMetadata,
        consentFlags: params.consentFlags,
      }),
    },
  });

  await prisma.poseVoiceProfile.create({
    data: {
      poseId: params.poseId,
      voiceProfileVersion: nextVersion,
      voiceIdentityCommitment: voiceCommitment,
      embeddingBlobEncrypted: embeddingBlobEncrypted ?? undefined,
      ihcFeatureCommitment: ihcCommitment,
      modelVersion,
      policyVersion: enrollment.policyVersion,
      consentFlagsJson: JSON.stringify(params.consentFlags),
      createdAt: new Date(),
    },
  });

  // Mark user as voice-enrolled for existing UI assumptions.
  await prisma.user.update({
    where: { id: params.userId },
    data: {
      voiceEnrolled: true,
      enrolledAt: new Date(),
    },
  });

  return {
    pose_id: params.poseId,
    voice_identity_commitment: voiceCommitment,
    voice_profile_version: `v${nextVersion}`,
  };
}

export async function verifyVoice(params: {
  userId: string;
  poseId: string;
  audio: Buffer;
  toneDurationMs?: number | null;
}): Promise<PoseVoiceVerifyResponse> {
  const identity = await prisma.poseIdentity.findUnique({ where: { poseId: params.poseId } });
  if (!identity || identity.userId !== params.userId) throw new Error("Pose identity not found");
  if (identity.status !== "ACTIVE") throw new Error("Pose identity is not active");

  const profile = await prisma.poseVoiceProfile.findFirst({
    where: { poseId: params.poseId },
    orderBy: [{ voiceProfileVersion: "desc" }],
  });
  if (!profile) throw new Error("No voice profile found");

  return verifyAgainstVoiceProfile({
    profile: {
      voiceIdentityCommitment: profile.voiceIdentityCommitment,
      modelVersion: profile.modelVersion,
      voiceProfileVersion: profile.voiceProfileVersion,
    },
    wavAudio: params.audio,
    toneDurationMs: params.toneDurationMs ?? null,
  });
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function hashPrefixSimilarity(aHex: string, bHex: string): number {
  const a = aHex.slice(0, 16);
  const b = bHex.slice(0, 16);
  let same = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) same++;
  return same / 16;
}

function scorePresence(params: { expectedToneMs: number; onsetMs: number }): number {
  // Score best when onset happens shortly AFTER expected tone end, with some human jitter.
  const delta = params.onsetMs - params.expectedToneMs;
  // If they speak before tone end, penalize hard.
  if (delta < -150) return 0.0;
  // Ideal 100ms..900ms after tone.
  if (delta >= 100 && delta <= 900) return 1.0;
  // Fade outside that window.
  const dist = Math.min(Math.abs(delta - 500), 2000);
  return clamp01(1 - dist / 2000);
}

function rmsDbSafe(mono: Int16Array): number {
  // reuse a tiny slice to avoid O(n) twice in hot path
  const len = Math.min(mono.length, 48000);
  let sumSq = 0;
  for (let i = 0; i < len; i++) {
    const x = mono[i]! / 32768;
    sumSq += x * x;
  }
  const rms = Math.sqrt(sumSq / Math.max(1, len));
  return 20 * Math.log10(Math.max(1e-9, rms));
}

