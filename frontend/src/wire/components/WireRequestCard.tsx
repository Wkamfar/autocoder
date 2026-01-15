import React from "react";
import { motion } from "framer-motion";
import type { PaymentRequest } from "../types/wire";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { requestStatusLabel } from "../utils/statusLabels";

interface WireRequestCardProps {
  request: PaymentRequest;
  onClick: () => void;
}

export function WireRequestCard({ request, onClick }: WireRequestCardProps) {
  const formatAmount = (amountMinor: string, currency: string) => {
    const amount = parseFloat(amountMinor) / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getStatusBadge = () => {
    const toneMap: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
      DRAFT: "neutral",
      PENDING_VERIFICATION: "warning",
      PENDING_APPROVAL: "warning",
      APPROVED: "success",
      DENIED: "danger",
      PAID: "info",
      EXPIRED: "neutral",
    };
    const tone = toneMap[request.status] ?? "neutral";
    return <Badge tone={tone}>{requestStatusLabel(request.status)}</Badge>;
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="border-2 border-black rounded-2xl bg-white p-6 cursor-pointer hover:shadow-lg transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{request.requestorName}</h3>
              <p className="text-sm text-gray-600">{request.requestorEmail}</p>
            </div>
            {getStatusBadge()}
          </div>

          {/* Amount */}
          <div className="mb-4">
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {formatAmount(request.amountMinor, request.currency)}
            </p>
            {request.invoiceNumber && (
              <p className="text-sm text-gray-600">Invoice: {request.invoiceNumber}</p>
            )}
          </div>

          {/* Purpose */}
          <p className="text-sm text-gray-700 mb-4 line-clamp-2">{request.purpose}</p>

          {/* Verification Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {request.verificationStatus.email ? (
                <div className="flex items-center gap-1 text-green-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs font-medium">Email</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-xs font-medium">Email</span>
                </div>
              )}
              {request.verificationStatus.voice ? (
                <div className="flex items-center gap-1 text-green-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs font-medium">Voice</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-xs font-medium">Voice</span>
                </div>
              )}
            </div>
            {request.dueDate && (
              <div className="text-xs text-gray-500">
                Due: {new Date(request.dueDate).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="ml-4">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}
