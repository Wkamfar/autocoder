import { useMemo } from "react";
import type { EnrichedInvestorRow } from "./InvestorUniverseDetailPanel";

interface InvestorPatternInsightsProps {
  investor: EnrichedInvestorRow | null;
  allInvestors: EnrichedInvestorRow[];
}

export function InvestorPatternInsights({
  investor,
  allInvestors,
}: InvestorPatternInsightsProps) {
  const insights = useMemo(() => {
    if (!investor) return null;

    const patterns: Array<{
      type: "similar" | "portfolio" | "geographic" | "thesis";
      title: string;
      investors: EnrichedInvestorRow[];
      insight: string;
    }> = [];

    // Similar investors (same tier, similar score)
    const similarInvestors = allInvestors
      .filter(
        (inv) =>
          inv.id !== investor.id &&
          inv.rankTier === investor.rankTier &&
          Math.abs((inv.rankScore || 0) - (investor.rankScore || 0)) < 50,
      )
      .slice(0, 5);

    if (similarInvestors.length > 0) {
      patterns.push({
        type: "similar",
        title: "Similar investors",
        investors: similarInvestors,
        insight: `${similarInvestors.length} investors with similar tier and score. Consider similar outreach strategies.`,
      });
    }

    // Portfolio overlap (same flagship deals)
    if (investor.flagshipDeals && investor.flagshipDeals.length > 0) {
      const portfolioOverlap = allInvestors.filter(
        (inv) =>
          inv.id !== investor.id &&
          inv.flagshipDeals &&
          inv.flagshipDeals.some((deal) =>
            investor.flagshipDeals!.some(
              (investorDeal) => deal.project === investorDeal.project,
            ),
          ),
      );

      if (portfolioOverlap.length > 0) {
        patterns.push({
          type: "portfolio",
          title: "Portfolio overlap",
          investors: portfolioOverlap.slice(0, 5),
          insight: `${portfolioOverlap.length} investors share portfolio companies. Potential co-investment opportunities or warm intro paths.`,
        });
      }
    }

    // Geographic cluster
    if (investor.country) {
      const geographicCluster = allInvestors.filter(
        (inv) =>
          inv.id !== investor.id &&
          inv.country === investor.country &&
          (inv.rankTier === investor.rankTier ||
            inv.rankTier === "A" ||
            investor.rankTier === "A"),
      );

      if (geographicCluster.length > 0) {
        patterns.push({
          type: "geographic",
          title: `${investor.country} cluster`,
          investors: geographicCluster.slice(0, 5),
          insight: `${geographicCluster.length} investors in ${investor.country}. Consider regional events or local partnerships.`,
        });
      }
    }

    // Thesis alignment
    if (investor.thesisBullets && investor.thesisBullets.length > 0) {
      const thesisKeywords = investor.thesisBullets
        .join(" ")
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4);

      const thesisAligned = allInvestors.filter(
        (inv) =>
          inv.id !== investor.id &&
          inv.thesisBullets &&
          inv.thesisBullets.some((bullet) =>
            thesisKeywords.some((keyword) =>
              bullet.toLowerCase().includes(keyword),
            ),
          ),
      );

      if (thesisAligned.length > 0) {
        patterns.push({
          type: "thesis",
          title: "Thesis alignment",
          investors: thesisAligned.slice(0, 5),
          insight: `${thesisAligned.length} investors share similar thesis focus. POSE positioning should resonate similarly.`,
        });
      }
    }

    return patterns;
  }, [investor, allInvestors]);

  if (!investor || !insights || insights.length === 0) {
    return null;
  }

  return (
    <div className="border-2 border-black rounded-2xl bg-white flex flex-col h-full">
      <div className="border-b-2 border-black px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-800">
          Pattern insights
        </h2>
        <p className="text-[10px] text-gray-600 mt-1">
          AI-detected patterns and relationships
        </p>
      </div>
      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {insights.map((pattern, idx) => (
          <div
            key={idx}
            className="border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-700">
                {pattern.title}
              </span>
              <span className="text-[9px] font-mono text-gray-500">
                ({pattern.investors.length})
              </span>
            </div>
            <p className="text-[10px] text-gray-700 mb-2 leading-relaxed">
              {pattern.insight}
            </p>
            <div className="space-y-1">
              {pattern.investors.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between text-[10px] bg-white px-2 py-1 rounded border border-gray-200"
                >
                  <span className="font-medium">{inv.name}</span>
                  <span className="font-mono text-gray-500">
                    {inv.rankTier} · {inv.rankScore}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
