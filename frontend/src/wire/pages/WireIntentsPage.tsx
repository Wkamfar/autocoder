import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useWireIntents, useCreateIntent } from "../hooks/useWireIntents";
import { useWireBeneficiaries } from "../hooks/useWireIntents";
import { WireIntentForm } from "../components/WireIntentForm";
import { IntentStatusBadge, RiskScoreBadge } from "../ui/WireDesignSystem";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { WireEmptyState, WireLoadingState, WireErrorState, WireSkeletonTable } from "../ui/WireEmptyStates";
import { useAuth } from "../contexts/AuthContext";
import type { TransferIntent } from "../types/wire";
import { WireTablePagination } from "../ui/WireTablePagination";

export default function WireIntentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: intents, isLoading } = useWireIntents();
  const { data: beneficiaries } = useWireBeneficiaries();
  const createIntent = useCreateIntent();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "my" | "pending">("all");
  const [railFilter, setRailFilter] = useState<"all" | "ACH" | "WIRE">("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const handleCreateIntent = async (data: Partial<TransferIntent>) => {
    const result = await createIntent.mutateAsync(data);
    setShowForm(false);
    navigate(`/intents/${result.id}`);
  };

  const formatAmount = (amountMinor: string, currency: string) => {
    const amount = parseFloat(amountMinor) / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  // Filter intents based on selected filter
  const filteredIntents = intents?.filter((intent) => {
    // Rail type filter
    if (railFilter !== "all" && intent.railsType !== railFilter) {
      return false;
    }
    
    // Status/user filter
    if (filter === "my") {
      return intent.createdByUserId === user?.id;
    } else if (filter === "pending") {
      return (
        intent.status === "PENDING_PROOF" ||
        intent.status === "CHALLENGING" ||
        intent.status === "PENDING_APPROVALS"
      );
    }
    return true; // "all"
  }) || [];

  const canCreate = Boolean(user && user.permissions?.includes("intent:create"));
  const createDisabledReason = !user
    ? "Sign in to create intents."
    : !canCreate
      ? "You don’t have permission to create intents."
      : undefined;

  useEffect(() => {
    setPage(1);
  }, [filter, railFilter, filteredIntents.length]);

  const total = filteredIntents.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedIntents = useMemo(
    () => filteredIntents.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredIntents, safePage]
  );

  // Avoid per-row framer-motion when lists get large (prevents UI jank).
  const enableRowMotion = pagedIntents.length <= 25;

  if (showForm && beneficiaries) {
    return (
      <div>
        <WireIntentForm
          beneficiaries={beneficiaries}
          onSubmit={handleCreateIntent}
          onCancel={() => setShowForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div>
              <h2 className="text-base font-bold text-gray-900">Transfer Intents</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Money you are sending • {filteredIntents.length} {filter === "all" ? "total" : filter === "my" ? "created by you" : "pending"}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:gap-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
                  <button
                    onClick={() => setFilter("all")}
                    className={`px-3 py-2.5 sm:py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                      filter === "all"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilter("my")}
                    className={`px-3 py-2.5 sm:py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                      filter === "my"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    My Intents
                  </button>
                  <button
                    onClick={() => setFilter("pending")}
                    className={`px-3 py-2.5 sm:py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                      filter === "pending"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Pending
                  </button>
                </div>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
                  <button
                    onClick={() => setRailFilter("all")}
                    className={`px-3 py-2.5 sm:py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                      railFilter === "all"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    All Rails
                  </button>
                  <button
                    onClick={() => setRailFilter("ACH")}
                    className={`px-3 py-2.5 sm:py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                      railFilter === "ACH"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    ACH
                  </button>
                  <button
                    onClick={() => setRailFilter("WIRE")}
                    className={`px-3 py-2.5 sm:py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                      railFilter === "WIRE"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    WIRE
                  </button>
                </div>
                <button
                  onClick={() => setShowForm(true)}
                  disabled={!canCreate}
                  title={!canCreate ? createDisabledReason : undefined}
                  className="px-5 py-3 sm:py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all duration-150 active:scale-95 min-h-[44px] sm:min-h-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Create Intent
                </button>
              </div>
              {!canCreate && createDisabledReason && (
                <div className="text-[11px] text-gray-500">{createDisabledReason}</div>
              )}
            </div>
          </div>
        </header>
      </motion.div>

      {/* Intents Table Panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="border-2 border-black rounded-2xl overflow-hidden bg-white flex flex-col"
      >
        {isLoading ? (
          <div className="p-6">
            <WireSkeletonTable rows={8} />
          </div>
        ) : filteredIntents.length === 0 ? (
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
            description="Create your first transfer intent to get started. Each intent requires voice approval for security."
            action={{
              label: "Create Intent",
              onClick: () => setShowForm(true),
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-900 to-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Rail
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Risk
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {pagedIntents.map((intent, index) =>
                  enableRowMotion ? (
                    <motion.tr
                      key={intent.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/intents/${intent.id}`)}
                    >
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">
                      {intent.id.slice(0, 12)}...
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {formatAmount(intent.amountMinor, intent.currency)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={intent.railsType === "ACH" ? "info" : "neutral"}>
                        {intent.railsType}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <IntentStatusBadge status={intent.status} />
                    </td>
                    <td className="px-6 py-4">
                      <RiskScoreBadge score={intent.riskScore} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(intent.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/intents/${intent.id}`);
                        }}
                        className="text-xs text-gray-600 hover:text-gray-900 font-medium transition-colors"
                      >
                        View →
                      </button>
                    </td>
                    </motion.tr>
                  ) : (
                    <tr
                      key={intent.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/intents/${intent.id}`)}
                    >
                      <td className="px-6 py-4 text-sm font-mono text-gray-600">
                        {intent.id.slice(0, 12)}...
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {formatAmount(intent.amountMinor, intent.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={intent.railsType === "ACH" ? "info" : "neutral"}>
                          {intent.railsType}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <IntentStatusBadge status={intent.status} />
                      </td>
                      <td className="px-6 py-4">
                        <RiskScoreBadge score={intent.riskScore} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(intent.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/intents/${intent.id}`);
                          }}
                          className="text-xs text-gray-600 hover:text-gray-900 font-medium transition-colors"
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
            <WireTablePagination
              total={total}
              page={safePage}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
