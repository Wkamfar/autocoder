import React, { useState } from "react";
import type { PolicyVersion } from "../types/wire";
import { WireRiskPreview } from "./WireRiskPreview";

interface WirePolicySimulatorProps {
  policy: PolicyVersion;
}

export function WirePolicySimulator({ policy }: WirePolicySimulatorProps) {
  const [amount, setAmount] = useState("7250");
  const [rails, setRails] = useState<"ACH" | "WIRE">("ACH");
  const [beneficiaryAge, setBeneficiaryAge] = useState("10");
  const [country, setCountry] = useState("US");
  const [localTime, setLocalTime] = useState("14:00");

  // Calculate risk based on policy
  const calculateRisk = () => {
    const amountMinor = parseFloat(amount) * 100;
    const age = parseInt(beneficiaryAge);
    const hour = parseInt(localTime.split(":")[0]);

    let riskScore = 0;
    const factors: string[] = [];
    const details: Record<string, string> = {};

    if (amountMinor > parseFloat(policy.thresholds.amountStepUpMinor)) {
      riskScore += 30;
      factors.push("amount_threshold");
      details.amount_threshold = `Amount exceeds $${parseFloat(policy.thresholds.amountStepUpMinor) / 100}k threshold`;
    }

    if (age < policy.thresholds.newBeneficiaryDays) {
      riskScore += 25;
      factors.push("new_beneficiary");
      details.new_beneficiary = `Beneficiary created ${age} days ago`;
    }

    if (rails === "WIRE") {
      riskScore += 10;
      factors.push("wire_rail");
      details.wire_rail = "Wire transfer (irreversible)";
    }

    if (country !== "US") {
      riskScore += 10;
      factors.push("international");
      details.international = `International transfer (${country})`;
    }

    if (
      hour >= policy.thresholds.outOfHoursStartHourLocal ||
      hour < policy.thresholds.outOfHoursEndHourLocal
    ) {
      riskScore += 15;
      factors.push("out_of_hours");
      details.out_of_hours = `Request outside operating hours`;
    }

    const requiredApprovals =
      riskScore >= policy.thresholds.dualApprovalRiskScore ? 2 : 1;
    const requiredChallengeLevel: "L1" | "L2" | "L3" =
      riskScore >= policy.thresholds.criticalRiskScore
        ? "L3"
        : riskScore >= 50
          ? "L2"
          : "L1";

    return {
      riskScore: Math.min(riskScore, 100),
      riskRationaleJson: {
        factors,
        details,
        scoreBreakdown: { base: 0, total: riskScore },
      },
      requiredApprovals,
      requiredChallengeLevel,
    };
  };

  const riskPreview = calculateRisk();

  return (
    <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
      <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
            Policy Simulation
          </p>
          <h2 className="text-sm font-semibold text-gray-900">
            Policy Version: v{policy.version} (effective {new Date(policy.effectiveAt).toLocaleDateString()})
          </h2>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-2">
              Amount ($)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-2">
              Rails
            </label>
            <select
              value={rails}
              onChange={(e) => setRails(e.target.value as "ACH" | "WIRE")}
              className="w-full px-3 py-2 border-2 border-black rounded-xl bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 transition-all duration-200"
            >
              <option value="ACH">ACH</option>
              <option value="WIRE">WIRE</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-2">
              Beneficiary Age (days)
            </label>
            <input
              type="number"
              value={beneficiaryAge}
              onChange={(e) => setBeneficiaryAge(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-2">
              Country
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded-xl bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 transition-all duration-200"
            >
              <option value="US">US</option>
              <option value="GB">GB</option>
              <option value="CA">CA</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-2">
              Local Time
            </label>
            <input
              type="time"
              value={localTime}
              onChange={(e) => setLocalTime(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 transition-all duration-200"
            />
          </div>
        </div>

        <WireRiskPreview
          riskScore={riskPreview.riskScore}
          riskRationale={riskPreview.riskRationaleJson}
          requiredApprovals={riskPreview.requiredApprovals}
          requiredChallengeLevel={riskPreview.requiredChallengeLevel}
        />
      </div>
    </div>
  );
}
