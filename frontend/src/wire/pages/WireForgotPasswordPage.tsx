import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "../../crm/ui/CrmDesignSystem";
import { wireApi } from "../api/client";
import { WireBrand } from "../ui/WireBrand";

export default function WireForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.push({ tone: "warning", message: "Enter your email address" });
      return;
    }
    setSubmitting(true);
    try {
      await wireApi.requestPasswordReset(email.trim());
      setSent(true);
      toast.push({ tone: "success", message: "If an account exists, a reset link has been sent." });
    } catch (err: any) {
      // Still keep response vague to avoid enumeration.
      setSent(true);
      toast.push({ tone: "success", message: "If an account exists, a reset link has been sent." });
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
            <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
            <p className="text-gray-600 text-sm mt-1">
              We’ll email you a secure one‑time link to set a new password.
            </p>
          </div>

          {sent ? (
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <div className="text-sm font-semibold text-gray-900">Check your inbox</div>
                <div className="text-sm text-gray-600 mt-1">
                  If an account exists for <span className="font-mono">{email.trim()}</span>, you’ll receive a reset link.
                  It expires in 60 minutes and can only be used once.
                </div>
              </div>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition-all border-gray-300 focus:border-black"
                  autoFocus
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-black text-white font-semibold py-3 rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending…" : "Send reset link"}
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

