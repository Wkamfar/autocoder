import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { WireRequestCard } from "../components/WireRequestCard";
import { WireRequestDetailModal } from "../components/WireRequestDetailModal";
import { WireEmptyState, WireLoadingState, WireSkeletonTable } from "../ui/WireEmptyStates";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import type { PaymentRequest } from "../types/wire";

// Production: Requests are not yet backed by a real API in this build.
// Never show mock requests in production.
const REQUESTS: PaymentRequest[] = [];

export default function WireRequestQueuePage() {
  const navigate = useNavigate();
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "denied">("all");
  const [isLoading] = useState(false);

  const filteredRequests = REQUESTS.filter((req) => {
    if (filter === "all") return true;
    if (filter === "pending") return req.status === "PENDING_APPROVAL";
    if (filter === "approved") return req.status === "APPROVED";
    if (filter === "denied") return req.status === "DENIED";
    return true;
  });

  const formatAmount = (amountMinor: string, currency: string) => {
    const amount = parseFloat(amountMinor) / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div>
              <h2 className="text-base font-bold text-gray-900">Payment Requests</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {filteredRequests.length === 0
                  ? "No requests yet"
                  : `Money you are asking for • ${filteredRequests.length} ${filter === "all" ? "total" : filter}`}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2">
              <div className="flex items-center gap-1 overflow-x-auto">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-3 py-2.5 sm:py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                    filter === "all"
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("pending")}
                  className={`px-3 py-2.5 sm:py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                    filter === "pending"
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setFilter("approved")}
                  className={`px-3 py-2.5 sm:py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                    filter === "approved"
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Approved
                </button>
              </div>
              <button
                onClick={() => navigate("/requests/new")}
                disabled
                title="Coming soon"
                className="px-4 py-3 sm:py-2 bg-black text-white text-sm font-semibold rounded-xl transition-all min-h-[44px] sm:min-h-0 w-full sm:w-auto opacity-50 cursor-not-allowed"
              >
                + Request Payment
              </button>
            </div>
          </div>
        </header>
      </motion.div>

      {/* Requests List */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        {isLoading ? (
          <div className="border-2 border-black rounded-2xl bg-white p-6">
            <WireSkeletonTable rows={5} />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="border-2 border-black rounded-2xl bg-white p-6">
            <WireEmptyState
              icon={
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              title="No Payment Requests"
              description={
                "Payment Requests are coming soon. This page will show real vendor requests when the Requests API is enabled."
              }
            />
          </div>
        ) : (
          filteredRequests.map((request, index) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <WireRequestCard
                request={request}
                onClick={() => setSelectedRequest(request)}
              />
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Detail Modal */}
      {selectedRequest && (
        <WireRequestDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </div>
  );
}
