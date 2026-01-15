import { useCallback, useMemo, useState } from "react";

type VoiceWriteGateStatus =
  | "idle"
  | "requesting_mic"
  | "recording"
  | "verifying"
  | "verified"
  | "error";

const STORAGE_KEY = "pose_crm_write_gate";

type StoredGate = {
  token: string;
  expiresAt: number;
  voiceSessionId?: string;
};

function readStored(): StoredGate | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGate;
    if (!parsed?.token || !parsed?.expiresAt) return null;
    if (Date.now() > parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(next: StoredGate) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function clearStored() {
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Minimal “voice write gate” implementation used by CRM panels.
 * This is intentionally lightweight: it simulates a verification flow and
 * produces a short-lived in-tab token suitable for attaching to write requests.
 */
export function useVoiceWriteGate() {
  const stored = readStored();
  const [status, setStatus] = useState<VoiceWriteGateStatus>(stored ? "verified" : "idle");
  const [message, setMessage] = useState<string>(
    stored ? "Voice verified. Write token active." : "Voice verification required for sensitive writes."
  );
  const [error, setError] = useState<unknown>(null);

  const crmWriteToken = stored?.token ?? null;
  const expiresAt = stored?.expiresAt ?? null;
  const voiceSessionId = stored?.voiceSessionId ?? null;

  const reset = useCallback(() => {
    clearStored();
    setStatus("idle");
    setError(null);
    setMessage("Voice verification required for sensitive writes.");
  }, []);

  const verify = useCallback(async () => {
    try {
      setError(null);
      setStatus("requesting_mic");
      setMessage("Requesting microphone…");

      // Best-effort mic permission check; no hard dependency on recording.
      if (navigator?.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
      }

      setStatus("recording");
      setMessage("Recording…");
      await new Promise((r) => setTimeout(r, 700));

      setStatus("verifying");
      setMessage("Verifying…");
      await new Promise((r) => setTimeout(r, 700));

      const token = `crm_write_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      const next: StoredGate = {
        token,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        voiceSessionId: `voice_${Date.now()}`,
      };

      writeStored(next);
      setStatus("verified");
      setMessage("Voice verified. Write token active.");
      return next;
    } catch (e) {
      setStatus("error");
      setError(e);
      setMessage("Voice verification failed.");
      return null;
    }
  }, []);

  return {
    status,
    message,
    error,
    crmWriteToken,
    expiresAt,
    voiceSessionId,
    verify,
    reset,
  };
}

export function useVoiceGatedFetch() {
  const gate = useVoiceWriteGate();

  const hasValidToken = useMemo(() => {
    const stored = readStored();
    return Boolean(stored?.token && stored.expiresAt && Date.now() < stored.expiresAt);
  }, [gate.status]);

  const run = useCallback(
    async (endpoint: string, init: RequestInit = {}): Promise<Response> => {
      const stored = readStored();
      const headers = new Headers(init.headers || {});
      if (stored?.token) {
        headers.set("X-CRM-WRITE-TOKEN", stored.token);
      }
      return fetch(endpoint, { ...init, headers });
    },
    []
  );

  return { run, hasValidToken };
}

