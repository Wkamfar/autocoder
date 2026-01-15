import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useWireIntents } from "../hooks/useWireIntents";
import { useAuth } from "../contexts/AuthContext";
import { IntentStatusBadge, RiskScoreBadge } from "../ui/WireDesignSystem";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { WireEmptyState, WireLoadingState, WireSkeletonTable } from "../ui/WireEmptyStates";
import type { TransferIntent } from "../types/wire";
import { WireTablePagination } from "../ui/WireTablePagination";

export default function WireApprovalsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: allIntents, isLoading } = useWireIntents();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  
  // Filter intents that need this user's approval
  // In a real app, this would come from the backend filtered by approver
  const canApprove = Boolean(user && user.permissions?.includes("intent:approve"));

  const pendingApprovals = useMemo(
    () =>
      allIntents?.filter((intent) => {
        if (!user) return false;
        if (!canApprove) return false;
    // Show intents that:
    // 1. Are pending approvals (not yet approved by all required approvers)
    // 2. Are not created by the current user (maker-checker rule)
    // 3. Require approval (status is DRAFT, PENDING_PROOF, CHALLENGING, or PENDING_APPROVALS)
        return (
      (intent.status === "DRAFT" ||
       intent.status === "PENDING_PROOF" || 
       intent.status === "CHALLENGING" || 
       intent.status === "PENDING_APPROVALS") &&
      intent.createdByUserId !== user.id &&
      intent.requiredApprovals > 0
    );
      }) || [],
    [allIntents, user, canApprove]
  );

  useEffect(() => {
    setPage(1);
  }, [pendingApprovals.length]);

  const total = pendingApprovals.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedApprovals = pendingApprovals.slice((safePage - 1) * pageSize, safePage * pageSize);

  const formatAmount = (amountMinor: string, currency: string) => {
    const amount = parseFloat(amountMinor) / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Pending Approvals</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {pendingApprovals.length} intent{pendingApprovals.length !== 1 ? "s" : ""} requiring your approval
              </p>
            </div>
            {pendingApprovals.length > 0 && (
              <Badge tone="warning" className="text-sm">
                {pendingApprovals.length} Pending
              </Badge>
            )}
          </div>
        </header>
      </motion.div>

      {/* Approvals Table Panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="border-2 border-black rounded-2xl overflow-hidden bg-white flex flex-col"
      >
        {isLoading ? (
          <div className="p-6">
            <WireSkeletonTable rows={5} />
          </div>
        ) : !user ? (
          <WireEmptyState
            title="Sign in required"
            description="Please sign in to view approvals."
          />
        ) : !canApprove ? (
          <WireEmptyState
            title="Approval access required"
            description="Your role does not include intent approval. Ask an admin to grant the approver permission."
          />
        ) : pendingApprovals.length === 0 ? (
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            title="No Pending Approvals"
            description="All intents have been reviewed. Check back later for new approval requests."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Intent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Created By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Risk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {pagedApprovals.map((intent) => (
                  <tr
                    key={intent.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/intents/${intent.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {intent.purpose}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 font-mono">
                          {intent.id.slice(0, 8)}...
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatAmount(intent.amountMinor, intent.currency)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {intent.railsType}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {/* In real app, fetch creator name */}
                        Creator
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(intent.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <RiskScoreBadge score={intent.riskScore} />
                    </td>
                    <td className="px-6 py-4">
                      <IntentStatusBadge status={intent.status} />
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/intents/${intent.id}`);
                        }}
                        className="px-3 py-1.5 bg-black text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-all"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
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
