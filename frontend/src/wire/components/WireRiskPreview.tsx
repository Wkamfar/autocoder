import React from "react";
import { RiskScoreBadge, ChallengeLevelBadge } from "../ui/WireDesignSystem";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import type { RiskRationale } from "../types/wire";

interface WireRiskPreviewProps {
  riskScore: number;
  riskRationale: RiskRationale;
  requiredApprovals: number;
  requiredChallengeLevel: "L1" | "L2" | "L3";
}

export function WireRiskPreview({
  riskScore,
  riskRationale,
  requiredApprovals,
  requiredChallengeLevel,
}: WireRiskPreviewProps) {
  return (
    <div className="border-2 border-black rounded-xl bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
            Risk Assessment
          </p>
          <h3 className="text-sm font-semibold text-gray-900 mt-0.5">Risk Score</h3>
        </div>
        <RiskScoreBadge score={riskScore} />
      </div>

      <div className="space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Risk Factors</div>
        <ul className="space-y-2">
          {riskRationale.factors.map((factor, idx) => (
            <li key={idx} className="text-xs text-gray-700 flex items-start gap-2 leading-relaxed">
              <span className="text-gray-400 mt-0.5">•</span>
              <span>{riskRationale.details[factor] || factor}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Approvals</span>
          <Badge tone={requiredApprovals === 2 ? "warning" : "neutral"}>
            {requiredApprovals}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Challenge</span>
          <ChallengeLevelBadge level={requiredChallengeLevel} />
        </div>
      </div>
    </div>
  );
}
