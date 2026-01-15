/**
 * Invitation Acceptance Page
 *
 * Linked from invite emails: /v2/invite/:token
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { wireApi } from "../api/client";
import { useToast } from "../../crm/ui/CrmDesignSystem";

export default function WireInviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invite, setInvite] = useState<{
    id: string;
    email: string;
    role: string;
    permissions: string[];
    orgName?: string;
    expiresAt: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const expiresAt = useMemo(() => {
    if (!invite?.expiresAt) return null;
    const d = new Date(invite.expiresAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [invite?.expiresAt]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setError("Missing invitation token.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const data = await wireApi.getInvitationByToken(token);
        if (cancelled) return;
        setInvite(data);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load invitation.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!name.trim()) {
      toast.push({ tone: "warning", message: "Please enter your name" });
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await wireApi.acceptInvitation({ token, name: name.trim() });
      toast.push({ tone: "success", message: result.message || "Invitation accepted" });

      // Pre-fill email for login and route user to login.
      // (WIRE login uses email-based session provisioning; password may be optional in demo mode.)
      if (invite?.email) {
        sessionStorage.setItem("wire_prefill_email", invite.email);
      }
      navigate("/login");
    } catch (e: any) {
      const msg = e?.message || "Failed to accept invitation.";
      setError(msg);
      toast.push({ tone: "danger", message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg border-2 border-black rounded-2xl bg-white p-6 sm:p-8"
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accept invitation</h1>
          <p className="text-sm text-gray-600">
            Join your organization in WIRE and start collaborating on secure wire transfers.
          </p>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-100 rounded w-2/3" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
            <div className="h-10 bg-gray-100 rounded" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <p className="text-red-800 text-sm">{error}</p>
            <div className="mt-3">
              <Link to="/login" className="text-sm font-semibold underline">
                Go to login
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 mb-6">
              <div className="text-sm text-gray-700 space-y-1">
                <div>
                  <span className="text-gray-500">Organization:</span>{" "}
                  <strong className="text-gray-900">{invite?.orgName || "WIRE"}</strong>
                </div>
                <div>
                  <span className="text-gray-500">Invited email:</span>{" "}
                  <strong className="text-gray-900">{invite?.email}</strong>
                </div>
                <div>
                  <span className="text-gray-500">Role:</span>{" "}
                  <strong className="text-gray-900">{invite?.role}</strong>
                </div>
                {expiresAt && (
                  <div>
                    <span className="text-gray-500">Expires:</span>{" "}
                    <strong className="text-gray-900">{expiresAt.toLocaleString()}</strong>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleAccept} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black transition-colors"
                  autoFocus
                />
                <p className="mt-2 text-xs text-gray-500">
                  This name will appear in audit trails and evidence bundles.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Accepting..." : "Accept invitation"}
              </button>

              <div className="text-center text-sm text-gray-600">
                Already have access?{" "}
                <Link to="/login" className="font-semibold text-black hover:underline">
                  Sign in
                </Link>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

