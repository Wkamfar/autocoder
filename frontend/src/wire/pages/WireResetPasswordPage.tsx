import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "../../crm/ui/CrmDesignSystem";
import { wireApi } from "../api/client";
import { WireBrand } from "../ui/WireBrand";

export default function WireResetPasswordPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const token = useMemo(() => params.get("t") || "", [params]);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.push({ tone: "danger", message: "Missing reset token. Please request a new email." });
      return;
    }
    if (pw.length < 8) {
      toast.push({ tone: "warning", message: "Password must be at least 8 characters." });
      return;
    }
    if (pw !== pw2) {
      toast.push({ tone: "warning", message: "Passwords do not match." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await wireApi.confirmPasswordReset({ token, newPassword: pw });
      localStorage.setItem("wire_auth_token", res.token);
      toast.push({ tone: "success", message: "Password updated. You’re signed in." });

      // Route to admin/intents depending on role.
      const me = await wireApi.getMe();
      navigate(me.user.role === "ADMIN" ? "/admin" : "/intents", { replace: true });
    } catch (err: any) {
      toast.push({
        tone: "danger",
        message: err?.message || "Reset failed. Request a new reset link and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mb-3">
              <WireBrand size="lg" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Set a new password</h1>
            <p className="text-gray-600 text-sm mt-1">This link works once.</p>
          </div>

          {!token ? (
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <div className="text-sm font-semibold text-gray-900">Invalid link</div>
                <div className="text-sm text-gray-600 mt-1">Request a new reset email to continue.</div>
              </div>
              <Link
                to="/forgot-password"
                className="inline-flex w-full items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white"
              >
                Request new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New password</label>
                <input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition-all border-gray-300 focus:border-black"
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm new password</label>
                <input
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition-all border-gray-300 focus:border-black"
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-black text-white font-semibold py-3 rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Updating…" : "Update password"}
              </button>

              <div className="text-center">
                <Link to="/login" className="text-sm font-semibold text-black hover:underline">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

