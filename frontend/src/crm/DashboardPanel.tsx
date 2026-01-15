import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

type PipelineKey =
  | "fundraising"
  | "enterprise_contract"
  | "government_pilot"
  | "partnership"
  | "other";

interface PipelineRollup {
  totalValueUsd: number;
  activePipelineUsd: number;
  weightedPipelineUsd: number;
  committedUsd: number;
}

export interface OwnerThroughputItem {
  userId: string;
  name: string;
  email: string;
  openTasks: number;
  overdueTasks: number;
  completedTasksLast7d: number;
  touchesLast7d: number;
  activeOpportunities: number;
  atRiskOpportunities: number;
}

export interface DashboardData {
  pipelines: Record<PipelineKey, PipelineRollup>;
  atRisk: Record<PipelineKey, number>;
  ownerThroughput: OwnerThroughputItem[];
}

export interface DashboardPanelProps {
  data: DashboardData | undefined;
}

const LABELS: Record<PipelineKey, string> = {
  fundraising: "Fundraising",
  enterprise_contract: "Enterprise",
  government_pilot: "Government",
  partnership: "Partnership",
  other: "Other",
};

const COLORS = {
  primary: "#18181b",
  secondary: "#71717a",
  accent: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value.toLocaleString()}`;
}

// Summary card component
function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  colorClass = "text-gray-900"
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: string; direction: "up" | "down" | "neutral" };
  colorClass?: string;
}) {
  const trendColors = {
    up: "text-emerald-500 bg-emerald-50",
    down: "text-red-500 bg-red-50",
    neutral: "text-gray-500 bg-gray-100"
  };
  
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
          {icon}
        </div>
        {trend && (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${trendColors[trend.direction]}`}>
            {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}
            {trend.value}
          </span>
        )}
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{title}</div>
      {subtitle && (
        <div className="text-[10px] text-gray-400 mt-1">{subtitle}</div>
      )}
    </div>
  );
}

// Progress bar component
function ProgressBar({ 
  value, 
  max, 
  colorClass = "bg-blue-500",
  showLabel = true 
}: { 
  value: number; 
  max: number; 
  colorClass?: string;
  showLabel?: boolean;
}) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-[11px] font-mono text-gray-500 w-12 text-right">
          {formatCurrency(value)}
        </span>
      )}
    </div>
  );
}

