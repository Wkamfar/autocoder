import React, { useEffect, useMemo, useState } from "react";
import { createConfirmSession, submitVoice, getConfirmSession, cancelConfirmSession } from "./api";
import { useAuth } from "../wire/contexts/AuthContext";
import { wireApi } from "../wire/api/client";
import type { TransferIntent } from "../wire/types/wire";

type FlowState =
  | "form"
  | "pending"
  | "voice"
  | "awaiting_confirmation"
  | "ready_to_send"
  | "executing"
  | "sent"
  | "cancelled"
  | "expired"
  | "locked"
  | "failed";

function generateClientId() {
  return crypto.randomUUID();
}

function toMinor(amount: string) {
  const parsed = Number(amount);
  if (Number.isNaN(parsed)) return "0";
  return Math.round(parsed * 100).toString();
}

async function recordAudioBase64(durationMs = 2200): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];

  return await new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onerror = () => reject(new Error("Recording failed"));
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const base64 = btoa(String.fromCharCode(...bytes));
      stream.getTracks().forEach((track) => track.stop());
      resolve(base64);
    };
    recorder.start();
    setTimeout(() => recorder.stop(), durationMs);
  });
}

async function recordAudioBlob(durationMs = 2200): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];

  return await new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onerror = () => reject(new Error("Recording failed"));
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      stream.getTracks().forEach((track) => track.stop());
      resolve(blob);
    };
    recorder.start();
    setTimeout(() => recorder.stop(), durationMs);
  });
}

async function captureSpeechTranscript(durationMs = 2200): Promise<string> {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) return "";
  return await new Promise((resolve) => {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    let resolved = false;
    let transcript = "";
    recognition.onresult = (event: any) => {
      const text = Array.from(event.results)
        .map((result: any) => result[0]?.transcript || "")
        .join(" ");
      transcript = text.trim();
    };
    recognition.onerror = () => {
      if (!resolved) {
        resolved = true;
        resolve("");
      }
    };
    recognition.onend = () => {
      if (!resolved) {
        resolved = true;
        resolve(transcript);
      }
    };
    recognition.start();
    setTimeout(() => {
      if (!resolved) {
        recognition.stop();
      }
    }, durationMs);
  });
}

async function recordVoiceSample(durationMs = 2200) {
  const [audioBuffer, transcript] = await Promise.all([
    recordAudioBase64(durationMs),
    captureSpeechTranscript(durationMs),
  ]);
  return { audioBuffer, transcript };
}

async function recordVoiceSampleBlob(durationMs = 2200) {
  const [audioBlob, transcript] = await Promise.all([
    recordAudioBlob(durationMs),
    captureSpeechTranscript(durationMs),
  ]);
  return { audioBlob, transcript };
}

