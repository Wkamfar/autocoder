import React, { useState, useEffect } from "react";
import type { Beneficiary, TransferIntent, RailsType } from "../types/wire";
import { WireRiskPreview } from "./WireRiskPreview";
import { formatNumberWithCommas, parseFormattedNumber, numberToWordsWithCurrency } from "../utils/numberToWords";

interface WireIntentFormProps {
  beneficiaries: Beneficiary[];
  onSubmit: (data: Partial<TransferIntent>) => void;
  onCancel: () => void;
}

export function WireIntentForm({ beneficiaries, onSubmit, onCancel }: WireIntentFormProps) {
  const [railsType, setRailsType] = useState<RailsType>("ACH");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [riskPreview, setRiskPreview] = useState<any>(null);

  // Mock risk calculation
  useEffect(() => {
    if (amount && beneficiaryId) {
      const beneficiary = beneficiaries.find((b) => b.id === beneficiaryId);
      if (beneficiary) {
        const amountNum = parseFloat(amount) * 100;
        const beneficiaryAge = Math.floor(
          (Date.now() - new Date(beneficiary.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        );

        let riskScore = 0;
        const factors: string[] = [];
        const details: Record<string, string> = {};

        if (amountNum > 1000000) {
          riskScore += 30;
          factors.push("amount_threshold");
          details.amount_threshold = "Amount exceeds $10k threshold";
        } else if (amountNum > 500000) {
          riskScore += 15;
          factors.push("amount_threshold");
          details.amount_threshold = "Amount exceeds $5k threshold";
        }

        if (beneficiaryAge < 7) {
          riskScore += 25;
          factors.push("new_beneficiary");
          details.new_beneficiary = `Beneficiary created ${beneficiaryAge} days ago`;
        }

        if (railsType === "WIRE") {
          riskScore += 10;
          factors.push("wire_rail");
          details.wire_rail = "Wire transfer (irreversible)";
        }

        if (beneficiary.country !== "US") {
          riskScore += 10;
          factors.push("international");
          details.international = `International transfer (${beneficiary.country})`;
        }

        const requiredApprovals = riskScore >= 60 ? 2 : 1;
        const requiredChallengeLevel: "L1" | "L2" | "L3" =
          riskScore >= 80 ? "L3" : riskScore >= 50 ? "L2" : "L1";

        setRiskPreview({
          riskScore: Math.min(riskScore, 100),
          riskRationaleJson: {
            factors,
            details,
            scoreBreakdown: { base: 0, total: riskScore },
          },
          requiredApprovals,
          requiredChallengeLevel,
        });
      }
    }
  }, [amount, beneficiaryId, railsType, beneficiaries]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Remove all non-numeric characters except decimal point
    const cleaned = inputValue.replace(/[^\d.]/g, "");
    // Format with commas
    const formatted = formatNumberWithCommas(cleaned);
    setAmount(formatted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Parse the formatted number back to a number
    const numericAmount = parseFormattedNumber(amount);
    onSubmit({
      railsType,
      amountMinor: (numericAmount * 100).toString(),
      currency,
      beneficiaryId,
      purpose,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form Panel */}
      <div className="lg:col-span-2">
        <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
          <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
                Transfer Intent
              </p>
              <h2 className="text-sm font-semibold text-gray-900">Create Intent</h2>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {/* Rail Type */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-2">
                  Rail Type
                </label>
                <div className="flex gap-3">
                  <label className="flex-1 flex items-center gap-2 p-3 border-2 border-black rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      value="ACH"
                      checked={railsType === "ACH"}
                      onChange={(e) => setRailsType(e.target.value as RailsType)}
                      className="w-4 h-4 border-2 border-black text-black focus:ring-2 focus:ring-black/20"
                    />
                    <span className="text-sm font-medium text-gray-900">ACH</span>
                  </label>
                  <label className="flex-1 flex items-center gap-2 p-3 border-2 border-black rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      value="WIRE"
                      checked={railsType === "WIRE"}
                      onChange={(e) => setRailsType(e.target.value as RailsType)}
                      className="w-4 h-4 border-2 border-black text-black focus:ring-2 focus:ring-black/20"
                    />
                    <span className="text-sm font-medium text-gray-900">WIRE</span>
                  </label>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-2">
                  Amount
                </label>
                <div className="flex gap-2">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="px-3 py-3 sm:py-2 border-2 border-black rounded-xl bg-white text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 min-h-[44px] sm:min-h-0"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-base sm:text-sm">
                      {currency === "USD" ? "$" : currency === "EUR" ? "€" : "£"}
                    </span>
                    <input
                      type="text"
                      value={amount}
                      onChange={handleAmountChange}
                      placeholder="0.00"
                      className="flex-1 pl-7 sm:pl-7 pr-3 py-3 sm:py-2 border-2 border-black rounded-xl text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 min-h-[44px] sm:min-h-0"
                      required
                    />
                  </div>
                </div>
                {/* Amount in words */}
                {amount && parseFormattedNumber(amount) > 0 && (
                  <div className="mt-3 px-3 sm:px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Amount in words:</p>
                    <p className="text-sm sm:text-base font-semibold text-gray-900 leading-relaxed capitalize tracking-wide">
                      {numberToWordsWithCurrency(parseFormattedNumber(amount), currency)}
                    </p>
                  </div>
                )}
              </div>

              {/* Beneficiary */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-2">
                  Beneficiary
                </label>
                <select
                  value={beneficiaryId}
                  onChange={(e) => setBeneficiaryId(e.target.value)}
                  className="w-full px-3 py-3 sm:py-2 border-2 border-black rounded-xl bg-white text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 min-h-[44px] sm:min-h-0"
                  required
                >
                  <option value="">Select beneficiary</option>
                  {beneficiaries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.displayName} ({b.bankLast4}) - {b.railsAllowed.join(", ")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-2">
                  Purpose
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g., Monthly invoice payment"
                  className="w-full px-3 py-3 sm:py-2 border-2 border-black rounded-xl text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 min-h-[44px] sm:min-h-0"
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 sm:py-2 bg-black text-white text-base sm:text-sm font-medium rounded-xl hover:bg-gray-800 transition-all duration-200 shadow-sm min-h-[44px] sm:min-h-0"
                >
                  Create Intent
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-3 sm:py-2 border-2 border-black rounded-xl hover:bg-gray-50 text-base sm:text-sm font-medium transition-all duration-200 min-h-[44px] sm:min-h-0"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Risk Preview Sidebar */}
      <div className="lg:col-span-1">
        {riskPreview && (
          <WireRiskPreview
            riskScore={riskPreview.riskScore}
            riskRationale={riskPreview.riskRationaleJson}
            requiredApprovals={riskPreview.requiredApprovals}
            requiredChallengeLevel={riskPreview.requiredChallengeLevel}
          />
        )}
      </div>
    </div>
  );
}
