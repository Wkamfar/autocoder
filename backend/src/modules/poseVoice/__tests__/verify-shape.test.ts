import { describe, it, expect } from "vitest";
import { verifyAgainstVoiceProfile } from "../service.js";

function encodeWav16(params: { samples: Int16Array; sampleRate: number }): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = params.sampleRate * blockAlign;
  const dataSize = params.samples.length * 2;

  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0, 4, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, 4, "ascii");
  buf.write("fmt ", 12, 4, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(params.sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write("data", 36, 4, "ascii");
  buf.writeUInt32LE(dataSize, 40);

  let o = 44;
  for (let i = 0; i < params.samples.length; i++) {
    buf.writeInt16LE(params.samples[i]!, o);
    o += 2;
  }
  return buf;
}

describe("poseVoice verify response shape", () => {
  it("returns expected keys and value ranges", () => {
    // 2s silence then 1s of a simple tone-like waveform.
    const sr = 16000;
    const silence = new Int16Array(sr * 2);
    const speech = new Int16Array(sr * 1);
    for (let i = 0; i < speech.length; i++) {
      const t = i / sr;
      speech[i] = Math.round(Math.sin(2 * Math.PI * 220 * t) * 12000);
    }
    const samples = new Int16Array(silence.length + speech.length);
    samples.set(silence, 0);
    samples.set(speech, silence.length);
    const wav = encodeWav16({ samples, sampleRate: sr });

    const res = verifyAgainstVoiceProfile({
      profile: { voiceIdentityCommitment: "a".repeat(64), modelVersion: "local_quant_v0", voiceProfileVersion: 1 },
      wavAudio: wav,
      toneDurationMs: 2000,
    });

    expect(res).toHaveProperty("voice_similarity_score");
    expect(res).toHaveProperty("presence_score");
    expect(res).toHaveProperty("final_score");
    expect(res).toHaveProperty("decision");
    expect(res).toHaveProperty("explanation");
    expect(res).toHaveProperty("model_version");
    expect(res).toHaveProperty("voice_profile_version");

    expect(res.voice_similarity_score).toBeGreaterThanOrEqual(0);
    expect(res.voice_similarity_score).toBeLessThanOrEqual(1);
    expect(res.presence_score).toBeGreaterThanOrEqual(0);
    expect(res.presence_score).toBeLessThanOrEqual(1);
    expect(res.final_score).toBeGreaterThanOrEqual(0);
    expect(res.final_score).toBeLessThanOrEqual(1);
    expect(["pass", "fail"]).toContain(res.decision);
  });
});

