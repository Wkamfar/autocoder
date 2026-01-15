import { useMemo, useState } from "react";
import type { CrmTodayItem } from "./types";

export interface IntelligencePanelProps {
  items: CrmTodayItem[];
  selected: CrmTodayItem | null;
}

// Utility functions
function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

// Progress ring component (Apple-inspired)
function ProgressRing({ 
  progress, 
  size = 40, 
  strokeWidth = 3,
  colorClass = "stroke-emerald-500",
  label,
}: { 
  progress: number; 
  size?: number; 
  strokeWidth?: number;
  colorClass?: string;
  label?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-gray-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={colorClass}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      {label && (
        <span className="absolute text-[10px] font-bold text-gray-900">{label}</span>
      )}
    </div>
  );
}

// Sparkline mini chart
function Sparkline({ 
  data, 
  color = "#10b981",
  height = 24,
  width = 60,
}: { 
  data: number[]; 
  color?: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2) return null;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* End dot */}
      <circle
        cx={(data.length - 1) / (data.length - 1) * width}
        cy={height - ((data[data.length - 1] - min) / range) * height}
        r="2"
        fill={color}
      />
    </svg>
  );
}

// Metric tile component
function MetricTile({ 
  label, 
  value, 
  subvalue,
  trend,
  trendValue,
  sparklineData,
  icon,
  colorClass = "text-gray-900",
  size = "md",
}: { 
  label: string; 
  value: string | number; 
  subvalue?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  sparklineData?: number[];
  icon?: React.ReactNode;
  colorClass?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "p-2",
    md: "p-3",
    lg: "p-4",
  };
  
  const valueClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  const trendColors = {
    up: "text-emerald-500 bg-emerald-50",
    down: "text-red-500 bg-red-50",
    neutral: "text-gray-400 bg-gray-50",
  };

  return (
    <div className={`bg-gradient-to-br from-white to-gray-50/50 rounded-xl border border-gray-100 ${sizeClasses[size]} hover:shadow-sm transition-shadow`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {icon && <span className="text-gray-400">{icon}</span>}
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide truncate">{label}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`${valueClasses[size]} font-bold ${colorClass}`}>{value}</span>
            {trend && trendValue && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold ${trendColors[trend]}`}>
                {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
              </span>
            )}
          </div>
          {subvalue && (
            <span className="text-[10px] text-gray-400 mt-0.5 block">{subvalue}</span>
          )}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <div className="flex-shrink-0 opacity-60">
            <Sparkline 
              data={sparklineData} 
              color={trend === "down" ? "#ef4444" : "#10b981"}
              height={20}
              width={50}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Priority indicator
function PriorityIndicator({ level }: { level: "critical" | "high" | "medium" | "low" }) {
  const config = {
    critical: { color: "bg-red-500", pulse: true, label: "Critical" },
    high: { color: "bg-amber-500", pulse: false, label: "High" },
    medium: { color: "bg-blue-500", pulse: false, label: "Medium" },
    low: { color: "bg-gray-400", pulse: false, label: "Low" },
  }[level];

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`relative flex h-2 w-2`}>
        {config.pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.color}`} />
      </span>
      <span className="text-[10px] text-gray-600">{config.label}</span>
    </span>
  );
}

// Action card component
function ActionCard({ 
  icon, 
  title, 
  description,
  priority,
  onClick,
}: { 
  icon: React.ReactNode;
  title: string;
  description: string;
  priority?: "critical" | "high" | "medium" | "low";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-black group-hover:text-white transition-colors">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-sm font-medium text-gray-900 truncate">{title}</span>
            {priority && <PriorityIndicator level={priority} />}
          </div>
          <p className="text-[11px] text-gray-500 line-clamp-2">{description}</p>
        </div>
      </div>
    </button>
  );
}

// Distribution bar
function DistributionBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
        {segments.map((segment, i) => (
          <div
            key={i}
            className={`${segment.color} transition-all duration-500`}
            style={{ width: `${(segment.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {segments.map((segment, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${segment.color}`} />
            <span className="text-[10px] text-gray-600">{segment.label}</span>
            <span className="text-[10px] font-mono text-gray-900">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IntelligencePanel({ items, selected }: IntelligencePanelProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Calculate comprehensive metrics
  const metrics = useMemo(() => {
    const totalValue = items.reduce((acc, item) => acc + (item.expectedValueUsd ?? 0), 0);
    const activeItems = items.filter(i => i.status === "active");
    const avgConfidence = items.length > 0 
      ? Math.round(items.reduce((acc, i) => acc + i.confidence, 0) / items.length)
      : 0;
    
    const hotOpps = items.filter(
      i => i.status === "active" && (i.expectedValueUsd ?? 0) >= 250_000 && i.confidence >= 60
    );
    
    const overdueItems = items.filter(i => {
      if (!i.nextActionDueAt) return false;
      return new Date(i.nextActionDueAt) < new Date();
    });
    
    const highValueItems = items.filter(i => (i.expectedValueUsd ?? 0) >= 500_000);
    const lowConfidenceItems = items.filter(i => i.confidence < 30);
    
    // Stage distribution
    const stageDistribution = items.reduce((acc, item) => {
      const stage = item.stage.split(".").pop() || item.stage;
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Owner distribution
    const ownerDistribution = items.reduce((acc, item) => {
      acc[item.ownerName] = (acc[item.ownerName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Type distribution
    const typeDistribution = items.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Mock sparkline data (would come from historical API in production)
    const pipelineHistory = [totalValue * 0.85, totalValue * 0.9, totalValue * 0.88, totalValue * 0.95, totalValue];
    const itemsHistory = [items.length - 5, items.length - 3, items.length - 2, items.length - 1, items.length];

    return {
      totalValue,
      activeItems: activeItems.length,
      avgConfidence,
      hotOpps,
      overdueItems,
      highValueItems,
      lowConfidenceItems,
      stageDistribution,
      ownerDistribution,
      typeDistribution,
      pipelineHistory,
      itemsHistory,
    };
  }, [items]);

  // Generate contextual actions based on selected item
  const contextualActions = useMemo(() => {
    if (!selected) return [];
    
    const actions = [];
    
    // Check for overdue
    if (selected.nextActionDueAt && new Date(selected.nextActionDueAt) < new Date()) {
      actions.push({
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        title: "Address overdue action",
        description: `This opportunity is past its next action date. Update the status or reschedule.`,
        priority: "critical" as const,
      });
    }
    
    // Check for low confidence
    if (selected.confidence < 30) {
      actions.push({
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        title: "Improve confidence score",
        description: "Low confidence indicates uncertainty. Schedule a discovery call or gather more intel.",
        priority: "high" as const,
      });
    }
    
    // Check for high value without next action
    if ((selected.expectedValueUsd ?? 0) >= 250_000 && !selected.nextAction) {
      actions.push({
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
        title: "Define next action",
        description: "High-value opportunity without a clear next step. Don't let momentum slip.",
        priority: "high" as const,
      });
    }
    
    // Stage-specific recommendations
    if (selected.stage.includes("first_call")) {
      actions.push({
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
        title: "Schedule follow-up",
        description: "Post-call is critical. Send summary and schedule next touchpoint within 48h.",
        priority: "medium" as const,
      });
    }
    
    if (selected.stage.includes("followup")) {
      actions.push({
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
        title: "Push for commitment",
        description: "Multiple follow-ups done. Time to ask for a decision or clear timeline.",
        priority: "medium" as const,
      });
    }

    // Default action if nothing specific
    if (actions.length === 0) {
      actions.push({
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
        title: "Take next step",
        description: "Review the opportunity and decide on the most impactful action to move forward.",
        priority: "low" as const,
      });
    }
    
    return actions;
  }, [selected]);

  // Top opportunities by value
  const topOpportunities = useMemo(() => {
    return [...items]
      .sort((a, b) => (b.expectedValueUsd ?? 0) - (a.expectedValueUsd ?? 0))
      .slice(0, 3);
  }, [items]);

  return (
    <div className="h-full border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-900 to-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm font-bold text-white tracking-tight">
              Command Center
            </h2>
          </div>
          <span className="text-[9px] text-gray-400 font-mono">
            LIVE · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-2">
          <MetricTile
            label="Pipeline Value"
            value={formatCurrency(metrics.totalValue)}
            trend="up"
            trendValue="12%"
            sparklineData={metrics.pipelineHistory}
            colorClass="text-emerald-600"
            icon={<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <MetricTile
            label="Active Items"
            value={metrics.activeItems}
            subvalue={`of ${items.length} total`}
            sparklineData={metrics.itemsHistory}
            icon={<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
          />
          <MetricTile
            label="Hot Opportunities"
            value={metrics.hotOpps.length}
            subvalue="≥$250K & ≥60% conf"
            colorClass={metrics.hotOpps.length > 0 ? "text-amber-600" : "text-gray-400"}
            icon={<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>}
          />
          <MetricTile
            label="Avg Confidence"
            value={`${metrics.avgConfidence}%`}
            colorClass={metrics.avgConfidence >= 50 ? "text-emerald-600" : metrics.avgConfidence >= 30 ? "text-amber-600" : "text-red-600"}
            icon={<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
          />
        </div>

        {/* Alerts Section */}
        {(metrics.overdueItems.length > 0 || metrics.lowConfidenceItems.length > 0) && (
          <div className="rounded-xl bg-gradient-to-r from-red-50 to-amber-50 border border-red-100 p-3">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs font-semibold text-red-800">Attention Required</span>
            </div>
            <div className="space-y-1.5">
              {metrics.overdueItems.length > 0 && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-red-700">{metrics.overdueItems.length} overdue action{metrics.overdueItems.length > 1 ? "s" : ""}</span>
                  <span className="text-red-500 font-medium">Review now →</span>
                </div>
              )}
              {metrics.lowConfidenceItems.length > 0 && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-amber-700">{metrics.lowConfidenceItems.length} low confidence (&lt;30%)</span>
                  <span className="text-amber-600 font-medium">De-risk →</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Item Intelligence */}
        {selected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Focus: {selected.relationshipName}
              </span>
              <ProgressRing 
                progress={selected.confidence} 
                size={28}
                colorClass={selected.confidence >= 60 ? "stroke-emerald-500" : selected.confidence >= 30 ? "stroke-amber-500" : "stroke-red-500"}
                label={`${selected.confidence}`}
              />
            </div>
            
            {/* Context summary */}
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-xs text-gray-700 leading-relaxed">
                <span className="font-semibold">{selected.relationshipName}</span> is at{" "}
                <span className="font-medium text-blue-600">{selected.stage.split(".").pop()?.replace(/_/g, " ")}</span> stage
                with <span className="font-medium">{selected.confidence}%</span> confidence
                {selected.expectedValueUsd && (
                  <> and <span className="font-semibold text-emerald-600">{formatCurrency(selected.expectedValueUsd)}</span> expected value</>
                )}.
                {selected.nextAction ? (
                  <> Next action: <span className="italic">"{selected.nextAction}"</span></>
                ) : (
                  <span className="text-amber-600"> No next action defined — set one to maintain momentum.</span>
                )}
              </p>
            </div>

            {/* Contextual Actions */}
            <div>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                Recommended Actions
              </span>
              <div className="space-y-2">
                {contextualActions.map((action, i) => (
                  <ActionCard key={i} {...action} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-gradient-to-br from-gray-50 to-white border border-dashed border-gray-200 p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Select an opportunity</p>
            <p className="text-[11px] text-gray-400">
              Click any item to see contextual intelligence and recommended actions
            </p>
          </div>
        )}

        {/* Pipeline Distribution */}
        <div className="rounded-xl border border-gray-100 p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Stage Distribution
            </span>
            <span className="text-[9px] text-gray-400 font-mono">{items.length} total</span>
          </div>
          <DistributionBar
            segments={[
              { label: "Early", value: Object.entries(metrics.stageDistribution).filter(([k]) => k.includes("mapped") || k.includes("intro")).reduce((sum, [, v]) => sum + v, 0), color: "bg-gray-400" },
              { label: "Active", value: Object.entries(metrics.stageDistribution).filter(([k]) => k.includes("call") || k.includes("followup")).reduce((sum, [, v]) => sum + v, 0), color: "bg-blue-500" },
              { label: "Late", value: Object.entries(metrics.stageDistribution).filter(([k]) => k.includes("diligence") || k.includes("term") || k.includes("closing")).reduce((sum, [, v]) => sum + v, 0), color: "bg-emerald-500" },
              { label: "Closed", value: Object.entries(metrics.stageDistribution).filter(([k]) => k.includes("committed") || k.includes("lost")).reduce((sum, [, v]) => sum + v, 0), color: "bg-violet-500" },
            ]}
          />
        </div>

        {/* Top Opportunities */}
        {topOpportunities.length > 0 && (
          <div className="rounded-xl border border-gray-100 p-3">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
              Top by Value
            </span>
            <div className="space-y-2">
              {topOpportunities.map((opp, i) => (
                <div key={opp.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                      {i + 1}
                    </span>
                    <span className="text-xs font-medium text-gray-900 truncate">{opp.relationshipName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-emerald-600">
                      {formatCurrency(opp.expectedValueUsd ?? 0)}
                    </span>
                    <span className="text-[10px] text-gray-400">{opp.confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-2 bg-gray-50/50">
        <div className="flex items-center justify-between text-[9px] text-gray-400">
          <span>Auto-refreshes every 60s</span>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
