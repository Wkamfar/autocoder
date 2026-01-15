import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWireIntent, useEventLogs } from "../hooks/useWireIntents";
import { api } from "../api";
import type { AuditBundle } from "../types/wire";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { useToast } from "../../crm/ui/CrmDesignSystem";
import { useAuth } from "../contexts/AuthContext";
import { WireErrorState } from "../ui/WireEmptyStates";

export default function WireEvidencePage() {
  const { intentId } = useParams<{ intentId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { data: intent } = useWireIntent(intentId || "");
  const { data: eventLogs } = useEventLogs(intentId || "");
  const [bundle, setBundle] = React.useState<AuditBundle | null>(null);
  const [bundleMode, setBundleMode] = React.useState<"full" | "redacted">("full");
  const [bundleVerify, setBundleVerify] = React.useState<{ valid: boolean; error?: string; signerKeyId: string } | null>(null);
  const [chainVerify, setChainVerify] = React.useState<{
    valid: boolean;
    errors: Array<{ seq: number; error: string }>;
    chainHash: string | null;
    eventCount: number;
  } | null>(null);
  const [loadingBundle, setLoadingBundle] = React.useState(false);
  const canView = Boolean(user?.permissions?.includes("evidence:view"));
  const canFull = Boolean(user?.permissions?.includes("evidence:export_full"));
  const canRedacted = Boolean(user?.permissions?.includes("evidence:export_redacted"));

  const generateBundle = async (mode: "full" | "redacted") => {
    if (!intentId) return;
    if (mode === "full" && !canFull) {
      toast.push({ tone: "danger", message: "You don’t have permission to export full evidence bundles." });
      return;
    }
    if (mode === "redacted" && !canRedacted) {
      toast.push({ tone: "danger", message: "You don’t have permission to export redacted evidence bundles." });
      return;
    }
    setLoadingBundle(true);
    setBundleMode(mode);
    try {
      const b = await (api as any).generateBundle(intentId, mode);
      setBundle(b);
      const [bv, cv] = await Promise.all([
        (api as any).verifyBundle?.(b.id),
        (api as any).verifyEventChain?.(intentId),
      ]);
      setBundleVerify(bv ?? null);
      setChainVerify(cv ?? null);
      toast.push({ tone: "success", message: `Bundle generated (${mode})` });
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Failed to generate bundle" });
    } finally {
      setLoadingBundle(false);
    }
  };

  const downloadBundle = async () => {
    if (!bundle) return;
    const mode = (bundle as any).mode ?? bundleMode;
    if (mode === "full" && !canFull) {
      toast.push({ tone: "danger", message: "You don’t have permission to download full evidence bundles." });
      return;
    }
    if (mode === "redacted" && !canRedacted) {
      toast.push({ tone: "danger", message: "You don’t have permission to download redacted evidence bundles." });
      return;
    }
    try {
      const res = await (api as any).getBundleDownloadUrl?.(bundle.id, 3600);
      const url = res?.url as string | undefined;
      if (!url) throw new Error("No download URL returned");

      // Mock mode: synthesize a zip blob.
      if (url.startsWith("mock://")) {
        const blob = new Blob(["Mock audit bundle content"], { type: "application/zip" });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${bundle.id}_${bundleMode}.zip`;
        a.click();
        URL.revokeObjectURL(blobUrl);
        return;
      }

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Failed to download bundle" });
    }
  };

  if (!intent) {
    return (
      <div className="border-2 border-black rounded-2xl bg-white p-8">
        <div className="text-center text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!canView) {
    return (
      <WireErrorState
        title="Evidence access required"
        message="Your role does not include evidence viewing/export permissions."
        onRetry={() => navigate(`/intents/${intentId}`)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
                Audit & Evidence
              </p>
              <h2 className="text-sm font-semibold text-gray-900">Evidence Bundle</h2>
            </div>
            <button
              onClick={() => navigate(`/intents/${intentId}`)}
              className="text-xs text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              ← Back
            </button>
          </div>
        </header>
      </div>

      {/* Bundle Manifest Panel */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-sm font-bold text-gray-900">Bundle Manifest</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!bundle ? (
            <div className="text-sm text-gray-600">
              Generate a signed evidence bundle for this transfer (full or redacted), then verify signature + event-chain integrity and download a ZIP archive.
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Bundle Hash
              </div>
              <div className="text-xs font-mono text-gray-900 break-all">{bundle.bundleHash}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Signer Key ID
              </div>
              <div className="text-xs font-mono text-gray-900">{bundle.signerKeyId}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Signature Validity
              </div>
              {bundleVerify?.valid ? (
                <Badge tone="success">Verified</Badge>
              ) : bundleVerify ? (
                <Badge tone="danger">Invalid</Badge>
              ) : (
                <Badge tone="info">Not checked</Badge>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Mode
              </div>
              <div className="text-xs font-mono text-gray-900">{(bundle as any).mode ?? bundleMode}</div>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Event Chain Verification Panel */}
      {eventLogs && eventLogs.length > 0 && (
        <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
          <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="text-sm font-bold text-gray-900">Event Chain Verification</h2>
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {eventLogs.map((event, idx) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 transition-colors hover:bg-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="text-xs font-medium text-gray-900">
                    {idx + 1}. {event.eventType}
                  </div>
                  <div className="text-[10px] text-gray-600">
                    {new Date(event.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {event.prevHash && (
                    <div className="text-[10px] text-gray-500 font-mono">
                      ← {event.prevHash.slice(0, 8)}...
                    </div>
                  )}
                  <Badge tone="info">Hash-linked</Badge>
                </div>
              </div>
            ))}
            <div className="pt-3 mt-3 border-t border-gray-200">
              {chainVerify?.valid ? (
                <div className="flex items-center justify-between gap-3">
                  <Badge tone="success">Chain valid</Badge>
                  {chainVerify.chainHash ? (
                    <div className="text-[10px] font-mono text-gray-600">head={chainVerify.chainHash.slice(0, 12)}…</div>
                  ) : null}
                </div>
              ) : chainVerify ? (
                <div className="space-y-2">
                  <Badge tone="danger">Chain invalid</Badge>
                  <div className="text-xs text-gray-700">
                    {chainVerify.errors.slice(0, 5).map((e) => (
                      <div key={`${e.seq}-${e.error}`} className="font-mono">
                        seq {e.seq}: {e.error}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Badge tone="info">Not checked</Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Options Panel */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-sm font-bold text-gray-900">Export Options</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => generateBundle("full")}
              disabled={loadingBundle || !canFull}
              title={!canFull ? "Requires evidence:export_full permission" : undefined}
              className="px-4 py-2 bg-black text-white text-xs font-medium rounded-xl hover:bg-gray-800 transition-all duration-200 shadow-sm"
            >
              {loadingBundle && bundleMode === "full" ? "Generating…" : "Generate Bundle (Full)"}
            </button>
            <button
              onClick={() => generateBundle("redacted")}
              disabled={loadingBundle || !canRedacted}
              title={!canRedacted ? "Requires evidence:export_redacted permission" : undefined}
              className="px-4 py-2 bg-gray-900 text-white text-xs font-medium rounded-xl hover:bg-gray-700 transition-all duration-200 shadow-sm"
            >
              {loadingBundle && bundleMode === "redacted" ? "Generating…" : "Generate Bundle (Redacted)"}
            </button>
            <button
              onClick={downloadBundle}
              disabled={
                !bundle ||
                (((bundle as any).mode ?? bundleMode) === "full" ? !canFull : !canRedacted)
              }
              className="px-4 py-2 bg-white border-2 border-black text-black text-xs font-medium rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm disabled:opacity-50"
            >
              Download ZIP
            </button>
          </div>
          <div className="bg-gray-50 border-2 border-black rounded-xl p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Verify Bundle
            </div>
            <code className="block text-xs font-mono text-gray-900 break-all">
              GET /api/wire/bundles/:id/verify + /api/wire/intents/:id/events/verify
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
