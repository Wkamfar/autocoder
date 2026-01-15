import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { wireApi } from "../api/client";

export default function WireMagicLinkPage() {
  const [params] = useSearchParams();

  const token = useMemo(() => params.get("t") || "", [params]);
  const [status, setStatus] = useState<"ready" | "verifying" | "success" | "error">("ready");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Missing sign‑in token. Please request a new link.");
      return;
    }
    // IMPORTANT: Do NOT auto-consume on page load.
    // Enterprise email security scanners often pre-open links; auto-consuming would “burn” the link.
    setStatus("ready");
    setError(null);
  }, [token]);

  const handleOpen = async () => {
    if (!token) return;
    setStatus("verifying");
    setError(null);
    try {
      const res = await wireApi.consumeMagicLink(token);
      localStorage.setItem("wire_auth_token", res.token);
      setStatus("success");
      // Post-auth routing:
      // - If voice already enrolled, go straight to Admin (for admins) / Intents (others)
      // - Otherwise, run voice onboarding once
      try {
        const s = await wireApi.poseVoiceStatus();
        const me = await wireApi.getMe();
        const dest =
          s.voice_profile_version
            ? (me.user.role === "ADMIN" ? "/v2/admin" : "/v2/intents")
            : "/v2/onboarding/voice";
        setTimeout(() => window.location.replace(dest), 350);
      } catch {
        // If status fails, fall back to onboarding (safe default)
        setTimeout(() => window.location.replace("/v2/onboarding/voice"), 350);
      }
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to verify link");
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="text-xs tracking-[0.25em] text-slate-500">WIRE</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            {status === "ready" && "Secure sign‑in link"}
            {status === "verifying" && "Verifying your secure link…"}
            {status === "success" && "You’re signed in."}
            {status === "error" && "This link can’t be used."}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {status === "ready" && "Click below to open WIRE. This link works once."}
            {status === "verifying" && "Hang tight—this should take less than a second."}
            {status === "success" && "Redirecting you to your dashboard…"}
            {status === "error" && (error || "Please try again.")}
          </p>
        </div>

        {status === "ready" ? (
          <div className="space-y-3">
            <button
              onClick={handleOpen}
              className="inline-flex w-full items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white"
            >
              Open WIRE
            </button>
            <div className="text-xs text-slate-500">
              If your email security system previews links, this step keeps the link from being used before you click.
            </div>
          </div>
        ) : status === "error" ? (
          <div className="space-y-3">
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white"
            >
              Go to sign in
            </Link>
            <div className="text-xs text-slate-500">
              If you keep seeing this, request a new link or sign in with email + password.
            </div>
          </div>
        ) : (
          <div className="h-10" />
        )}
      </div>
    </div>
  );
}

