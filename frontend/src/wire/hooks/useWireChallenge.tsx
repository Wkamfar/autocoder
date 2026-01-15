import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ChallengeStatus,
  VoiceChallenge,
  VoiceProof,
  VoiceScores,
} from "../types/wire";
import { api } from "../api";

export interface UseWireChallengeOptions {
  challengeId: string;
  intentId: string;
  language?: "EN" | "ES";
}

export interface UseWireChallengeResult {
  status: ChallengeStatus;
  challenge: VoiceChallenge | null;
  transcript: string;
  scores: VoiceScores | null;
  startChallenge: () => Promise<void>;
  submitProof: (audioBlob: Blob) => Promise<VoiceProof>;
  reset: () => void;
  error: string | null;
}

const WireChallengeContext = createContext<UseWireChallengeResult | null>(null);

function useProvideWireChallenge(
  options: UseWireChallengeOptions
): UseWireChallengeResult {
  const { challengeId, intentId, language } = options;

  const [state, setState] = useState<{
    status: ChallengeStatus;
    challenge: VoiceChallenge | null;
    transcript: string;
    scores: VoiceScores | null;
    error: string | null;
  }>({
    status: "idle",
    challenge: null,
    transcript: "",
    scores: null,
    error: null,
  });

  const reset = useCallback(() => {
    setState({
      status: "idle",
      challenge: null,
      transcript: "",
      scores: null,
      error: null,
    });
  }, []);

  const startChallenge = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      setState((prev) => ({ ...prev, status: "requesting_mic", error: null }));

      // Mock: Load challenge
      const challenge = await api.generateChallenge(intentId, language || "EN");
      if (!challenge) {
        throw new Error("Challenge not found");
      }

      setState((prev) => ({
        ...prev,
        challenge,
        status: "idle", // Ready to record
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to start challenge",
      }));
    }
  }, [intentId, language]);

  const submitProof = useCallback(
    async (audioBlob: Blob): Promise<VoiceProof> => {
      if (typeof window === "undefined") {
        throw new Error("Not in browser");
      }

      try {
        setState((prev) => ({ ...prev, status: "verifying", error: null }));

        const proof = await api.submitProof(challengeId, audioBlob);

        setState((prev) => ({
          ...prev,
          status: "verified",
          transcript: proof.transcript,
          scores: proof.scoresJson,
          error: null,
        }));

        return proof;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "Verification failed",
        }));
        throw err;
      }
    },
    [challengeId]
  );

  const value = useMemo(
    () => ({
      status: state.status,
      challenge: state.challenge,
      transcript: state.transcript,
      scores: state.scores,
      startChallenge,
      submitProof,
      reset,
      error: state.error,
    }),
    [state, startChallenge, submitProof, reset]
  );

  return value;
}

export function WireChallengeProvider({
  children,
  options,
}: {
  children: ReactNode;
  options: UseWireChallengeOptions;
}) {
  const value = useProvideWireChallenge(options);
  return (
    <WireChallengeContext.Provider value={value}>
      {children}
    </WireChallengeContext.Provider>
  );
}

export function useWireChallenge(): UseWireChallengeResult {
  const ctx = useContext(WireChallengeContext);
  if (!ctx) {
    throw new Error("useWireChallenge must be used within WireChallengeProvider");
  }
  return ctx;
}
