import React, { useState } from "react";
import { motion } from "framer-motion";
import type { TransferIntent } from "../types/wire";
import { Badge } from "../../crm/ui/CrmDesignSystem";

interface WireExecutionPanelProps {
  intent: TransferIntent;
  approvalToken: string | null;
  onExecute: () => Promise<{ status: string; executionRef: string; ledgerId?: string }>;
  onRequestApprovalToken?: () => Promise<void>;
}

type ExecutionMethod = "automated" | "manual" | "file";

export function WireExecutionPanel({
  intent,
  approvalToken,
  onExecute,
  onRequestApprovalToken,
}: WireExecutionPanelProps) {
  const [executionMethod, setExecutionMethod] = useState<ExecutionMethod | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<"idle" | "executing" | "success" | "error">("idle");
  const [executionRef, setExecutionRef] = useState<string | null>(null);

  const formatAmount = (amountMinor: string, currency: string) => {
    const amount = parseFloat(amountMinor) / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  // Determine execution method based on amount
  const amount = parseFloat(intent.amountMinor) / 100;
  const shouldRequireConfirmation = amount > 10000; // $10k threshold

  const handleExecute = async () => {
    if (!approvalToken) return;

    setIsExecuting(true);
    setExecutionStatus("executing");

    try {
      const result = await onExecute();
      setExecutionRef(result.executionRef);
      setExecutionStatus("success");
    } catch (err) {
      console.error("Execution failed:", err);
      setExecutionStatus("error");
    } finally {
      setIsExecuting(false);
    }
  };

  if (executionStatus === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="border-2 border-green-500 rounded-2xl bg-green-50 p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Payment Executed</h3>
            <p className="text-sm text-gray-600">
              Execution Reference: {executionRef || "—"}
            </p>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Amount:</span>
            <span className="font-semibold text-gray-900">{formatAmount(intent.amountMinor, intent.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Rail:</span>
            <span className="font-semibold text-gray-900">{intent.railsType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Estimated Settlement:</span>
            <span className="font-semibold text-gray-900">
              {intent.railsType === "ACH" ? "1-2 business days" : "Same day"}
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-2 border-black rounded-2xl bg-white p-6"
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Execute Payment</h2>
        <p className="text-sm text-gray-600">
          {shouldRequireConfirmation
            ? "This payment requires manual confirmation due to amount."
            : "Ready to execute. Payment will be sent automatically."}
        </p>
      </div>

      {/* Execution Details */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Amount</span>
          <span className="text-lg font-bold text-gray-900">{formatAmount(intent.amountMinor, intent.currency)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Rail</span>
          <Badge tone="neutral">{intent.railsType}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Beneficiary</span>
          <span className="text-sm font-medium text-gray-900">•••• {intent.beneficiaryId.slice(-4)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Execution Method</span>
          <span className="text-sm font-medium text-gray-900">
            {shouldRequireConfirmation ? "Manual Confirmation" : "Automated API"}
          </span>
        </div>
      </div>

      {/* Execution Method Selection (if manual) */}
      {shouldRequireConfirmation && !executionMethod && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-gray-900">Choose Execution Method</h3>
          
          <button
            onClick={() => setExecutionMethod("automated")}
            className="w-full text-left p-4 border-2 border-black rounded-xl hover:bg-gray-50 transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900 mb-1">Automated API</div>
                <div className="text-xs text-gray-600">Execute via bank API (recommended)</div>
              </div>
              <Badge tone="success">Recommended</Badge>
            </div>
          </button>

          <button
            onClick={() => setExecutionMethod("file")}
            className="w-full text-left p-4 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900 mb-1">Generate Payment File</div>
                <div className="text-xs text-gray-600">Download file for manual bank upload</div>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Execution Button */}
      {(!shouldRequireConfirmation || executionMethod) && (
        <div className="space-y-3">
          {!approvalToken && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-sm text-amber-800">
                ⚠️ Approval token required. Please complete voice approval first.
              </p>
            </div>
          )}

          {!approvalToken && onRequestApprovalToken && (
            <button
              onClick={() => void onRequestApprovalToken()}
              disabled={isExecuting}
              className="w-full px-6 py-3 bg-white border-2 border-black text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Execution Token
            </button>
          )}

          <button
            onClick={handleExecute}
            disabled={!approvalToken || isExecuting}
            className="w-full px-6 py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExecuting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Executing Payment...
              </span>
            ) : (
              `Execute Payment ${formatAmount(intent.amountMinor, intent.currency)}`
            )}
          </button>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs text-blue-700">
              <strong>Settlement Time:</strong>{" "}
              {intent.railsType === "ACH"
                ? "1-2 business days"
                : "Same day (if submitted before cutoff)"}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              You'll receive a confirmation email once the payment is processed.
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
