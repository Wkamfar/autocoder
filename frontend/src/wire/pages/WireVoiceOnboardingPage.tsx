import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { wireApi } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useWavRecorder } from "../hooks/useWavRecorder";
import type { PoseVoiceEnrollStartResponse } from "../types/poseVoice";

type Step =
  | "handoff"
  | "consent"
  | "setup"
  | "ihc"
  | "phrase"
  | "name_optional"
  | "sealing"
  | "done";

function browserInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
  };
}

async function playTone(ms: number) {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.value = 0.04; // gentle
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  await new Promise((r) => setTimeout(r, ms));
  osc.stop();
  await ctx.close().catch(() => {});
}

export default function WireVoiceOnboardingPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const recorder = useWavRecorder();
  const userRole = user?.role;

  const [step, setStep] = useState<Step>("handoff");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [micHint, setMicHint] = useState<"unknown" | "ready" | "denied" | "missing" | "error">("unknown");

  const [enroll, setEnroll] = useState<PoseVoiceEnrollStartResponse | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  const [ihcBlob, setIhcBlob] = useState<Blob | null>(null);
  const [phraseBlob, setPhraseBlob] = useState<Blob | null>(null);
  const [nameBlob, setNameBlob] = useState<Blob | null>(null);

  const [ihcRetryUsed, setIhcRetryUsed] = useState(false);
  const [isAutoStopping, setIsAutoStopping] = useState(false);

  const toneMs = enroll?.challenge.ihc_prompt.tone_duration_ms ?? 2000;
  const phrase = enroll?.challenge.phrase ?? "";

  const micErrorMessage = (e: unknown) => {
    if (e instanceof DOMException) {
      if (e.name === "NotAllowedError") return "Microphone permission was denied. Enable it in browser settings, then try again.";
      if (e.name === "NotFoundError") return "No microphone device found. Connect a mic (or use a device with one) and try again.";
      if (e.name === "NotReadableError") return "Microphone is in use by another app. Close it and try again.";
      if (e.name === "SecurityError") return "Microphone access is blocked by your browser/security policy.";
    }
    return e instanceof Error ? e.message : "Microphone access failed.";
  };

  const probeMic = async () => {
    setStatusError(null);
    try {
      await recorder.start();
      const { wav } = await recorder.stop();
      // Minimal sanity check
      if (wav.size > 1000) setMicHint("ready");
      else setMicHint("error");
    } catch (e) {
      const msg = micErrorMessage(e);
      setStatusError(msg);
      if (e instanceof DOMException && e.name === "NotAllowedError") setMicHint("denied");
      else if (e instanceof DOMException && e.name === "NotFoundError") setMicHint("missing");
      else setMicHint("error");
    }
  };

  const canContinue = useMemo(() => {
    if (step === "handoff") return true;
    if (step === "consent") return consentChecked;
    if (step === "setup") return true;
    if (step === "ihc") return Boolean(ihcBlob);
    if (step === "phrase") return Boolean(phraseBlob);
    return true;
  }, [step, consentChecked, ihcBlob, phraseBlob]);

  // If signed out, send to login.
  // IMPORTANT: Hooks must not be conditional; keep this effect before any early returns.
  useEffect(() => {
    if (!isLoading && !user) navigate("/login", { replace: true });
  }, [isLoading, user, navigate]);

  // If user already has voice profile, skip the flow.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (isLoading) return;
      if (!user) return;
      try {
        const s = await wireApi.poseVoiceStatus();
        if (cancelled) return;
        if (s.voice_profile_version) {
          setStep("done");
          navigate(userRole === "ADMIN" ? "/admin" : "/intents", { replace: true });
        }
      } catch (e) {
        if (cancelled) return;
        setStatusError(e instanceof Error ? e.message : "Failed to load voice status");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [isLoading, user, navigate]);

  const startEnrollment = async () => {
    setStatusError(null);
    const res = await wireApi.poseVoiceEnrollStart();
    setEnroll(res);
  };

  const goNext = async () => {
    setStatusError(null);

    if (step === "handoff") {
      setStep("consent");
      return;
    }

    if (step === "consent") {
      // Start enrollment only after explicit consent.
      await startEnrollment();
      setStep("setup");
      return;
    }

    if (step === "setup") {
      setStep("ihc");
      return;
    }

    if (step === "ihc") {
      setStep("phrase");
      return;
    }

    if (step === "phrase") {
      setStep("name_optional");
      return;
    }

    if (step === "name_optional") {
      // Seal identity
      if (!enroll || !ihcBlob || !phraseBlob) return;
      setStep("sealing");
      try {
        const res = await wireApi.poseVoiceEnrollComplete({
          enrollmentId: enroll.enrollment_id,
          poseId: enroll.pose_id,
          poseChallengeId: enroll.challenge.pose_challenge_id,
          takes: { ihc: ihcBlob, phrase: phraseBlob, name: nameBlob },
          clientMetadata: {
            ...browserInfo(),
            micSampleRate: recorder.sampleRate ?? undefined,
          },
          consentFlags: {
            create_voice_signature: true,
            store_raw_audio_default: false,
          },
        });
        setStep("done");
        // Immediately route to the right landing page after successful enrollment.
        navigate(userRole === "ADMIN" ? "/admin" : "/intents", { replace: true });
        return res;
      } catch (e) {
        setStatusError(e instanceof Error ? e.message : "Enrollment failed");
        setStep("name_optional");
      }
      return;
    }

    if (step === "done") {
      navigate(userRole === "ADMIN" ? "/admin" : "/intents", { replace: true });
      return;
    }
  };

  const startIhcCapture = async () => {
    setStatusError(null);
    setIhcBlob(null);
    try {
      await recorder.start();
      setMicHint("ready");
    } catch (e) {
      setStatusError(micErrorMessage(e));
      return;
    }

    // Start tone + auto-stop window (~5.5s total capture).
    setIsAutoStopping(true);
    try {
      await playTone(toneMs);
      // Give the user time to speak naturally after tone end.
      await new Promise((r) => setTimeout(r, 3200));
    } finally {
      setIsAutoStopping(false);
      const { wav } = await recorder.stop();
      // Basic quality gate: size and level.
      if (wav.size < 12_000 || recorder.level < 0.01) {
        if (!ihcRetryUsed) {
          setIhcRetryUsed(true);
          setStatusError("We couldn’t capture a clean start. Let’s try once more.");
          setIhcBlob(null);
          return;
        }
        setStatusError("No problem. We’ll restart with a new moment so it can’t be replayed.");
        // Restart enrollment: new enrollment_id + challenge_id
        const res = await wireApi.poseVoiceEnrollStart();
        setEnroll(res);
        setIhcRetryUsed(false);
        setIhcBlob(null);
        return;
      }
      setIhcBlob(wav);
    }
  };

  const startPhraseCapture = async () => {
    setStatusError(null);
    setPhraseBlob(null);
    try {
      await recorder.start();
      setMicHint("ready");
    } catch (e) {
      setStatusError(micErrorMessage(e));
    }
  };

  const stopPhraseCapture = async () => {
    const { wav } = await recorder.stop();
    if (wav.size < 10_000) {
      setStatusError("We heard you, but the signal wasn’t clear enough.");
      setPhraseBlob(null);
      return;
    }
    setPhraseBlob(wav);
  };

  const startNameCapture = async () => {
    setStatusError(null);
    setNameBlob(null);
    try {
      await recorder.start();
      setMicHint("ready");
    } catch (e) {
      setStatusError(micErrorMessage(e));
    }
  };

  const stopNameCapture = async () => {
    const { wav } = await recorder.stop();
    if (wav.size < 8_000) {
      setStatusError("We couldn’t capture a clean moment.");
      setNameBlob(null);
      return;
    }
    setNameBlob(wav);
  };

  if (isLoading) {
    return <div className="min-h-screen bg-white" />;
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl border-2 border-black rounded-2xl bg-white p-6 sm:p-8">
        {step === "handoff" && (
          <>
            <div className="text-xs tracking-[0.25em] text-slate-500">WIRE</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">One last step</h1>
            <p className="mt-2 text-sm text-slate-600">
              Your email is verified. Now we’ll create your POSE voice signature — so POSE can recognize{" "}
              <em>you</em> anywhere you speak.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={goNext}
                className="inline-flex w-full items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-medium text-white"
              >
                Create my voice signature
              </button>
              <button
                onClick={() => navigate("/intents", { replace: true })}
                className="text-sm text-slate-600 hover:underline"
              >
                Not now (limits access)
              </button>
              <div className="text-xs text-slate-500">
                <strong>Note:</strong> This takes ~20 seconds. You can redo it later, but each setup is a new
                signature.
              </div>
            </div>
          </>
        )}

        {step === "consent" && (
          <>
            <div className="text-xs tracking-[0.25em] text-slate-500">POSE IDENTITY</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Your voice stays yours</h1>
            <p className="mt-2 text-sm text-slate-600">
              We don’t store raw audio by default. We store a protected signature that helps prove it’s you —
              without giving anyone your voice.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>• No public audio by default</li>
              <li>• Encrypted signature + proof metadata</li>
              <li>• You can revoke and re-create anytime</li>
            </ul>
            <label className="mt-5 flex items-start gap-3 text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-1"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <span>I agree to create a voice signature for my POSE identity</span>
            </label>
          </>
        )}

        {step === "setup" && (
          <>
            <div className="text-xs tracking-[0.25em] text-slate-500">QUICK SETUP</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Quick setup</h1>
            <p className="mt-2 text-sm text-slate-600">
              Find a quiet moment. Hold your phone/laptop ~6–12 inches away.
            </p>
            <div className="mt-4 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    micHint === "ready" ? "bg-emerald-500" : micHint === "denied" || micHint === "missing" || micHint === "error" ? "bg-red-500" : "bg-slate-300"
                  }`}
                />
                {micHint === "ready" ? "Mic ready" : micHint === "denied" ? "Mic permission denied" : micHint === "missing" ? "No mic found" : micHint === "error" ? "Mic not ready" : "Mic not checked"}
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void probeMic()}
                  className="inline-flex items-center justify-center rounded-xl border-2 border-black px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Test microphone
                </button>
              </div>
            </div>
          </>
        )}

        {step === "ihc" && (
          <>
            <div className="text-xs tracking-[0.25em] text-slate-500">MOMENT 1</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Capture a real moment</h1>
            <p className="mt-2 text-sm text-slate-600">This isn’t about a password. It’s about presence.</p>
            <div className="mt-4 rounded-xl border-2 border-black p-4 bg-slate-50">
              <div className="text-sm font-medium text-slate-900">Wait until the tone ends… then start speaking naturally.</div>
              <div className="mt-1 text-sm text-slate-600">Any words are fine. One short sentence is perfect.</div>
              <div className="mt-3 text-xs text-slate-600">
                For security, you get one retry for this step.
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              {recorder.state !== "recording" ? (
                <button
                  onClick={startIhcCapture}
                  className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-medium text-white"
                >
                  Start
                </button>
              ) : (
                <button
                  onClick={async () => {
                    const { wav } = await recorder.stop();
                    setIhcBlob(wav);
                  }}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
                >
                  Stop
                </button>
              )}

              <div className="flex-1">
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-2 bg-emerald-500"
                    style={{ width: `${Math.min(100, Math.round(recorder.level * 280))}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {recorder.state === "recording" ? "Listening…" : ihcBlob ? "Good moment captured" : "Ready"}
                  {isAutoStopping ? " (hold for a second)" : ""}
                </div>
              </div>
            </div>

            {ihcBlob && (
              <div className="mt-3 text-sm text-slate-700">
                We captured <em>when</em> you chose to begin — that choice can’t be replayed.
              </div>
            )}
          </>
        )}

        {step === "phrase" && (
          <>
            <div className="text-xs tracking-[0.25em] text-slate-500">MOMENT 2</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Add a stable anchor</h1>
            <p className="mt-2 text-sm text-slate-600">Read this once, at your normal pace.</p>
            <div className="mt-4 rounded-xl border-2 border-black p-4 bg-white">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your phrase (changes each time)</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{phrase}</div>
              <div className="mt-1 text-sm text-slate-600">Don’t overthink it. Clear is better than loud.</div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              {recorder.state !== "recording" ? (
                <button
                  onClick={startPhraseCapture}
                  className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-medium text-white"
                >
                  Record phrase
                </button>
              ) : (
                <button
                  onClick={stopPhraseCapture}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
                >
                  Stop
                </button>
              )}
              <div className="flex-1">
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-2 bg-emerald-500"
                    style={{ width: `${Math.min(100, Math.round(recorder.level * 280))}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {recorder.state === "recording" ? "Listening…" : phraseBlob ? "Phrase captured" : "Ready"}
                </div>
              </div>
            </div>
          </>
        )}

        {step === "name_optional" && (
          <>
            <div className="text-xs tracking-[0.25em] text-slate-500">MOMENT 3 (OPTIONAL)</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Make it unmistakably you (optional)</h1>
            <p className="mt-2 text-sm text-slate-600">Say your name naturally, like you would on a call.</p>

            <div className="mt-4 flex items-center gap-3">
              {recorder.state !== "recording" ? (
                <button
                  onClick={startNameCapture}
                  className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-medium text-white"
                >
                  Record (optional)
                </button>
              ) : (
                <button
                  onClick={stopNameCapture}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
                >
                  Stop
                </button>
              )}
              <button
                onClick={() => {
                  setNameBlob(null);
                  goNext();
                }}
                className="text-sm text-slate-600 hover:underline"
              >
                Skip
              </button>
              <div className="flex-1">
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-2 bg-emerald-500"
                    style={{ width: `${Math.min(100, Math.round(recorder.level * 280))}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-500">{nameBlob ? "Captured" : "Ready"}</div>
              </div>
            </div>
          </>
        )}

        {step === "sealing" && (
          <>
            <div className="text-xs tracking-[0.25em] text-slate-500">CREATING IDENTITY</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Creating your POSE identity</h1>
            <p className="mt-2 text-sm text-slate-600">Sealing your voice signature…</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>• Extracting signal</li>
              <li>• Locking a one-way commitment</li>
              <li>• Saving to your POSE identity</li>
            </ul>
            <div className="mt-4 text-xs text-slate-500">
              This signature is protected and versioned so it can evolve without losing you.
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <div className="text-xs tracking-[0.25em] text-slate-500">COMPLETE</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">You’re sealed</h1>
            <p className="mt-2 text-sm text-slate-600">
              Your POSE voice signature is now linked to your identity. POSE can recognize you anywhere it’s
              implemented.
            </p>
            <div className="mt-6">
              <button
                onClick={goNext}
                className="inline-flex w-full items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-medium text-white"
              >
                Continue to Wire
              </button>
              <div className="mt-3 text-xs text-slate-500">You can revoke and re-create your signature anytime.</div>
            </div>
          </>
        )}

        {statusError && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {statusError}
          </div>
        )}

        {/* Global footer actions */}
        {step !== "handoff" && step !== "sealing" && step !== "done" && (
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <button
              onClick={() => navigate("/intents", { replace: true })}
              className="text-sm text-slate-600 hover:underline"
            >
              Cancel for now
            </button>
            <button
              onClick={goNext}
              disabled={!canContinue}
              className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

