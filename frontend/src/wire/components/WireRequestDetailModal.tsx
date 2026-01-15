import React, { useState } from "react";
import type { PaymentRequest } from "../types/wire";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { WireModal } from "../ui/WireModal";
import { RequestStatusBadge } from "../ui/WireDesignSystem";

interface WireRequestDetailModalProps {
  request: PaymentRequest;
  onClose: () => void;
}

export function WireRequestDetailModal({ request, onClose }: WireRequestDetailModalProps) {
  const [isApproving, setIsApproving] = useState(false);

  const formatAmount = (amountMinor: string, currency: string) => {
    const amount = parseFloat(amountMinor) / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const handleApprove = async () => {
    setIsApproving(true);
    // Mock: In real implementation, this would approve the request and create an intent
    setTimeout(() => {
      setIsApproving(false);
      onClose();
    }, 2000);
  };

  const handleDeny = () => {
    // Mock: In real implementation, this would deny the request
    onClose();
  };

  return (
    <WireModal title="Payment Request Details" onClose={onClose} className="max-w-2xl">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Status</h3>
              <RequestStatusBadge status={request.status} />
            </div>
            {/* Requestor Info */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Requestor</h3>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-semibold text-gray-900">{request.requestorName}</p>
                <p className="text-sm text-gray-600">{request.requestorEmail}</p>
              </div>
            </div>

            {/* Amount */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Amount</h3>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-3xl font-bold text-gray-900">
                  {formatAmount(request.amountMinor, request.currency)}
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4">
              {request.invoiceNumber && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Invoice Number</h3>
                  <p className="text-sm font-medium text-gray-900">{request.invoiceNumber}</p>
                </div>
              )}
              {request.dueDate && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Due Date</h3>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(request.dueDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {/* Purpose */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Purpose</h3>
              <p className="text-sm text-gray-700">{request.purpose}</p>
            </div>

            {/* Verification Status */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Verification Status</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Email Verification</span>
                  {request.verificationStatus.email ? (
                    <Badge tone="success">Verified</Badge>
                  ) : (
                    <Badge tone="warning">Pending</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Voice Verification</span>
                  {request.verificationStatus.voice ? (
                    <Badge tone="success">Verified</Badge>
                  ) : (
                    <Badge tone="warning">Pending</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Domain Verification</span>
                  {request.verificationStatus.domain ? (
                    <Badge tone="success">Verified</Badge>
                  ) : (
                    <Badge tone="warning">Pending</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Request Hash (Security) */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Request Hash</h3>
              <div className="bg-gray-900 text-green-400 font-mono text-xs p-3 rounded-lg break-all">
                {request.requestHash}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                This hash ensures request integrity. Any tampering will invalidate the request.
              </p>
            </div>
      </div>

      {/* Actions */}
      {request.status === "PENDING_APPROVAL" && (
            <div className="border-t border-gray-100 px-6 py-4 flex items-center gap-3">
              <button
                onClick={handleDeny}
                className="flex-1 px-4 py-2.5 border-2 border-black rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all"
              >
                Deny
              </button>
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="flex-1 px-4 py-2.5 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving ? "Approving..." : "Approve & Create Intent"}
              </button>
            </div>
          )}
    </WireModal>
  );
}
