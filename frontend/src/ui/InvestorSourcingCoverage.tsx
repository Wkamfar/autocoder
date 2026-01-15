import { useMemo } from "react";
import type { EnrichedInvestorRow } from "./InvestorUniverseDetailPanel";

interface InvestorSourcingCoverageProps {
  investors: EnrichedInvestorRow[];
}

export function InvestorSourcingCoverage({
  investors,
}: InvestorSourcingCoverageProps) {
  const stats = useMemo(() => {
    const total = investors.length;
    let investorsWithAnyUrls = 0;
    let fundSizeSourced = 0;
    let geoFocusSourced = 0;
    let checkSizeSourced = 0;
    let stageFocusSourced = 0;

    investors.forEach((inv) => {
      const hasAnyUrls = inv.researchFields?.some(
        (rf) => rf.sourceUrls && rf.sourceUrls.length > 0,
      );
      if (hasAnyUrls) investorsWithAnyUrls += 1;

      if (
        inv.researchFields?.some(
          (rf) =>
            rf.fieldKey === "fund_size" &&
            rf.sourceUrls &&
            rf.sourceUrls.length > 0 &&
            rf.dataConfidence >= 70,
        )
      ) {
        fundSizeSourced += 1;
      }

      if (
        inv.researchFields?.some(
          (rf) =>
            rf.fieldKey === "geo_focus" &&
            rf.sourceUrls &&
            rf.sourceUrls.length > 0 &&
            rf.dataConfidence >= 70,
        )
      ) {
        geoFocusSourced += 1;
      }

      if (
        inv.researchFields?.some(
          (rf) =>
            rf.fieldKey === "check_size" &&
            rf.sourceUrls &&
            rf.sourceUrls.length > 0 &&
            rf.dataConfidence >= 70,
        )
      ) {
        checkSizeSourced += 1;
      }

      if (
        inv.researchFields?.some(
          (rf) =>
            rf.fieldKey === "stage_focus" &&
            rf.sourceUrls &&
            rf.sourceUrls.length > 0 &&
            rf.dataConfidence >= 70,
        )
      ) {
        stageFocusSourced += 1;
      }
    });

    return {
      total,
      investorsWithAnyUrls,
      fundSizeSourced,
      geoFocusSourced,
      checkSizeSourced,
      stageFocusSourced,
    };
  }, [investors]);

  return (
    <div className="border-2 border-black rounded-xl px-4 py-3 bg-white">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-800 mb-3">
        Public Sourcing Coverage
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-gray-600 mb-1">Investors with URLs</p>
          <p className="text-lg font-bold font-mono">
            {stats.investorsWithAnyUrls}
          </p>
          <p className="text-[9px] text-gray-500">
            {stats.total > 0
              ? `${Math.round((stats.investorsWithAnyUrls / stats.total) * 100)}% of ${stats.total}`
              : "0% of 0"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-600 mb-1">Fund size sourced</p>
          <p className="text-lg font-bold font-mono">{stats.fundSizeSourced}</p>
          <p className="text-[9px] text-gray-500">
            {stats.total > 0
              ? `${Math.round((stats.fundSizeSourced / stats.total) * 100)}%`
              : "0%"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-600 mb-1">Geo focus sourced</p>
          <p className="text-lg font-bold font-mono">{stats.geoFocusSourced}</p>
          <p className="text-[9px] text-gray-500">
            {stats.total > 0
              ? `${Math.round((stats.geoFocusSourced / stats.total) * 100)}%`
              : "0%"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-600 mb-1">Check size sourced</p>
          <p className="text-lg font-bold font-mono">{stats.checkSizeSourced}</p>
          <p className="text-[9px] text-gray-500">
            {stats.total > 0
              ? `${Math.round((stats.checkSizeSourced / stats.total) * 100)}%`
              : "0%"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-600 mb-1">Stage focus sourced</p>
          <p className="text-lg font-bold font-mono">
            {stats.stageFocusSourced}
          </p>
          <p className="text-[9px] text-gray-500">
            {stats.total > 0
              ? `${Math.round((stats.stageFocusSourced / stats.total) * 100)}%`
              : "0%"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-600 mb-1">Thesis sourced</p>
          <p className="text-lg font-bold font-mono">
            {
              investors.filter((inv) =>
                inv.researchFields?.some(
                  (rf) =>
                    rf.fieldKey === "thesis" &&
                    rf.sourceUrls &&
                    rf.sourceUrls.length > 0 &&
                    rf.dataConfidence >= 70,
                ),
              ).length
            }
          </p>
          <p className="text-[9px] text-gray-500">
            {stats.total > 0
              ? `${Math.round(
                  (investors.filter((inv) =>
                    inv.researchFields?.some(
                      (rf) =>
                        rf.fieldKey === "thesis" &&
                        rf.sourceUrls &&
                        rf.sourceUrls.length > 0 &&
                        rf.dataConfidence >= 70,
                    ),
                  ).length /
                    stats.total) *
                    100,
                )}%`
              : "0%"}
          </p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-[9px] text-gray-600">
          Sources: SEC EDGAR Form D, Beacon Web3 VC Database. Coverage increases
          as more adapters are enabled.
        </p>
      </div>
    </div>
  );
}
