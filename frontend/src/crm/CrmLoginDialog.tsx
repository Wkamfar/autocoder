import { useMemo, useState } from "react";

export interface CrmLoginDialogProps {
  open: boolean;
  onClose: () => void;
  onLoggedIn: () => void;
}

export function CrmLoginDialog({ open, onClose, onLoggedIn }: CrmLoginDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && !busy;
  }, [email, password, busy]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-black bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
              CRM Session
            </p>
            <h2 className="text-sm font-semibold">Sign in</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              onClose();
            }}
            className="text-xs text-gray-600 hover:text-black"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-4 space-y-3 text-xs text-gray-800">
          <p className="text-[11px] text-gray-600">
            Voice verification and CRM writes require an authenticated CRM user session.
          </p>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="founder@pose.xyz"
                className="mt-1 w-full rounded-xl border-2 border-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="(your CRM password)"
                className="mt-1 w-full rounded-xl border-2 border-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                {error}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[10px] text-gray-600">
              Local dev defaults (if you ran <span className="font-mono">npm run crm:seed</span>):
            </p>
            <ul className="mt-1 space-y-0.5 text-[10px] text-gray-600">
              <li>
                - Admin account: <span className="font-mono">founder@pose.xyz</span> (password: <span className="font-mono">POSE2026!</span>, bypasses voice gating)
              </li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setError(null);
              onClose();
            }}
            className="rounded-full border border-black px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-black hover:bg-black hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={async () => {
              try {
                setBusy(true);
                setError(null);
                const res = await fetch("/api/auth/login", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  credentials: "include", // Include cookies for session
                  body: JSON.stringify({ email, password }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok || !json.ok) {
                  throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
                }
                onLoggedIn();
                onClose();
              } catch (err: any) {
                setError(err?.message ?? "Login failed");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-full bg-black px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-white hover:bg-gray-900 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
