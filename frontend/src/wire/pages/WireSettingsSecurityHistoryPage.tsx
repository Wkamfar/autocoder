import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { wireApi } from "../api/client";
import { useToast } from "../../crm/ui/CrmDesignSystem";

function safeJsonPreview(s?: string | null): string {
  if (!s) return "";
  try {
    const obj = JSON.parse(s);
    return JSON.stringify(obj, null, 2);
  } catch {
    return s;
  }
}

export default function WireSettingsSecurityHistoryPage() {
  const toast = useToast();
  const [days, setDays] = useState(180);
  const [limit, setLimit] = useState(200);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [exporting, setExporting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await wireApi.getSecurityHistory({ days, limit });
      setRows(data);
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Failed to load security history" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedDetails = useMemo(() => safeJsonPreview(selected?.detailsJson), [selected?.detailsJson]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="border-2 border-black rounded-2xl bg-white p-6">
        <h1 className="text-xl font-bold text-gray-900">Security history</h1>
        <p className="text-sm text-gray-600 mt-1">
          Organization activity log. Shows auth + permission events.
        </p>
      </motion.div>

      <div className="border-2 border-black rounded-2xl bg-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Days</label>
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value || "180", 10))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Limit</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value || "200", 10))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
            />
          </div>
          <button onClick={refresh} className="px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800">
            Refresh
          </button>
          <button
            onClick={async () => {
              setExporting(true);
              try {
                // Uses authenticated CSV download helper from the client
                await (wireApi as any).downloadSecurityHistoryCsv?.(days);
                toast.push({ tone: "success", message: "Security history CSV downloaded" });
              } catch (e: any) {
                toast.push({ tone: "danger", message: e?.message || "Export failed" });
              } finally {
                setExporting(false);
              }
            }}
            className="px-6 py-3 bg-white border-2 border-black text-black rounded-xl font-semibold hover:bg-gray-50 disabled:opacity-50"
            disabled={exporting}
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-500">No events found.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {rows.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left border rounded-xl p-3 transition-colors ${
                    selected?.id === r.id ? "border-black bg-gray-50" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-gray-900 text-sm">{r.eventType}</div>
                    <div className="text-xs text-gray-500 font-mono">{new Date(r.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="mt-1 text-xs text-gray-600 font-mono truncate">
                    user={r.userId || "—"} ip={r.ipAddress || "—"}
                  </div>
                </button>
              ))}
            </div>

            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="font-bold text-gray-900 mb-2">Details</div>
              {selected ? (
                <pre className="text-xs font-mono whitespace-pre-wrap break-words text-gray-800">
                  {selectedDetails || "(no details)"}
                </pre>
              ) : (
                <div className="text-sm text-gray-500">Select an event to inspect details.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

