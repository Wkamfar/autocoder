import { createHash } from "node:crypto";

export type WavPcm = {
  sampleRate: number;
  channels: number;
  samples: Int16Array; // interleaved if channels > 1
};

// Minimal WAV (PCM16/PCM32 float not supported) decoder for browser-recorded WAV.
export function decodeWavPcm16(wav: Buffer): WavPcm {
  // RIFF header
  if (wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Unsupported audio format (expected WAV RIFF)");
  }

  let offset = 12;
  let fmt: { audioFormat: number; channels: number; sampleRate: number; bitsPerSample: number } | null = null;
  let dataOffset = -1;
  let dataSize = -1;

  while (offset + 8 <= wav.length) {
    const chunkId = wav.toString("ascii", offset, offset + 4);
    const chunkSize = wav.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    const next = chunkDataStart + chunkSize + (chunkSize % 2); // word aligned

    if (chunkId === "fmt ") {
      const audioFormat = wav.readUInt16LE(chunkDataStart);
      const channels = wav.readUInt16LE(chunkDataStart + 2);
      const sampleRate = wav.readUInt32LE(chunkDataStart + 4);
      const bitsPerSample = wav.readUInt16LE(chunkDataStart + 14);
      fmt = { audioFormat, channels, sampleRate, bitsPerSample };
    } else if (chunkId === "data") {
      dataOffset = chunkDataStart;
      dataSize = chunkSize;
      break;
    }

    offset = next;
  }

  if (!fmt) throw new Error("Invalid WAV: missing fmt chunk");
  if (dataOffset < 0 || dataSize < 0) throw new Error("Invalid WAV: missing data chunk");
  if (fmt.audioFormat !== 1) throw new Error(`Unsupported WAV encoding (audioFormat=${fmt.audioFormat})`);
  if (fmt.bitsPerSample !== 16) throw new Error(`Unsupported WAV bit depth (${fmt.bitsPerSample}); expected 16`);

  const pcmBytes = wav.subarray(dataOffset, dataOffset + dataSize);
  const samples = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, Math.floor(pcmBytes.length / 2));
  return { sampleRate: fmt.sampleRate, channels: fmt.channels, samples };
}

export function downmixToMono(pcm: WavPcm): Int16Array {
  if (pcm.channels === 1) return pcm.samples;
  const frames = Math.floor(pcm.samples.length / pcm.channels);
  const out = new Int16Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < pcm.channels; c++) sum += pcm.samples[i * pcm.channels + c]!;
    out[i] = Math.round(sum / pcm.channels);
  }
  return out;
}

export function rmsDb(samples: Int16Array): number {
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i]! / 32768;
    sumSq += x * x;
  }
  const mean = sumSq / Math.max(1, samples.length);
  const rms = Math.sqrt(mean);
  const db = 20 * Math.log10(Math.max(1e-9, rms));
  return db;
}

/**
 * Very lightweight onset detector: finds first window whose RMS exceeds
 * a threshold derived from early noise floor.
 */
export function detectOnsetMs(params: {
  mono: Int16Array;
  sampleRate: number;
  windowMs?: number;
  noiseWindowMs?: number;
  thresholdDbAboveNoise?: number;
  minOnsetMs?: number;
}): { onsetMs: number | null; noiseDb: number; speechDb: number } {
  const windowMs = params.windowMs ?? 20;
  const noiseWindowMs = params.noiseWindowMs ?? 250;
  const thresholdDbAboveNoise = params.thresholdDbAboveNoise ?? 12;

  const win = Math.max(1, Math.floor((params.sampleRate * windowMs) / 1000));
  const noiseN = Math.max(win, Math.floor((params.sampleRate * noiseWindowMs) / 1000));
  const noiseSlice = params.mono.subarray(0, Math.min(params.mono.length, noiseN));
  const noiseDb = rmsDb(noiseSlice);

  const thresholdDb = noiseDb + thresholdDbAboveNoise;
  let bestSpeechDb = noiseDb;

  const startSample = params.minOnsetMs ? Math.floor((params.minOnsetMs / 1000) * params.sampleRate) : 0;
  for (let i = Math.max(0, startSample); i + win <= params.mono.length; i += win) {
    const slice = params.mono.subarray(i, i + win);
    const db = rmsDb(slice);
    if (db > bestSpeechDb) bestSpeechDb = db;
    if (db >= thresholdDb) {
      const onsetMs = (i / params.sampleRate) * 1000;
      return { onsetMs, noiseDb, speechDb: bestSpeechDb };
    }
  }

  return { onsetMs: null, noiseDb, speechDb: bestSpeechDb };
}

/**
 * Deterministic, lightweight embedding placeholder:
 * take a short segment after onset, downsample by stride, quantize, hash.
 * This is NOT a production-grade speaker embedding — it's a stable placeholder.
 */
export function quantizedEmbeddingBytes(params: {
  mono: Int16Array;
  sampleRate: number;
  onsetMs: number;
  segmentMs?: number;
  stride?: number;
}): Buffer {
  const segmentMs = params.segmentMs ?? 1200;
  const stride = params.stride ?? 4;
  const start = Math.floor((params.onsetMs / 1000) * params.sampleRate);
  const end = Math.min(params.mono.length, start + Math.floor((segmentMs / 1000) * params.sampleRate));
  const seg = params.mono.subarray(Math.max(0, start), Math.max(0, end));

  const out = Buffer.alloc(Math.max(1, Math.floor(seg.length / stride)));
  let j = 0;
  for (let i = 0; i < seg.length && j < out.length; i += stride) {
    // Quantize int16 -> int8-ish bucket (0..255)
    const v = seg[i]!; // -32768..32767
    const q = Math.max(0, Math.min(255, Math.floor((v + 32768) / 256)));
    out[j++] = q;
  }
  return out.subarray(0, j);
}

export function sha256HexOfBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

