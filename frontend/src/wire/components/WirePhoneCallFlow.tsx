import React, { useState, useEffect } from "react";
import type { VoiceChallenge, TransferIntent, VoiceProof } from "../types/wire";
import { api } from "../api";
import { WireModal } from "../ui/WireModal";

interface WirePhoneCallFlowProps {
  challenge: VoiceChallenge;
  intent: TransferIntent;
  phoneNumber: string;
  onComplete: (proof: VoiceProof) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

type PhoneCallStatus =
  | "idle"
  | "calling"
  | "connected"
  | "listening"
  | "verifying"
  | "done"
  | "error";

export function WirePhoneCallFlow({
  challenge,
  intent,
  phoneNumber,
  onComplete,
  onError,
  onClose,
}: WirePhoneCallFlowProps) {
  const [status, setStatus] = useState<PhoneCallStatus>("idle");
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (status === "listening" || status === "verifying") {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

  const startCall = async () => {
    try {
      setStatus("calling");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setStatus("connected");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setStatus("listening");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      setStatus("verifying");
      const proof = await api.submitProof(challenge.id, new Blob());
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setStatus("done");
      onComplete(proof);
    } catch (err) {
      setStatus("error");
      onError(err instanceof Error ? err.message : "Call failed");
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <WireModal title="Voice Approval (Phone)" onClose={onClose} className="max-w-md">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="text-center space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              We'll call you at
            </div>
            <div className="text-xl font-mono font-bold text-gray-900 border-2 border-black rounded-xl px-4 py-3 bg-gray-50">
              {phoneNumber}
            </div>
          </div>

          {status === "idle" && (
            <button
              onClick={startCall}
              className="w-full bg-black text-white px-4 py-3 rounded-xl hover:bg-gray-800 text-sm font-medium transition-all duration-200 shadow-sm"
            >
              Start Call
            </button>
          )}

        {status !== "idle" && status !== "done" && (
          <div className="space-y-4">
            <div className="text-center border-2 border-black rounded-xl bg-gray-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Status</div>
              <div className="text-sm font-bold text-gray-900">
                {status === "calling" && "Calling..."}
                {status === "connected" && "Connected"}
                {status === "listening" && "Listening..."}
                {status === "verifying" && "Verifying..."}
              </div>
            </div>

            {(status === "listening" || status === "verifying") && (
              <div className="text-center border-2 border-black rounded-xl bg-gray-50 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Duration</div>
                <div className="text-sm font-mono font-bold text-gray-900">{formatDuration(callDuration)}</div>
              </div>
            )}

            {status === "error" && (
              <div className="border-2 border-red-300 rounded-xl bg-red-50 p-4 text-xs text-red-900 font-medium">
                Call failed. Please try again.
              </div>
            )}
          </div>
        )}

        {status === "done" && (
          <div className="border-2 border-emerald-300 rounded-xl bg-emerald-50 p-4 text-center">
            <div className="text-xl mb-2">✅</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Call Complete</div>
          </div>
        )}

        {(status === "calling" || status === "connected" || status === "listening" || status === "verifying") && (
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border-2 border-black rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            Cancel Call
          </button>
        )}
      </div>
    </WireModal>
  );
}