// Custom tooltip for charts
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 shadow-lg p-3">
      <p className="font-medium text-sm text-gray-900 mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-mono font-medium">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardPanel({ data }: DashboardPanelProps) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
        <div className="w-16 h-16 mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-1">Loading Dashboard</h3>
        <p className="text-sm text-gray-500">Fetching pipeline metrics...</p>
      </div>
    );
  }

  const rows = (Object.keys(data.pipelines) as PipelineKey[]).map((key) => {
    const p = data.pipelines[key];
    return {
      key,
      label: LABELS[key],
      activePipelineUsd: p.activePipelineUsd,
      weightedPipelineUsd: p.weightedPipelineUsd,
      committedUsd: p.committedUsd,
      atRisk: data.atRisk[key] ?? 0,
    };
  });

  const totals = useMemo(() => {
    const weighted = rows.reduce((acc, r) => acc + r.weightedPipelineUsd, 0);
    const committed = rows.reduce((acc, r) => acc + r.committedUsd, 0);
    const active = rows.reduce((acc, r) => acc + r.activePipelineUsd, 0);
    const atRisk = rows.reduce((acc, r) => acc + r.atRisk, 0);
    return { weighted, committed, active, atRisk };
  }, [rows]);

  const ownerRows = (data.ownerThroughput ?? []).slice().sort((a, b) => {
    if (b.overdueTasks !== a.overdueTasks) return b.overdueTasks - a.overdueTasks;
    if (b.atRiskOpportunities !== a.atRiskOpportunities)
      return b.atRiskOpportunities - a.atRiskOpportunities;
    return b.openTasks - a.openTasks;
  });

  const maxPipelineValue = Math.max(...rows.map(r => r.activePipelineUsd), 1);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Pipeline"
          value={formatCurrency(totals.active)}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        <SummaryCard
          title="Weighted Value"
          value={formatCurrency(totals.weighted)}
          colorClass="text-blue-600"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />
        <SummaryCard
          title="Committed"
          value={formatCurrency(totals.committed)}
          colorClass="text-emerald-600"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <SummaryCard
          title="At Risk"
          value={totals.atRisk}
          colorClass={totals.atRisk > 0 ? "text-red-600" : "text-gray-400"}
          subtitle={totals.atRisk > 0 ? "Needs attention" : "All healthy"}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Pipeline by Category</h2>
            <p className="text-xs text-gray-500 mt-0.5">Active, weighted, and committed values</p>
          </div>
          <div className="p-4" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ left: -15, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                />
                <YAxis
                  tickFormatter={(v) => formatCurrency(v)}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar
                  dataKey="activePipelineUsd"
                  name="Active"
                  fill={COLORS.primary}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="weightedPipelineUsd"
                  name="Weighted"
                  fill={COLORS.secondary}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="committedUsd"
                  name="Committed"
                  fill={COLORS.accent}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pipeline breakdown */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Pipeline Breakdown</h3>
            <div className="space-y-4">
              {rows.map((row) => (
                <div key={row.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-700">{row.label}</span>
                    <span className="text-xs text-gray-500">{row.atRisk > 0 && `${row.atRisk} at risk`}</span>
                  </div>
                  <ProgressBar 
                    value={row.activePipelineUsd} 
                    max={maxPipelineValue}
                    colorClass={row.key === "fundraising" ? "bg-blue-500" : "bg-gray-700"}
                  />
                </div>
              ))}
            </div>
          </div>
          
          {/* Quick stats */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-white">
            <h3 className="font-semibold mb-3 text-gray-200">Quick Metrics</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Conversion Rate</span>
                <span className="font-mono font-bold">
                  {totals.active > 0 ? Math.round((totals.committed / totals.active) * 100) : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Avg Deal Size</span>
                <span className="font-mono font-bold">
                  {rows.length > 0 ? formatCurrency(totals.active / rows.length) : "$0"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Health Score</span>
                <span className={`font-mono font-bold ${totals.atRisk === 0 ? "text-emerald-400" : "text-amber-400"}`}>
                  {Math.max(0, 100 - (totals.atRisk * 10))}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Owner throughput table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Team Performance</h2>
            <p className="text-xs text-gray-500 mt-0.5">Last 7 days activity</p>
          </div>
          <span className="text-xs text-gray-400">{ownerRows.length} team members</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[11px] text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-medium">Team Member</th>
                <th className="px-4 py-3 text-right font-medium">Active</th>
                <th className="px-4 py-3 text-right font-medium">At Risk</th>
                <th className="px-4 py-3 text-right font-medium">Open Tasks</th>
                <th className="px-4 py-3 text-right font-medium">Overdue</th>
                <th className="px-4 py-3 text-right font-medium">Completed</th>
                <th className="px-4 py-3 text-right font-medium">Touches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ownerRows.map((o) => (
                <tr key={o.userId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-sm font-medium text-gray-600">
                        {o.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{o.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{o.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm">{o.activeOpportunities}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono text-sm ${o.atRiskOpportunities > 0 ? "text-red-600 font-medium" : "text-gray-400"}`}>
                      {o.atRiskOpportunities}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm">{o.openTasks}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono text-sm ${o.overdueTasks > 0 ? "text-amber-600 font-medium" : "text-gray-400"}`}>
                      {o.overdueTasks}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm text-emerald-600">{o.completedTasksLast7d}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm">{o.touchesLast7d}</span>
                  </td>
                </tr>
              ))}
              {ownerRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <div className="text-gray-400">
                      <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className="text-sm">No team metrics available yet</p>
                      <p className="text-xs text-gray-400 mt-1">Create opportunities and tasks to see team performance</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
