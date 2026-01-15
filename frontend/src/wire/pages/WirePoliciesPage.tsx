import React from "react";
import { usePolicy } from "../hooks/useWireIntents";
import { WirePolicySimulator } from "../components/WirePolicySimulator";

export default function WirePoliciesPage() {
  const { data: policy, isLoading } = usePolicy();

  if (isLoading || !policy) {
    return (
      <div className="border-2 border-black rounded-2xl bg-white p-8">
        <div className="text-center text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
              Policy Engine
            </p>
            <h2 className="text-sm font-semibold text-gray-900">
              Policy Version: v{policy.version} (effective {new Date(policy.effectiveAt).toLocaleDateString()})
            </h2>
          </div>
        </header>
      </div>

      {/* Policy Simulator Panel */}
      <WirePolicySimulator policy={policy} />

      {/* Policy Configuration Panel */}
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-sm font-bold text-gray-900">Policy Configuration</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Thresholds
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-xs text-gray-600">Amount Step-Up</span>
                  <span className="text-xs font-bold text-gray-900">
                    ${parseFloat(policy.thresholds.amountStepUpMinor) / 100}k
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-xs text-gray-600">Dual Approval Risk Score</span>
                  <span className="text-xs font-bold text-gray-900">
                    {policy.thresholds.dualApprovalRiskScore}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-xs text-gray-600">Critical Risk Score</span>
                  <span className="text-xs font-bold text-gray-900">
                    {policy.thresholds.criticalRiskScore}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-xs text-gray-600">New Beneficiary Days</span>
                  <span className="text-xs font-bold text-gray-900">
                    {policy.thresholds.newBeneficiaryDays}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Rules
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-xs text-gray-600">Dual Approval for International</span>
                  <span className="text-xs font-bold text-gray-900">
                    {policy.rules.requireDualApprovalForInternationalWire ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-xs text-gray-600">Phone for L3 if Mic Denied</span>
                  <span className="text-xs font-bold text-gray-900">
                    {policy.rules.requirePhoneForL3IfMicDenied ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-xs text-gray-600">Cooldown (minutes)</span>
                  <span className="text-xs font-bold text-gray-900">
                    {policy.rules.cooldownMinutesForHighRisk}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-xs text-gray-600">Lockout After Failed Attempts</span>
                  <span className="text-xs font-bold text-gray-900">
                    {policy.rules.lockoutAfterFailedAttempts}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
