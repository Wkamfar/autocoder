import { useMemo } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { EnrichedInvestorRow } from "./InvestorUniverseDetailPanel";

interface InvestorUniverseAnalyticsProps {
  investors: EnrichedInvestorRow[];
}

const TIER_COLORS: Record<string, string> = {
  "A+": "#00FFE0",
  A: "#627EEA",
  B: "#8247E5",
  C: "#28A0F0",
};

export function InvestorUniverseAnalytics({
  investors,
}: InvestorUniverseAnalyticsProps) {
  // Tier distribution
  const tierDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    investors.forEach((inv) => {
      counts[inv.rankTier] = (counts[inv.rankTier] || 0) + 1;
    });
    const total = investors.length || 1; // Prevent division by zero
    return Object.entries(counts).map(([tier, count]) => ({
      tier,
      count,
      percentage: Math.round((count / total) * 100),
    }));
  }, [investors]);

  // Segment distribution
  const segmentDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    investors.forEach((inv) => {
      const seg = inv.segment || "Unclassified";
      counts[seg] = (counts[seg] || 0) + 1;
    });
    const total = investors.length || 1; // Prevent division by zero
    return Object.entries(counts)
      .map(([segment, count]) => ({
        segment,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [investors]);

  // Score distribution (buckets)
  const scoreDistribution = useMemo(() => {
    const buckets = [
      { range: "0-100", min: 0, max: 100, count: 0 },
      { range: "101-200", min: 101, max: 200, count: 0 },
      { range: "201-300", min: 201, max: 300, count: 0 },
      { range: "301-400", min: 301, max: 400, count: 0 },
      { range: "401+", min: 401, max: 10000, count: 0 },
    ];
    investors.forEach((inv) => {
      const score = inv.rankScore || 0;
      const bucket = buckets.find((b) => score >= b.min && score <= b.max);
      if (bucket) bucket.count++;
    });
    return buckets;
  }, [investors]);

  // Completion status
  const completionStats = useMemo(() => {
    const complete = investors.filter(
      (inv) => !inv.missingFields || inv.missingFields.length === 0,
    ).length;
    const incomplete = investors.length - complete;
    return [
      { status: "Complete", count: complete, color: "#00FFE0" },
      { status: "Needs Research", count: incomplete, color: "#FF0420" },
    ];
  }, [investors]);

  // Top opportunities (by score)
  const topOpportunities = useMemo(() => {
    return [...investors]
      .sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
      .slice(0, 10)
      .map((inv) => ({
        id: inv.id, // Use unique ID instead of name to avoid duplicate key warnings
        name: inv.name,
        score: inv.rankScore || 0,
        tier: inv.rankTier,
        fitScore: inv.poseFitScore || 0,
      }));
  }, [investors]);

  // Intelligence coverage
  const intelligenceCoverage = useMemo(() => {
    const withThesis = investors.filter(
      (inv) => inv.thesisBullets && inv.thesisBullets.length > 0,
    ).length;
    const withFlagship = investors.filter(
      (inv) => inv.flagshipDeals && inv.flagshipDeals.length > 0,
    ).length;
    const withContacts = investors.filter(
      (inv) => inv.strategicContacts && inv.strategicContacts.length > 0,
    ).length;
    const withBrief = investors.filter((inv) => inv.founderBrief).length;

    const total = investors.length || 1; // Prevent division by zero
    return [
      { field: "Thesis Bullets", count: withThesis, total },
      { field: "Flagship Deals", count: withFlagship, total },
      { field: "Strategic Contacts", count: withContacts, total },
      { field: "Founder Briefs", count: withBrief, total },
    ];
  }, [investors]);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="border-2 border-black rounded-xl px-4 py-3 bg-white">
          <div className="text-[10px] uppercase tracking-wide text-gray-600 mb-1">
            Total Investors
          </div>
          <div className="text-2xl font-bold font-mono">{investors.length}</div>
        </div>
        <div className="border-2 border-black rounded-xl px-4 py-3 bg-white">
          <div className="text-[10px] uppercase tracking-wide text-gray-600 mb-1">
            Avg Score
          </div>
          <div className="text-2xl font-bold font-mono">
            {Math.round(
              investors.reduce((sum, inv) => sum + (inv.rankScore || 0), 0) /
                investors.length,
            )}
          </div>
        </div>
        <div className="border-2 border-black rounded-xl px-4 py-3 bg-white">
          <div className="text-[10px] uppercase tracking-wide text-gray-600 mb-1">
            Complete Profiles
          </div>
          <div className="text-2xl font-bold font-mono">
            {
              investors.filter(
                (inv) => !inv.missingFields || inv.missingFields.length === 0,
              ).length
            }
          </div>
        </div>
        <div className="border-2 border-black rounded-xl px-4 py-3 bg-white">
          <div className="text-[10px] uppercase tracking-wide text-gray-600 mb-1">
            Top Tier (A+/A)
          </div>
          <div className="text-2xl font-bold font-mono">
            {
              investors.filter(
                (inv) => inv.rankTier === "A+" || inv.rankTier === "A",
              ).length
            }
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Tier Distribution */}
        <div className="border-2 border-black rounded-xl px-4 py-3 bg-white">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-800 mb-3">
            Distribution by Tier
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={tierDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="tier"
                stroke="#6b7280"
                tick={{ fontSize: 10 }}
              />
              <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #000",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
              />
              <Bar dataKey="count" fill="#000">
                {tierDistribution.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={TIER_COLORS[entry.tier] || "#28A0F0"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Score Distribution */}
        <div className="border-2 border-black rounded-xl px-4 py-3 bg-white">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-800 mb-3">
            Score Distribution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="range"
                stroke="#6b7280"
                tick={{ fontSize: 10 }}
              />
              <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #000",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#000"
                strokeWidth={2}
                dot={{ fill: "#000", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Completion Status */}
        <div className="border-2 border-black rounded-xl px-4 py-3 bg-white">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-800 mb-3">
            Profile Completion
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={completionStats}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ status, count, percentage }) =>
                  `${status}: ${count} (${percentage}%)`
                }
                outerRadius={70}
                fill="#8884d8"
                dataKey="count"
              >
                {completionStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Intelligence Coverage */}
        <div className="border-2 border-black rounded-xl px-4 py-3 bg-white">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-800 mb-3">
            Intelligence Coverage
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={intelligenceCoverage} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 10 }} />
              <YAxis
                dataKey="field"
                type="category"
                stroke="#6b7280"
                tick={{ fontSize: 10 }}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #000",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
                formatter={(value: number, name: string, props: any) => [
                  `${value}/${props.payload.total} (${Math.round(
                    (value / props.payload.total) * 100,
                  )}%)`,
                  name,
                ]}
              />
              <Bar dataKey="count" fill="#000" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Opportunities Table */}
      <div className="border-2 border-black rounded-xl px-4 py-3 bg-white">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-800 mb-3">
          Top 10 Opportunities (by Score)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100 border-b border-black">
              <tr className="text-[11px] text-gray-700">
                <th className="px-3 py-2 text-left">Rank</th>
                <th className="px-3 py-2 text-left">Investor</th>
                <th className="px-3 py-2 text-right">Tier</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2 text-right">Fit</th>
              </tr>
            </thead>
            <tbody>
              {topOpportunities.map((opp, idx) => (
                <tr
                  key={opp.id || `${opp.name}-${idx}`}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  <td className="px-3 py-1.5 font-mono text-[11px]">
                    #{idx + 1}
                  </td>
                  <td className="px-3 py-1.5 font-medium">{opp.name}</td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {opp.tier}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {opp.score}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {opp.fitScore}/100
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
