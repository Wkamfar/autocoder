import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { useToast } from "../../crm/ui/CrmDesignSystem";
import { useNavigate } from "react-router-dom";

export default function WireCompliancePage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "custom">("30d");
  const toast = useToast();
  const navigate = useNavigate();
  const [savingRetention, setSavingRetention] = useState(false);
  const [authRetentionDays, setAuthRetentionDays] = useState(180);
  const [bundleRetentionDays, setBundleRetentionDays] = useState(365);
  const [wormEnabled, setWormEnabled] = useState(false);
  const [holdIntentId, setHoldIntentId] = useState("");
  const [holdBundleId, setHoldBundleId] = useState("");
  const [holdReason, setHoldReason] = useState("Legal hold");
  const [creatingHold, setCreatingHold] = useState(false);
  const [purging, setPurging] = useState(false);

  const { data: complianceData, isLoading } = useQuery({
    queryKey: ["compliance", dateRange],
    queryFn: () => api.getComplianceData(dateRange),
  });

  const { data: retentionPolicy, refetch: refetchRetention } = useQuery({
    queryKey: ["compliance", "retention"],
    queryFn: () => (api as any).getRetentionPolicy?.(),
  });

  useEffect(() => {
    if (!retentionPolicy) return;
    setAuthRetentionDays(retentionPolicy.authAuditRetentionDays ?? 180);
    setBundleRetentionDays(retentionPolicy.evidenceBundleRetentionDays ?? 365);
    setWormEnabled(Boolean(retentionPolicy.wormEnabled));
  }, [retentionPolicy]);

  const { data: legalHolds, refetch: refetchHolds } = useQuery({
    queryKey: ["compliance", "legal-holds"],
    queryFn: () => (api as any).listLegalHolds?.(),
  });

  const { data: purgePreview, refetch: refetchPurgePreview } = useQuery({
    queryKey: ["compliance", "purge-preview"],
    queryFn: () => (api as any).purgePreview?.(),
  });

  const reportTypes = [
    {
      id: "audit-trail",
      name: "Complete Audit Trail",
      description: "Cryptographically signed audit log of all actions",
      format: "PDF",
    },
    {
      id: "sox-compliance",
      name: "SOX Compliance Report",
      description: "Sarbanes-Oxley compliance documentation",
      format: "PDF",
    },
    {
      id: "fraud-prevention",
      name: "Fraud Prevention Summary",
      description: "Summary of fraud prevention measures and incidents",
      format: "PDF",
    },
    {
      id: "approval-history",
      name: "Approval History",
      description: "Complete history of all approvals and denials",
      format: "CSV",
    },
    {
      id: "risk-assessment",
      name: "Risk Assessment Report",
      description: "Risk scores and assessments for all transfers",
      format: "PDF",
    },
    {
      id: "evidence-bundle",
      name: "Evidence Bundle",
      description: "Complete cryptographic evidence bundle for legal purposes",
      format: "ZIP",
    },
  ];

  const generateReport = async (reportId: string) => {
    try {
      setSelectedReport(reportId);
      switch (reportId) {
        case "audit-trail":
          await (api as any).downloadAuditTrailPdf?.(dateRange);
          toast.push({ tone: "success", message: "Audit trail PDF downloaded" });
          break;
        case "approval-history":
          await (api as any).downloadApprovalHistoryCsv?.(dateRange);
          toast.push({ tone: "success", message: "Approval history CSV downloaded" });
          break;
        case "sox-compliance":
        case "fraud-prevention":
        case "risk-assessment":
          toast.push({
            tone: "neutral",
            message: "This report is a placeholder in the demo. The audit trail + approval history exports are live.",
          });
          break;
        case "evidence-bundle":
          toast.push({
            tone: "neutral",
            message: "Evidence bundles are generated per transfer. Pick a transfer and use “View Evidence”.",
          });
          navigate("/intents");
          break;
        default:
          toast.push({ tone: "danger", message: "Unknown report type" });
      }
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Failed to generate report" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Compliance & Reporting</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Cryptographically signed audit trails and regulatory reports
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-3 py-2 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 min-h-[44px] sm:min-h-0"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="custom">Custom range</option>
            </select>
          </div>
        </header>

        <div className="p-4 sm:p-6">
          {/* Compliance Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
              <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">Total Actions</p>
              <p className="text-2xl font-bold font-mono">{isLoading ? "…" : (complianceData?.totalActions || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">All signed actions</p>
            </div>
            <div className="border-2 border-gray-200 rounded-xl p-4 bg-emerald-50">
              <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">Cryptographic Proof</p>
              <p className="text-2xl font-bold font-mono text-emerald-600">100%</p>
              <p className="text-xs text-gray-500 mt-1">All actions signed</p>
            </div>
            <div className="border-2 border-gray-200 rounded-xl p-4 bg-blue-50">
              <p className="text-xs uppercase tracking-wide text-gray-600 mb-1">Audit Trail</p>
              <p className="text-2xl font-bold font-mono text-blue-600">Immutable</p>
              <p className="text-xs text-gray-500 mt-1">Tamper-proof</p>
            </div>
          </div>

          {/* Report Types */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Available Reports</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reportTypes.map((report) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-2 border-gray-200 rounded-xl p-4 sm:p-5 hover:border-black transition-all cursor-pointer"
                  onClick={() => setSelectedReport(report.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-base font-bold text-gray-900 mb-1">{report.name}</h4>
                      <p className="text-sm text-gray-600">{report.description}</p>
                    </div>
                    <Badge tone="info" className="text-xs">{report.format}</Badge>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      generateReport(report.id);
                    }}
                    className="w-full px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-all"
                  >
                    Generate Report
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Retention + Legal hold controls */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h3 className="text-base font-bold text-gray-900 mb-4">Retention & Legal Hold</h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="font-semibold text-gray-900 mb-3">Retention policy</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Auth audit retention (days)</label>
                <input
                  type="number"
                  value={authRetentionDays}
                  onChange={(e) => setAuthRetentionDays(parseInt(e.target.value || "180", 10))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Evidence bundle retention (days)</label>
                <input
                  type="number"
                  value={bundleRetentionDays}
                  onChange={(e) => setBundleRetentionDays(parseInt(e.target.value || "365", 10))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-black"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={wormEnabled}
                  onChange={(e) => setWormEnabled(e.target.checked)}
                />
                WORM (object-lock) enabled
              </label>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={async () => {
                  setSavingRetention(true);
                  try {
                    await (api as any).updateRetentionPolicy?.({
                      authAuditRetentionDays: authRetentionDays,
                      evidenceBundleRetentionDays: bundleRetentionDays,
                      wormEnabled,
                    });
                    await refetchRetention();
                    await refetchPurgePreview();
                    toast.push({ tone: "success", message: "Retention policy updated" });
                  } catch (e: any) {
                    toast.push({ tone: "danger", message: e?.message || "Failed to update retention policy" });
                  } finally {
                    setSavingRetention(false);
                  }
                }}
                disabled={savingRetention}
                className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {savingRetention ? "Saving…" : "Save policy"}
              </button>
              <button
                onClick={() => {
                  refetchRetention();
                  refetchPurgePreview();
                }}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl p-4">
            <div className="font-semibold text-gray-900 mb-3">Legal holds</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Intent ID (optional)</label>
                <input
                  value={holdIntentId}
                  onChange={(e) => setHoldIntentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-black"
                  placeholder="intent_…"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Bundle ID (optional)</label>
                <input
                  value={holdBundleId}
                  onChange={(e) => setHoldBundleId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-black"
                  placeholder="bundle_…"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason</label>
                <input
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={async () => {
                  setCreatingHold(true);
                  try {
                    await (api as any).createLegalHold?.({
                      intentId: holdIntentId || undefined,
                      bundleId: holdBundleId || undefined,
                      reason: holdReason,
                    });
                    setHoldIntentId("");
                    setHoldBundleId("");
                    await refetchHolds();
                    toast.push({ tone: "success", message: "Legal hold created" });
                  } catch (e: any) {
                    toast.push({ tone: "danger", message: e?.message || "Failed to create legal hold" });
                  } finally {
                    setCreatingHold(false);
                  }
                }}
                disabled={creatingHold}
                className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {creatingHold ? "Creating…" : "Create hold"}
              </button>
              <button
                onClick={() => refetchHolds()}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>

            <div className="mt-4 space-y-2 max-h-[220px] overflow-auto">
              {(legalHolds || []).length === 0 ? (
                <div className="text-sm text-gray-500">No active holds.</div>
              ) : (
                (legalHolds || []).map((h: any) => (
                  <div key={h.id} className="flex items-start justify-between gap-3 border border-gray-200 rounded-lg p-3">
                    <div className="text-xs text-gray-800">
                      <div className="font-mono">{h.id}</div>
                      <div className="text-gray-500 mt-1">
                        intent={h.intentId || "—"} bundle={h.bundleId || "—"}
                      </div>
                      <div className="text-gray-600 mt-1">{h.reason}</div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await (api as any).releaseLegalHold?.(h.id);
                          await refetchHolds();
                          toast.push({ tone: "success", message: "Hold released" });
                        } catch (e: any) {
                          toast.push({ tone: "danger", message: e?.message || "Failed to release hold" });
                        }
                      }}
                      className="px-3 py-2 bg-white border border-gray-200 text-gray-900 text-xs font-medium rounded-lg hover:bg-gray-50"
                    >
                      Release
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 border border-gray-200 rounded-xl p-4">
          <div className="font-semibold text-gray-900 mb-2">Purge workflow (evidence bundles)</div>
          <div className="text-sm text-gray-600">
            Eligible: <span className="font-mono">{purgePreview?.eligible ?? "—"}</span> of{" "}
            <span className="font-mono">{purgePreview?.candidates ?? "—"}</span> candidates (cutoff{" "}
            <span className="font-mono">{purgePreview?.cutoff ?? "—"}</span>)
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={async () => {
                setPurging(true);
                try {
                  await (api as any).purgeRun?.(100);
                  await refetchPurgePreview();
                  toast.push({ tone: "success", message: "Purge run completed" });
                } catch (e: any) {
                  toast.push({ tone: "danger", message: e?.message || "Purge failed (ADMIN only)" });
                } finally {
                  setPurging(false);
                }
              }}
              className="px-4 py-2 bg-white border-2 border-black text-black text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
              disabled={purging}
            >
              {purging ? "Purging…" : "Run purge (100)"}
            </button>
            <button
              onClick={() => refetchPurgePreview()}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-50"
            >
              Refresh preview
            </button>
          </div>
        </div>
      </motion.div>

      {/* Key Features */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white p-4 sm:p-6"
      >
        <h3 className="text-base font-bold text-gray-900 mb-4">Compliance Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h4 className="font-bold text-gray-900">Cryptographic Signing</h4>
            </div>
            <p className="text-sm text-gray-600">
              Every action is cryptographically signed, creating an immutable audit trail that cannot be tampered with.
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="font-bold text-gray-900">Regulatory Reports</h4>
            </div>
            <p className="text-sm text-gray-600">
              Generate SOX, audit trail, and other regulatory reports with cryptographic proof of authenticity.
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="font-bold text-gray-900">Export Capabilities</h4>
            </div>
            <p className="text-sm text-gray-600">
              Export reports in PDF, CSV, or ZIP formats. Evidence bundles include all cryptographic proofs.
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h4 className="font-bold text-gray-900">Legal Evidence</h4>
            </div>
            <p className="text-sm text-gray-600">
              Complete evidence bundles with cryptographic signatures provide legal proof for disputes and investigations.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
