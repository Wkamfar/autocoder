import { useCallback, useRef, useState } from "react";

type RecorderState = "idle" | "requesting_mic" | "recording" | "stopping" | "error";

function encodeWav16(params: { samples: Float32Array; sampleRate: number }): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = params.sampleRate * blockAlign;

  const dataSize = params.samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");

  // fmt chunk
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, params.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // PCM samples
  let offset = 44;
  for (let i = 0; i < params.samples.length; i++) {
    const s = Math.max(-1, Math.min(1, params.samples[i]!));
    const v = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, Math.round(v), true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

export function useWavRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [level, setLevel] = useState<number>(0);
  const [sampleRate, setSampleRate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);

  const start = useCallback(async () => {
    setError(null);
    setState("requesting_mic");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      setSampleRate(ctx.sampleRate);

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      // ScriptProcessor is deprecated but still widely supported; acceptable for lightweight capture.
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      chunksRef.current = [];

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));
      };

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(ctx.destination); // required to start processing in some browsers

      const buf = new Uint8Array(analyser.fftSize);
      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        // RMS level in [0..1]
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const x = (buf[i]! - 128) / 128;
          sum += x * x;
        }
        const rms = Math.sqrt(sum / buf.length);
        setLevel(rms);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

      setState("recording");
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Microphone access failed");
      throw e;
    }
  }, []);

  const stop = useCallback(async (): Promise<{ wav: Blob; sampleRate: number }> => {
    if (state !== "recording") throw new Error("Not recording");
    setState("stopping");

    const ctx = ctxRef.current;
    const stream = streamRef.current;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    try {
      processorRef.current?.disconnect();
      analyserRef.current?.disconnect();
      sourceRef.current?.disconnect();

      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      const sampleRate = ctx?.sampleRate ?? 48000;
      setSampleRate(sampleRate);
      await ctx?.close();
      ctxRef.current = null;

      const chunks = chunksRef.current;
      const total = chunks.reduce((acc, c) => acc + c.length, 0);
      const merged = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        merged.set(c, off);
        off += c.length;
      }

      const wav = encodeWav16({ samples: merged, sampleRate });
      setState("idle");
      return { wav, sampleRate };
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Failed to stop recording");
      throw e;
    }
  }, [state]);

  const cleanup = useCallback(async () => {
    try {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      processorRef.current?.disconnect();
      analyserRef.current?.disconnect();
      sourceRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      await ctxRef.current?.close();
      ctxRef.current = null;
    } finally {
      setState("idle");
    }
  }, []);

  return { state, level, sampleRate, error, start, stop, cleanup };
}

