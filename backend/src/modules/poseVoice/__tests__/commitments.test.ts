import { describe, it, expect } from "vitest";
import { createVoiceIdentityCommitmentV1 } from "../commitments.js";

describe("poseVoice commitments", () => {
  it("creates deterministic commitment for identical inputs", () => {
    const a = createVoiceIdentityCommitmentV1({
      poseId: "pose_test",
      enrollmentId: "enroll_test",
      modelVersion: "model_v0",
      embeddingCommitment: "a".repeat(64),
      ihcCommitment: "b".repeat(64),
      policyHash: "c".repeat(64),
    });
    const b = createVoiceIdentityCommitmentV1({
      poseId: "pose_test",
      enrollmentId: "enroll_test",
      modelVersion: "model_v0",
      embeddingCommitment: "a".repeat(64),
      ihcCommitment: "b".repeat(64),
      policyHash: "c".repeat(64),
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when any input changes", () => {
    const base = {
      poseId: "pose_test",
      enrollmentId: "enroll_test",
      modelVersion: "model_v0",
      embeddingCommitment: "a".repeat(64),
      ihcCommitment: "b".repeat(64),
      policyHash: "c".repeat(64),
    };
    const a = createVoiceIdentityCommitmentV1(base);
    const b = createVoiceIdentityCommitmentV1({ ...base, enrollmentId: "enroll_other" });
    expect(a).not.toBe(b);
  });
});

