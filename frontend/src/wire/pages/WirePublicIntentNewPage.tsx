/**
 * Public Intent Creation (no login, no password gate)
 *
 * Route: /v2/public/intents/new
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { wireApi } from "../api/client";
import { useToast } from "../../crm/ui/CrmDesignSystem";

export default function WirePublicIntentNewPage() {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<null | {
    id: string;
    claimUrl: string;
    claimToken: string;
    expiresAt: string;
  }>(null);

  const [form, setForm] = useState({
    railsType: "WIRE" as "WIRE" | "ACH",
    amountMinor: "10000",
    currency: "USD",
    purpose: "Invoice payment",
    beneficiaryDisplayName: "Acme Corp",
    beneficiaryCountry: "US",
    beneficiaryBankLast4: "0000",
    beneficiaryBankToken: "demo_bank_token_replace_me",
    requestorEmail: "",
    requestorName: "",
  });

  const onChange = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const created = await wireApi.createPublicIntent({
        railsType: form.railsType,
        amountMinor: form.amountMinor.trim(),
        currency: form.currency.trim().toUpperCase(),
        purpose: form.purpose.trim(),
        beneficiary: {
          displayName: form.beneficiaryDisplayName.trim(),
          country: form.beneficiaryCountry.trim().toUpperCase(),
          bankLast4: form.beneficiaryBankLast4.trim(),
          bankToken: form.beneficiaryBankToken.trim(),
        },
        requestor:
          form.requestorEmail.trim() || form.requestorName.trim()
            ? {
                email: form.requestorEmail.trim() || undefined,
                name: form.requestorName.trim() || undefined,
              }
            : undefined,
      });

      setResult({
        id: created.id,
        claimUrl: created.claimUrl,
        claimToken: created.claimToken,
        expiresAt: created.expiresAt,
      });

      toast.push({ tone: "success", message: "Public intent created" });
    } catch (err: any) {
      toast.push({ tone: "danger", message: err?.message || "Failed to create public intent" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl border-2 border-black rounded-2xl bg-white p-6 sm:p-8"
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create a Public Intent (no login)</h1>
          <p className="text-sm text-gray-600">
            This creates a shareable “intent draft” that can later be claimed into an organization.
          </p>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
              <h2 className="text-lg font-bold text-emerald-900 mb-2">Success</h2>
              <p className="text-emerald-800 text-sm">
                Your public intent is created. Anyone with the claim URL can view it; only someone with the claim token can claim it.
              </p>
            </div>

            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="text-sm text-gray-700 space-y-2">
                <div>
                  <span className="text-gray-500">Intent ID:</span>{" "}
                  <span className="font-mono">{result.id}</span>
                </div>
                <div>
                  <span className="text-gray-500">Expires:</span>{" "}
                  <span className="font-mono">{new Date(result.expiresAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Claim URL:</span>{" "}
                  <a className="underline font-mono" href={result.claimUrl}>
                    {result.claimUrl}
                  </a>
                </div>
                <div>
                  <span className="text-gray-500">Claim token (save this):</span>{" "}
                  <span className="font-mono">{result.claimToken}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setResult(null)}
              className="px-6 py-3 border-2 border-black rounded-xl font-semibold hover:bg-gray-50 transition-all"
            >
              Create another
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Rails</label>
                <select
                  value={form.railsType}
                  onChange={(e) => onChange("railsType", e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black bg-white"
                >
                  <option value="WIRE">WIRE</option>
                  <option value="ACH">ACH</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Currency</label>
                <input
                  value={form.currency}
                  onChange={(e) => onChange("currency", e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Amount (minor units)</label>
                <input
                  value={form.amountMinor}
                  onChange={(e) => onChange("amountMinor", e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Purpose</label>
                <input
                  value={form.purpose}
                  onChange={(e) => onChange("purpose", e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h2 className="text-lg font-bold text-gray-900 mb-3">Beneficiary</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Display name</label>
                  <input
                    value={form.beneficiaryDisplayName}
                    onChange={(e) => onChange("beneficiaryDisplayName", e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Country (2-letter)</label>
                  <input
                    value={form.beneficiaryCountry}
                    onChange={(e) => onChange("beneficiaryCountry", e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Bank last 4</label>
                  <input
                    value={form.beneficiaryBankLast4}
                    onChange={(e) => onChange("beneficiaryBankLast4", e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Bank token (opaque)</label>
                  <input
                    value={form.beneficiaryBankToken}
                    onChange={(e) => onChange("beneficiaryBankToken", e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    This is hashed before storage. Don’t paste raw account/routing numbers here.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h2 className="text-lg font-bold text-gray-900 mb-3">Requestor (optional)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Email</label>
                  <input
                    type="email"
                    value={form.requestorEmail}
                    onChange={(e) => onChange("requestorEmail", e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Name</label>
                  <input
                    value={form.requestorName}
                    onChange={(e) => onChange("requestorName", e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create Public Intent"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

