import { useMemo } from "react";
import { useVoiceWriteGate } from "../hooks/useVoiceWriteGate";

export interface VoiceWriteGateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function VoiceWriteGateDialog({
  open,
  onClose,
}: VoiceWriteGateDialogProps) {
  const {
    status,
    message,
    error,
    crmWriteToken,
    expiresAt,
    voiceSessionId,
    verify,
    reset,
  } = useVoiceWriteGate();

  const isBusy =
    status === "requesting_mic" ||
    status === "recording" ||
    status === "verifying";

  const statusLabel = useMemo(() => {
    switch (status) {
      case "idle":
        return "Idle";
      case "requesting_mic":
        return "Requesting microphone…";
      case "recording":
        return "Recording…";
      case "verifying":
        return "Verifying…";
      case "verified":
        return "Verified";
      case "error":
        return "Error";
      default:
        return status;
    }
  }, [status]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl border border-black bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
              Voice Write Gate
            </p>
            <h2 className="text-sm font-semibold">
              Verify your voice for CRM writes
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="text-xs text-gray-600 hover:text-black"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-3 space-y-3 text-xs text-gray-800">
          <p>
            Voice gating is required for sensitive CRM writes (stage changes,
            high-value edits, destructive actions). Your verification token is
            never stored on disk and expires automatically after a short time.
          </p>

          <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">
              Status
            </p>
            <p className="mt-0.5 text-xs font-semibold">{statusLabel}</p>
            <p className="mt-0.5 text-[11px] text-gray-600">{message}</p>
            {Boolean(error) && (
              <p className="mt-0.5 text-[11px] text-red-600">
                {String(error)}
              </p>
            )}
          </div>

          {crmWriteToken && (
            <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 space-y-1">
              <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">
                Active session
              </p>
              <p className="text-[11px] text-gray-700">
                A voice-verified write token is active in this browser tab. All
                CRM write endpoints will require this token in headers; future
                UI actions can attach it automatically.
              </p>
              <p className="text-[11px] text-gray-500">
                Expires at:{" "}
                <span className="font-mono">
                  {expiresAt
                    ? new Date(expiresAt).toLocaleTimeString()
                    : "unknown"}
                </span>
              </p>
              {voiceSessionId && (
                <p className="text-[11px] text-gray-500">
                  Voice session ID:{" "}
                  <span className="font-mono break-all">{voiceSessionId}</span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-full border border-black px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-black hover:bg-black hover:text-white"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            {crmWriteToken && (
              <span className="text-[10px] font-mono text-emerald-700">
                Verified
              </span>
            )}
            <button
              type="button"
              onClick={verify}
              disabled={isBusy}
              className="rounded-full bg-black px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-white hover:bg-gray-900 disabled:opacity-50"
            >
              {isBusy ? "Listening…" : "Verify voice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

