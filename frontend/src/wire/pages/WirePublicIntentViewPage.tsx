/**
 * Public Intent View + Claim
 *
 * Route: /v2/public/intents/:id
 * - Anyone can view
 * - Claim requires login; if not logged-in, we stash claimToken and send to /login
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { wireApi } from "../api/client";
import { useToast } from "../../crm/ui/CrmDesignSystem";

export default function WirePublicIntentViewPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const claimTokenFromUrl = searchParams.get("claim") || "";
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expiresAt = useMemo(() => {
    const d = data?.expiresAt ? new Date(data.expiresAt) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  }, [data?.expiresAt]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await wireApi.getPublicIntent(id);
        if (cancelled) return;
        setData(res);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load public intent");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleClaim = async () => {
    if (!id) return;
    if (!claimTokenFromUrl) {
      toast.push({ tone: "warning", message: "Missing claim token in URL (?claim=...)" });
      return;
    }

    // If user isn't logged in, the claim request will fail. We route through login,
    // then auto-claim after login completes.
    sessionStorage.setItem("wire_pending_public_intent_claim", JSON.stringify({ id, claimToken: claimTokenFromUrl }));
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl border-2 border-black rounded-2xl bg-white p-6 sm:p-8"
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Public Intent</h1>
          <p className="text-sm text-gray-600">
            View a public intent draft. To connect it to an organization, claim it (login required).
          </p>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-100 rounded w-2/3" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
            <div className="h-24 bg-gray-100 rounded" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <p className="text-red-800 text-sm">{error}</p>
            <div className="mt-3">
              <Link to="/public/intents/new" className="text-sm font-semibold underline">
                Create a new public intent
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="text-sm text-gray-700 space-y-2">
                <div>
                  <span className="text-gray-500">Status:</span>{" "}
                  <span className="font-mono">{data.status}</span>
                </div>
                <div>
                  <span className="text-gray-500">Amount:</span>{" "}
                  <span className="font-mono">{data.amountMinor} {data.currency}</span>
                </div>
                <div>
                  <span className="text-gray-500">Rails:</span>{" "}
                  <span className="font-mono">{data.railsType}</span>
                </div>
                <div>
                  <span className="text-gray-500">Purpose:</span>{" "}
                  <span>{data.purpose}</span>
                </div>
                <div>
                  <span className="text-gray-500">Beneficiary:</span>{" "}
                  <span className="font-mono">
                    {data.beneficiary?.displayName} ({data.beneficiary?.country}) ••••{data.beneficiary?.bankLast4}
                  </span>
                </div>
                {expiresAt && (
                  <div>
                    <span className="text-gray-500">Expires:</span>{" "}
                    <span className="font-mono">{expiresAt.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
              <h2 className="text-lg font-bold text-amber-900 mb-2">Claim into your org</h2>
              <p className="text-amber-800 text-sm">
                Claiming creates a real WIRE intent inside your organization and links it to this public draft.
              </p>
              <div className="mt-3">
                <button
                  onClick={handleClaim}
                  className="px-6 py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-all"
                >
                  Claim (requires login)
                </button>
              </div>
              {!claimTokenFromUrl && (
                <p className="mt-3 text-xs text-amber-800">
                  This page is missing <span className="font-mono">?claim=...</span> in the URL.
                </p>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

