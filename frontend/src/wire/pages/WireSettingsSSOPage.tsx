import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { wireApi } from "../api/client";
import { useToast } from "../../crm/ui/CrmDesignSystem";

export default function WireSettingsSSOPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enforced, setEnforced] = useState(false);
  const [domainsText, setDomainsText] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const cfg = await wireApi.getSsoConfig();
      setEnforced(!!cfg.enforced);
      setDomainsText((cfg.allowedEmailDomains || []).join("\n"));
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Failed to load SSO config" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const allowed = domainsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      await wireApi.updateSsoConfig({ enforced, allowedEmailDomains: allowed });
      toast.push({ tone: "success", message: "SSO config updated" });
      refresh();
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Failed to save SSO config" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="border-2 border-black rounded-2xl bg-white p-6">
        <h1 className="text-xl font-bold text-gray-900">SSO (OIDC enforcement)</h1>
        <p className="text-sm text-gray-600 mt-1">
          Configure org-level SSO policy. Enforce allowed email domains and require SSO in production/OIDC mode.
        </p>
      </motion.div>

      <div className="border-2 border-black rounded-2xl bg-white p-6 space-y-4">
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : (
          <>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={enforced}
                onChange={(e) => setEnforced(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-semibold text-gray-900">Enforce SSO</span>
            </label>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Allowed email domains</label>
              <textarea
                value={domainsText}
                onChange={(e) => setDomainsText(e.target.value)}
                rows={6}
                placeholder={"acme.com\nsubsidiary.co"}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black font-mono text-sm"
              />
              <p className="mt-2 text-xs text-gray-500">One domain per line (no @).</p>
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

