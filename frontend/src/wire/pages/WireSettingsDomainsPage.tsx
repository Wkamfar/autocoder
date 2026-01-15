import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { wireApi } from "../api/client";
import { useToast } from "../../crm/ui/CrmDesignSystem";

export default function WireSettingsDomainsPage() {
  const toast = useToast();
  const [customDomains, setCustomDomains] = useState<any[]>([]);
  const [emailDomains, setEmailDomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [emailDomainInput, setEmailDomainInput] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [cd, ed] = await Promise.all([wireApi.getCustomDomains(), wireApi.getEmailDomains()]);
      setCustomDomains(cd);
      setEmailDomains(ed);
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Failed to load domains" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCustom = async () => {
    try {
      await wireApi.addCustomDomain(customDomainInput);
      setCustomDomainInput("");
      toast.push({ tone: "success", message: "Custom domain added" });
      refresh();
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Failed to add domain" });
    }
  };

  const verifyCustom = async (id: string) => {
    try {
      const res = await wireApi.verifyCustomDomain(id);
      toast.push({ tone: res.ok ? "success" : "warning", message: res.ok ? "Verified" : "Not verified yet" });
      refresh();
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Verification failed" });
    }
  };

  const removeCustom = async (id: string) => {
    try {
      await wireApi.deleteCustomDomain(id);
      toast.push({ tone: "success", message: "Removed" });
      refresh();
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Failed to remove" });
    }
  };

  const addEmail = async () => {
    try {
      await wireApi.addEmailDomain(emailDomainInput);
      setEmailDomainInput("");
      toast.push({ tone: "success", message: "Email domain added" });
      refresh();
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Failed to add email domain" });
    }
  };

  const verifyEmail = async (id: string) => {
    try {
      const res = await wireApi.verifyEmailDomain(id);
      toast.push({ tone: res.ok ? "success" : "warning", message: res.ok ? "Verified" : "Not verified yet" });
      refresh();
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Verification failed" });
    }
  };

  const removeEmail = async (id: string) => {
    try {
      await wireApi.deleteEmailDomain(id);
      toast.push({ tone: "success", message: "Removed" });
      refresh();
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Failed to remove" });
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="border-2 border-black rounded-2xl bg-white p-6">
        <h1 className="text-xl font-bold text-gray-900">Domains</h1>
        <p className="text-sm text-gray-600 mt-1">
          Self-serve custom domain + custom email domain (SPF/DKIM/DMARC) with DNS verification.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Custom domains */}
        <div className="border-2 border-black rounded-2xl bg-white p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Custom domain</h2>
            <p className="text-sm text-gray-600">Verify ownership via TXT record.</p>
          </div>
          <div className="flex gap-2">
            <input
              value={customDomainInput}
              onChange={(e) => setCustomDomainInput(e.target.value)}
              placeholder="pay.acme.com"
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
            />
            <button onClick={addCustom} className="px-4 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800">
              Add
            </button>
          </div>
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <div className="space-y-3">
              {customDomains.map((d) => (
                <div key={d.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">{d.domain}</div>
                      <div className="text-xs text-gray-600">Status: <span className="font-mono">{d.status}</span></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => verifyCustom(d.id)} className="px-3 py-2 border-2 border-black rounded-lg text-sm font-semibold hover:bg-white">
                        Verify
                      </button>
                      <button onClick={() => removeCustom(d.id)} className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-semibold hover:bg-white">
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-700">
                    <div className="font-semibold mb-1">DNS record</div>
                    <div className="font-mono bg-white border border-gray-200 rounded-lg p-2">
                      TXT {d.verification.name} {d.verification.value}
                    </div>
                    {d.lastError && <div className="mt-2 text-red-700">{d.lastError}</div>}
                  </div>
                </div>
              ))}
              {customDomains.length === 0 && <div className="text-sm text-gray-500">No custom domains yet.</div>}
            </div>
          )}
        </div>

        {/* Email domains */}
        <div className="border-2 border-black rounded-2xl bg-white p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Custom email domain</h2>
            <p className="text-sm text-gray-600">Set SPF + DKIM + DMARC, then verify.</p>
          </div>
          <div className="flex gap-2">
            <input
              value={emailDomainInput}
              onChange={(e) => setEmailDomainInput(e.target.value)}
              placeholder="acme.com"
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
            />
            <button onClick={addEmail} className="px-4 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800">
              Add
            </button>
          </div>
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <div className="space-y-3">
              {emailDomains.map((d) => (
                <div key={d.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">{d.domain}</div>
                      <div className="text-xs text-gray-600">Status: <span className="font-mono">{d.status}</span></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => verifyEmail(d.id)} className="px-3 py-2 border-2 border-black rounded-lg text-sm font-semibold hover:bg-white">
                        Verify
                      </button>
                      <button onClick={() => removeEmail(d.id)} className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-semibold hover:bg-white">
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-700 space-y-2">
                    <div className="font-semibold">DNS records</div>
                    <div className="font-mono bg-white border border-gray-200 rounded-lg p-2">
                      TXT {d.records.spf.name} {d.records.spf.value}
                    </div>
                    <div className="font-mono bg-white border border-gray-200 rounded-lg p-2">
                      TXT {d.records.dkim.name} {d.records.dkim.value}
                    </div>
                    <div className="font-mono bg-white border border-gray-200 rounded-lg p-2">
                      TXT {d.records.dmarc.name} {d.records.dmarc.value}
                    </div>
                    {d.lastError && <div className="text-red-700">{d.lastError}</div>}
                  </div>
                </div>
              ))}
              {emailDomains.length === 0 && <div className="text-sm text-gray-500">No email domains yet.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

