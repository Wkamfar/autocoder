import { createHash, createHmac } from "node:crypto";

export function sha256HexBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256HexText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function hmacSha256Hex(secret: Buffer, message: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

/**
 * Versioned, non-reversible voice identity commitment.
 * Uses an explicit delimiter to avoid concat ambiguity.
 */
export function createVoiceIdentityCommitmentV1(params: {
  poseId: string;
  enrollmentId: string;
  modelVersion: string;
  embeddingCommitment: string; // sha256 hex
  ihcCommitment: string; // sha256 hex
  policyHash: string; // sha256 hex
}): string {
  const payload = [
    "voice_commitment_v1",
    params.poseId,
    params.enrollmentId,
    params.modelVersion,
    params.embeddingCommitment,
    params.ihcCommitment,
    params.policyHash,
  ].join("|");
  return sha256HexText(payload);
}

