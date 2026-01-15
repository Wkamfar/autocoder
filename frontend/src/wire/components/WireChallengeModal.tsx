import React, { useState, useEffect } from "react";
import type { VoiceChallenge, TransferIntent, VoiceProof, ChallengeStatus, VoiceScores } from "../types/wire";
import { api } from "../api";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { ChallengeLevelBadge } from "../ui/WireDesignSystem";
import { WireModal } from "../ui/WireModal";

interface WireChallengeModalProps {
  challenge: VoiceChallenge;
  intent: TransferIntent;
  onComplete: (proof: VoiceProof) => void;
  onError: (error: string) => void;
  onClose: () => void;
  onUsePhone?: () => void;
}

export function WireChallengeModal({
  challenge,
  intent,
  onComplete,
  onError,
  onClose,
  onUsePhone,
}: WireChallengeModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [mockTranscript, setMockTranscript] = useState("");
  const [status, setStatus] = useState<ChallengeStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [scores, setScores] = useState<VoiceScores | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mock transcript simulation
  useEffect(() => {
    if (isRecording && status === "recording") {
      const timer = setTimeout(() => {
        setMockTranscript(
          "Authorize transfer seven two five thousand dollars beneficiary ending one two three four purpose monthly invoice nonce ocean mountain forest"
        );
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isRecording, status]);

  const startRecording = async () => {
    try {
      setStatus("requesting_mic");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setStatus("recording");
    } catch (err) {
      setStatus("error");
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission was denied. Enable it in browser settings, or use phone call approval."
          : err instanceof DOMException && err.name === "NotFoundError"
            ? "No microphone device found. Connect a mic, or use phone call approval."
            : "Microphone access failed. Try again, or use phone call approval.";
      setError(msg);
      onError(msg);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = async () => {
    if (!audioBlob) {
      setError("Please record audio before submitting");
      return;
    }

    try {
      setStatus("verifying");
      // Use transcript if available, otherwise use challenge text as fallback
      const proof = await api.submitProof(challenge.id, audioBlob, transcript || mockTranscript);
      setStatus("verified");
      setTranscript(proof.transcript);
      setScores(proof.scoresJson);
      onComplete(proof);
    } catch (err) {
      setStatus("error");
      const errorMessage = err instanceof Error ? err.message : "Verification failed";
      setError(errorMessage);
      onError(errorMessage);
    }
  };

  // Parse challenge text into segments
  const challengeSegments = challenge.challengeText.split(".").filter(Boolean);

  return (
    <WireModal title="Challenge Response" onClose={onClose} className="max-w-2xl">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Challenge Display */}
          <div className="border-2 border-black rounded-xl bg-gray-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Challenge Level:</span>
              <ChallengeLevelBadge level={challenge.level} />
            </div>
            <div className="space-y-2">
              {challengeSegments.map((segment, idx) => (
                <div key={idx} className="text-sm font-medium text-gray-900 leading-relaxed">
                  {segment.trim()}
                </div>
              ))}
            </div>
          </div>

          {/* Recording Status */}
          {status === "recording" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-600">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wide">Recording</span>
              </div>
              {/* Mock waveform */}
              <div className="h-20 border-2 border-black rounded-xl bg-white p-4 flex items-center justify-center">
                <div className="flex items-end gap-1 h-12 w-full">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-emerald-500 rounded-sm"
                      style={{
                        height: `${30 + Math.random() * 70}%`,
                        animation: `pulse 0.6s ease-in-out infinite`,
                        animationDelay: `${i * 0.03}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Transcript Display */}
          {(mockTranscript || transcript) && (
            <div className="border-2 border-black rounded-xl bg-blue-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-900 mb-2">Transcript</div>
              <div className="text-xs text-blue-800 font-mono leading-relaxed">{mockTranscript || transcript}</div>
            </div>
          )}

          {/* Verification Status */}
          {status === "verifying" && (
            <div className="border-2 border-black rounded-xl bg-gray-50 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                Verifying...
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <svg className="w-3 h-3 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Voice verification</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <svg className="w-3 h-3 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Liveness check</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <svg className="w-3 h-3 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Challenge match</span>
                </div>
              </div>
            </div>
          )}

          {/* Success State */}
          {status === "verified" && scores && (
            <div className="border-2 border-emerald-300 rounded-xl bg-emerald-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <span className="text-xl">✅</span>
                <span className="text-sm font-bold uppercase tracking-wide">Approved</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-emerald-800">
                <div className="bg-white/50 rounded-lg p-2 border border-emerald-200">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-600 mb-1">Identity</div>
                  <div className="font-bold">{(scores.identity_confidence * 100).toFixed(0)}%</div>
                </div>
                <div className="bg-white/50 rounded-lg p-2 border border-emerald-200">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-600 mb-1">Liveness</div>
                  <div className="font-bold">{(scores.liveness_score * 100).toFixed(0)}%</div>
                </div>
                <div className="bg-white/50 rounded-lg p-2 border border-emerald-200">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-600 mb-1">Match</div>
                  <div className="font-bold">{(scores.challenge_match_score * 100).toFixed(0)}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="border-2 border-red-300 rounded-xl bg-red-50 p-4">
              <div className="text-xs text-red-900 font-medium leading-relaxed">{error}</div>
              {onUsePhone && (
                <button
                  type="button"
                  onClick={onUsePhone}
                  className="mt-3 w-full px-4 py-2 border-2 border-black rounded-xl hover:bg-white text-sm font-medium transition-colors"
                >
                  Use phone call instead
                </button>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            {status === "idle" && (
              <button
                onClick={startRecording}
                className="flex-1 bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 text-sm font-medium transition-colors"
              >
                Start Recording
              </button>
            )}
            {status === "recording" && (
              <button
                onClick={stopRecording}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 text-sm font-medium transition-colors"
              >
                Stop Recording
              </button>
            )}
            {status === "verified" && audioBlob && (
              <button
                onClick={handleSubmit}
                className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 text-sm font-medium transition-colors"
              >
                Create Decision
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 border-2 border-black rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
      </div>
    </WireModal>
  );
}
