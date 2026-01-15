import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useWireIntents } from "../hooks/useWireIntents";
import { IntentStatusBadge, RiskScoreBadge } from "../ui/WireDesignSystem";
import { Badge, SkeletonMetrics } from "../../crm/ui/CrmDesignSystem";
import { WireProblemStatement } from "../components/WireProblemStatement";
import { WireLoadingState, WireEmptyState } from "../ui/WireEmptyStates";

export default function WireOverviewPage() {
  const navigate = useNavigate();
  const { data: intents, isLoading } = useWireIntents();

  const formatAmount = (amountMinor: string, currency: string) => {
    const amount = parseFloat(amountMinor) / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const stats = {
    total: intents?.length || 0,
    pending: intents?.filter((i) => i.status === "PENDING_PROOF" || i.status === "CHALLENGING").length || 0,
    approved: intents?.filter((i) => i.status === "APPROVED").length || 0,
    executed: intents?.filter((i) => i.status === "EXECUTED").length || 0,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonMetrics />
        <div className="border-2 border-black rounded-2xl bg-white p-6">
          <WireLoadingState message="Loading dashboard..." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Problem Statement & Security Guarantees */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <WireProblemStatement />
      </motion.div>

      {/* Live Metrics Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 shadow-lg border-2 border-black"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Total Intents */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-bold font-mono text-white">{stats.total}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total Intents</p>
              </div>
            </div>
            
            <div className="w-px h-10 bg-white/10" />
            
            {/* Pending */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-bold font-mono text-white">{stats.pending}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Pending</p>
              </div>
            </div>
            
            <div className="w-px h-10 bg-white/10" />
            
            {/* Approved */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-bold font-mono text-white">{stats.approved}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Approved</p>
              </div>
            </div>
            
            <div className="w-px h-10 bg-white/10" />
            
            {/* Executed */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-bold font-mono text-white">{stats.executed}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Executed</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Recent Intents Panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Recent Intents</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {intents ? `${intents.length} total` : "Loading..."}
              </p>
            </div>
            <button
              onClick={() => navigate("/intents")}
              className="text-xs text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              View All →
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {!intents || intents.length === 0 ? (
            <WireEmptyState
              icon={
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              title="No Transfer Intents"
              description="Create your first transfer intent to get started with secure voice-authorized transfers."
              action={{
                label: "Create Intent",
                onClick: () => navigate("/intents"),
              }}
            />
          ) : (
            <div className="space-y-2">
              {intents.slice(0, 5).map((intent, index) => (
                <motion.button
                  key={intent.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/intents/${intent.id}`)}
                  className="w-full text-left flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-150 border border-gray-200 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatAmount(intent.amountMinor, intent.currency)}
                    </div>
                    <Badge tone="neutral">{intent.railsType}</Badge>
                    <IntentStatusBadge status={intent.status} />
                    <RiskScoreBadge score={intent.riskScore} />
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(intent.createdAt).toLocaleDateString()}
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