export default function ConfirmTransferPage() {
  const { user, isLoading } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const approverIntentId = searchParams.get("intentId");
  const isApproverMode = Boolean(approverIntentId);
  const [amount, setAmount] = useState("500.00");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [purpose, setPurpose] = useState("Wire transfer confirmation");
  const [state, setState] = useState<FlowState>("form");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [approverChallengeId, setApproverChallengeId] = useState<string | null>(null);
  const [approverIntent, setApproverIntent] = useState<TransferIntent | null>(null);
  const [requesterName, setRequesterName] = useState<string>("");
  const [challengePhraseDisplay, setChallengePhraseDisplay] = useState<string>("");
  const [challengePhrase, setChallengePhrase] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [voiceAttempt, setVoiceAttempt] = useState(0);
  const [beneficiaryDisplay, setBeneficiaryDisplay] = useState<{ name: string; last4: string } | null>(null);

  const fingerprint = useMemo(() => navigator.userAgent, []);

  useEffect(() => {
    let cancelled = false;
    const resolvedBeneficiaryId = isApproverMode ? approverIntent?.beneficiaryId ?? "" : beneficiaryId;
    if (!resolvedBeneficiaryId) {
      setBeneficiaryDisplay(null);
      return;
    }
    (async () => {
      try {
        const beneficiaries = await wireApi.getBeneficiaries();
        if (cancelled) return;
        const match = beneficiaries.find((item) => item.id === resolvedBeneficiaryId);
        if (match) {
          setBeneficiaryDisplay({
            name: match.displayName || "Recipient",
            last4: match.bankLast4 || "----",
          });
        } else {
          setBeneficiaryDisplay(null);
        }
      } catch {
        if (!cancelled) {
          setBeneficiaryDisplay(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [beneficiaryId, approverIntent, isApproverMode]);

  useEffect(() => {
    if (!isApproverMode || !approverIntentId) return;
    let cancelled = false;
    (async () => {
      try {
        const intent = await wireApi.getIntent(approverIntentId);
        if (cancelled) return;
        if (!intent) {
          setError("Transfer not found.");
          return;
        }
        setApproverIntent(intent);
        setAmount((Number(intent.amountMinor) / 100).toFixed(2));
        setPurpose(intent.purpose);
        setBeneficiaryId(intent.beneficiaryId);
        try {
          const requester = await wireApi.getUser(intent.createdByUserId);
          if (!cancelled) setRequesterName(requester.name || requester.email || intent.createdByUserId);
        } catch {
          if (!cancelled) setRequesterName(intent.createdByUserId);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load transfer.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [approverIntentId, isApproverMode]);

  useEffect(() => {
    if (state !== "awaiting_confirmation" || !sessionId) return;
    const interval = setInterval(async () => {
      try {
        const status = await getConfirmSession(sessionId);
        if (status.status === "ready_to_send") {
          setState("ready_to_send");
          setStatusMessage(status.message || "Transfer will be sent shortly.");
        }
        if (status.status === "sent") {
          setState("sent");
          setStatusMessage("✓ Transfer Sent.");
        }
        if (status.status === "locked") {
          setState("locked");
          setStatusMessage(status.message || "We couldn't verify that. This transfer needs additional confirmation.");
        }
        if (status.status === "executing") {
          setState("executing");
          setStatusMessage(status.message || "Transfer is processing.");
        }
        if (status.status === "expired") {
          setState("expired");
          setStatusMessage(status.message || "Transfer expired.");
        }
        if (status.status === "cancelled") {
          setState("cancelled");
          setStatusMessage(status.message || "Transfer cancelled successfully.");
        }
        if (status.status === "pending") {
          setState("pending");
          setStatusMessage(status.message || "Preparing confirmation...");
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch status.");
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [state, sessionId]);

  useEffect(() => {
    if (state !== "voice" || !challengePhrase) return;
    let cancelled = false;
    (async () => {
      try {
        if (isApproverMode) {
          if (!approverIntentId || !approverChallengeId) return;
          const { audioBlob, transcript } = await recordVoiceSampleBlob();
          if (cancelled) return;
          const proof = await wireApi.submitProof(approverChallengeId, audioBlob, transcript);
          await wireApi.createDecision(approverIntentId, "APPROVE", proof.id);
          setState("awaiting_confirmation");
          setStatusMessage("Confirmation received. We'll update you when the transfer is ready.");
          return;
        }

        if (!sessionId) return;
        const { audioBuffer, transcript } = await recordVoiceSample();
        if (cancelled) return;
        const response = await submitVoice(sessionId, {
          audioBuffer,
          transcript,
          deviceFingerprint: fingerprint,
        });
        if (response.status === "sent") {
          setState("sent");
          setStatusMessage("✓ Transfer Sent.");
          return;
        }
        if (response.status === "ready_to_send") {
          setState("ready_to_send");
          setStatusMessage(response.message || "Transfer will be sent shortly.");
          return;
        }
        if (response.status === "awaiting_confirmation") {
          setState("awaiting_confirmation");
          setStatusMessage(
            response.message ||
              "We've sent a confirmation request to your team. You'll be notified when it's confirmed.",
          );
          return;
        }
        if (response.status === "voice_required") {
          setError("Say the full phrase to confirm.");
          return;
        }
        if (response.status === "locked") {
          setState("locked");
          setStatusMessage(response.message || "We couldn't verify that. This transfer needs additional confirmation.");
          return;
        }
      } catch (err: any) {
        setError(err.message || "Voice verification failed.");
        setState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, sessionId, challengePhrase, fingerprint, voiceAttempt, isApproverMode, approverIntentId, approverChallengeId]);

  if (isLoading) {
    return <div className="p-8 text-gray-600">Loading…</div>;
  }

  if (!user) {
    return <div className="p-8 text-gray-600">Please sign in to continue.</div>;
  }

  const handleConfirm = async () => {
    setError(null);
    try {
      if (isApproverMode) {
        if (!approverIntentId) return;
        const challenge = await wireApi.generateChallenge(approverIntentId);
        if (!challenge) {
          setError("Unable to start voice confirmation.");
          return;
        }
        setApproverChallengeId(challenge.id);
        setChallengePhraseDisplay("Confirm");
        setChallengePhrase(challenge.challengeText);
        setState("voice");
        return;
      }

      const response = await createConfirmSession({
        amountMinor: toMinor(amount),
        currency: "USD",
        beneficiaryId,
        purpose,
        clientConfirmationId: generateClientId(),
        deviceFingerprint: fingerprint,
      });
      if ("status" in response && response.status === "failed") {
        setError(response.error);
        return;
      }
      setSessionId(response.sessionId);
      setChallengePhraseDisplay(response.challengePhraseDisplay || "Confirm");
      setChallengePhrase(response.challengePhrase);
      if (response.policyOutcome) {
        setStatusMessage(response.policyOutcome);
      }
      setState("voice");
    } catch (err: any) {
      setError(err.message || "Failed to create confirmation session.");
    }
  };

  const handleCancel = async () => {
    if (!sessionId) return;
    try {
      await cancelConfirmSession(sessionId);
      setState("cancelled");
      setStatusMessage("Transfer cancelled successfully.");
    } catch (err: any) {
      setError(err.message || "Cancel failed.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-10">
      <div className="max-w-lg w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
        {state === "form" && (
          <>
            <h1 className="text-2xl font-semibold text-gray-900">Confirm Transfer</h1>
            <div className="space-y-3">
              <label className="block text-sm text-gray-600">
                Amount (USD)
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isApproverMode}
                />
              </label>
              <label className="block text-sm text-gray-600">
                Beneficiary ID
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={beneficiaryId}
                  onChange={(e) => setBeneficiaryId(e.target.value)}
                  disabled={isApproverMode}
                />
              </label>
              {beneficiaryDisplay && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <div>{beneficiaryDisplay.name}</div>
                  <div className="text-gray-500">Account: ****{beneficiaryDisplay.last4}</div>
                </div>
              )}
              <label className="block text-sm text-gray-600">
                Purpose
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  disabled={isApproverMode}
                />
              </label>
              {isApproverMode && requesterName && (
                <div className="text-sm text-gray-600">Requested by: {requesterName}</div>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              className="w-full bg-black text-white rounded-lg py-3 font-medium"
              onClick={handleConfirm}
              disabled={!beneficiaryId}
            >
              Confirm Transfer
            </button>
          </>
        )}

        {state === "voice" && (
          <>
            <h1 className="text-xl font-semibold text-gray-900">Confirming…</h1>
            <div className="text-3xl font-semibold text-gray-900">{challengePhraseDisplay}</div>
            <div className="text-sm text-gray-500">Say the phrase</div>
            <div className="text-lg font-medium text-gray-900">{challengePhrase}</div>
            {statusMessage && <div className="text-sm text-gray-600">{statusMessage}</div>}
            <div className="text-sm text-gray-500">Recording…</div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              className="w-full border border-gray-300 rounded-lg py-2"
              onClick={() => {
                setError(null);
                setVoiceAttempt((prev) => prev + 1);
              }}
            >
              Try again
            </button>
          </>
        )}

        {state === "awaiting_confirmation" && (
          <>
            <h1 className="text-xl font-semibold text-gray-900">⏳ Awaiting Confirmation</h1>
            <p className="text-gray-600">
              {statusMessage ||
                "We've sent a confirmation request to your team. You'll be notified when it's confirmed."}
            </p>
            <button className="w-full border border-gray-300 rounded-lg py-2" onClick={handleCancel}>
              Cancel transfer
            </button>
          </>
        )}

        {state === "ready_to_send" && (
          <>
            <h1 className="text-xl font-semibold text-gray-900">✓ Ready to Send</h1>
            <p className="text-gray-600">{statusMessage || "Transfer will be sent shortly."}</p>
          </>
        )}

        {state === "pending" && (
          <>
            <h1 className="text-xl font-semibold text-gray-900">Preparing confirmation</h1>
            <p className="text-gray-600">{statusMessage || "Preparing confirmation..."}</p>
          </>
        )}

        {state === "executing" && (
          <>
            <h1 className="text-xl font-semibold text-gray-900">Transfer is processing</h1>
            <p className="text-gray-600">{statusMessage || "Transfer is processing."}</p>
          </>
        )}

        {state === "sent" && (
          <>
            <h1 className="text-xl font-semibold text-gray-900">✓ Transfer Sent.</h1>
            <p className="text-gray-600">{statusMessage || "✓ Transfer Sent."}</p>
          </>
        )}

        {state === "cancelled" && (
          <>
            <h1 className="text-xl font-semibold text-gray-900">Transfer cancelled</h1>
            <p className="text-gray-600">{statusMessage || "Transfer cancelled successfully."}</p>
          </>
        )}

        {state === "expired" && (
          <>
            <h1 className="text-xl font-semibold text-gray-900">Transfer expired</h1>
            <p className="text-gray-600">{statusMessage || "Transfer expired. Please confirm again."}</p>
          </>
        )}

        {state === "locked" && (
          <>
            <h1 className="text-xl font-semibold text-gray-900">Transfer requires confirmation</h1>
            <p className="text-gray-600">
              {statusMessage || "We couldn't verify that. This transfer needs additional confirmation."}
            </p>
          </>
        )}

        {state === "failed" && (
          <>
            <h1 className="text-xl font-semibold text-gray-900">Transfer Failed</h1>
            <p className="text-gray-600">
              {statusMessage || error || "Transfer failed. Please try again."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
