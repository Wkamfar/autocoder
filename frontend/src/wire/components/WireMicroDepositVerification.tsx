import React, { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "../../crm/ui/CrmDesignSystem";

interface WireMicroDepositVerificationProps {
  accountId: string;
  onVerify: (amounts: { amount1: string; amount2: string }) => void;
  onResend: () => void;
}

export function WireMicroDepositVerification({
  accountId,
  onVerify,
  onResend,
}: WireMicroDepositVerificationProps) {
  const [amount1, setAmount1] = useState("");
  const [amount2, setAmount2] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock: In real implementation, these would come from the API
  const mockDeposits = {
    sentAt: "2024-01-18T10:00:00Z",
    expectedAmounts: ["0.01", "0.45"], // Hidden from user
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError(null);

    // Mock verification
    setTimeout(() => {
      const userAmounts = [parseFloat(amount1), parseFloat(amount2)].sort();
      const expectedAmounts = mockDeposits.expectedAmounts.map(parseFloat).sort();
      
      const matches = 
        Math.abs(userAmounts[0] - expectedAmounts[0]) < 0.001 &&
        Math.abs(userAmounts[1] - expectedAmounts[1]) < 0.001;

      if (matches) {
        onVerify({ amount1, amount2 });
      } else {
        setError("Amounts don't match. Please check your account and try again.");
        setIsVerifying(false);
      }
    }, 1500);
  };

  const daysSinceSent = Math.floor(
    (Date.now() - new Date(mockDeposits.sentAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-2 border-black rounded-2xl bg-white p-6"
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Verify Your Account</h2>
        <p className="text-sm text-gray-600">
          We sent 2 small deposits to your account. Enter the amounts to verify ownership.
        </p>
      </div>

      {/* Status */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-blue-900">Deposits Sent</span>
          <Badge tone="info">
            {daysSinceSent === 0 ? "Today" : `${daysSinceSent} day${daysSinceSent > 1 ? "s" : ""} ago`}
          </Badge>
        </div>
        <p className="text-xs text-blue-700">
          Check your bank account for 2 deposits from "WIRE VERIFICATION". 
          Each deposit will be between $0.01 and $0.99.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
            First Deposit Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="0.99"
              value={amount1}
              onChange={(e) => setAmount1(e.target.value)}
              placeholder="0.01"
              className="w-full pl-8 pr-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
            Second Deposit Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="0.99"
              value={amount2}
              onChange={(e) => setAmount2(e.target.value)}
              placeholder="0.45"
              className="w-full pl-8 pr-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
              required
            />
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-xl p-3"
          >
            <p className="text-sm text-red-700">{error}</p>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4">
          <button
            type="button"
            onClick={onResend}
            className="px-4 py-2 border-2 border-black rounded-xl text-sm font-medium hover:bg-gray-50 transition-all"
          >
            Resend Deposits
          </button>
          <button
            type="submit"
            disabled={isVerifying || !amount1 || !amount2}
            className="flex-1 px-6 py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? "Verifying..." : "Verify Account"}
          </button>
        </div>
      </form>

      {/* Help */}
      <div className="mt-6 pt-6 border-t border-gray-100">
        <details className="group">
          <summary className="text-sm font-medium text-gray-700 cursor-pointer list-none">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Need help finding the deposits?
            </span>
          </summary>
          <div className="mt-3 text-xs text-gray-600 space-y-2 pl-6">
            <p>• Look for transactions from "WIRE VERIFICATION" or "POSE WIREGUARD"</p>
            <p>• Check your pending transactions if deposits haven't cleared</p>
            <p>• Deposits typically arrive within 1-3 business days</p>
            <p>• Amounts will be between $0.01 and $0.99</p>
          </div>
        </details>
      </div>
    </motion.div>
  );
}
