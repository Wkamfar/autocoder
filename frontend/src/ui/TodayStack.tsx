import { useState, useMemo } from "react";
import type {
  CrmTodayOpportunity,
  CrmTodayTask,
  TodaySection,
  TodaySectionId,
  TodaySections,
} from "./types";

const TODAY_SECTIONS: TodaySection[] = [
  {
    id: "overdue",
    label: "Overdue",
    description: "Past-due actions that need attention now.",
  },
  {
    id: "dueToday",
    label: "Due Today",
    description: "Commitments scheduled for today.",
  },
  {
    id: "hot",
    label: "Hot",
    description: "High-value opportunities that can move the needle.",
  },
  {
    id: "waitingOnThem",
    label: "Waiting On Them",
    description: "Blocked by external counterparties.",
  },
  {
    id: "draftsReady",
    label: "Drafts Ready",
    description: "Follow-up drafts ready for review and sending.",
  },
];

// Urgency-based color system (Palantir-inspired data visualization)
const SECTION_COLORS: Record<TodaySectionId, { bg: string; accent: string; badge: string; ring: string }> = {
  overdue: { bg: "bg-red-50", accent: "border-red-500", badge: "bg-red-500 text-white", ring: "stroke-red-500" },
  dueToday: { bg: "bg-amber-50", accent: "border-amber-500", badge: "bg-amber-500 text-white", ring: "stroke-amber-500" },
  hot: { bg: "bg-emerald-50", accent: "border-emerald-500", badge: "bg-emerald-500 text-white", ring: "stroke-emerald-500" },
  waitingOnThem: { bg: "bg-blue-50", accent: "border-blue-500", badge: "bg-blue-500 text-white", ring: "stroke-blue-500" },
  draftsReady: { bg: "bg-violet-50", accent: "border-violet-500", badge: "bg-violet-500 text-white", ring: "stroke-violet-500" },
};

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value}`;
}

function formatDaysAgo(days: number | null | undefined): string {
  if (days == null) return "";
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

// Progress ring component (Apple-inspired)
function ProgressRing({ 
  progress, 
  size = 32, 
  strokeWidth = 3,
  colorClass = "stroke-emerald-500"
}: { 
  progress: number; 
  size?: number; 
  strokeWidth?: number;
  colorClass?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-gray-200"
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
        style={{ transition: "stroke-dashoffset 0.5s ease-in-out" }}
      />
    </svg>
  );
}

// Confidence badge with visual indicator
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 70 ? "bg-emerald-100 text-emerald-800" 
    : confidence >= 40 ? "bg-amber-100 text-amber-800" 
    : "bg-red-100 text-red-800";
  
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>
      <span className="font-mono">{confidence}%</span>
    </span>
  );
}

// Stage pill with semantic colors
function StagePill({ stage }: { stage: string }) {
  const isEarlyStage = stage.includes("mapped") || stage.includes("intro");
  const isLateStage = stage.includes("closing") || stage.includes("committed");
  const color = isLateStage 
    ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
    : isEarlyStage 
    ? "bg-gray-100 text-gray-700 border-gray-200"
    : "bg-blue-100 text-blue-800 border-blue-200";
  
  // Clean up stage name for display
  const displayStage = stage.split(".").pop()?.replace(/_/g, " ") || stage;
  
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-medium uppercase tracking-wide ${color}`}>
      {displayStage}
    </span>
  );
}

export interface TodayStackProps {
  sections: TodaySections | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function OpportunityRow({
  opp,
  selected,
  onSelect,
  sectionId,
}: {
  opp: CrmTodayOpportunity;
  selected: boolean;
  onSelect: () => void;
  sectionId: TodaySectionId;
}) {
  const due = parseDate(opp.nextActionDueAt);
  const overdue =
    opp.status === "active" &&
    due != null &&
    due.getTime() < new Date().getTime();
  
  const colors = SECTION_COLORS[sectionId];

  return (
    <li
      className={`group px-3 py-2.5 cursor-pointer transition-all duration-150 ${
        selected 
          ? "bg-black text-white shadow-lg" 
          : `bg-white hover:${colors.bg} hover:shadow-sm`
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Main content */}
        <div className="min-w-0 flex-1">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-semibold text-sm truncate ${selected ? "text-white" : "text-gray-900"}`}>
              {opp.relationshipName}
            </span>
            <StagePill stage={opp.stage} />
          </div>
          
          {/* Next action */}
          <p className={`text-xs mb-1.5 line-clamp-2 ${selected ? "text-gray-300" : "text-gray-600"}`}>
            {opp.nextAction ?? (
              <span className="italic opacity-60">No next action defined</span>
            )}
          </p>
          
          {/* Metadata row */}
          <div className={`flex items-center gap-2 text-[10px] ${selected ? "text-gray-400" : "text-gray-500"}`}>
            <span className="font-medium">{opp.ownerName}</span>
            {opp.daysSinceLastInteraction != null && (
              <>
                <span className="opacity-30">•</span>
                <span className={opp.daysSinceLastInteraction > 14 ? "text-red-500 font-medium" : ""}>
                  {formatDaysAgo(opp.daysSinceLastInteraction)}
                </span>
              </>
            )}
            {overdue && !selected && (
              <>
                <span className="opacity-30">•</span>
                <span className="text-red-600 font-semibold flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  OVERDUE
                </span>
              </>
            )}
            {due && (
              <>
                <span className="opacity-30">•</span>
                <span>
                  {due.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </>
            )}
          </div>
        </div>
        
        {/* Right: Value metrics */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {opp.expectedValueUsd != null && (
            <span className={`text-sm font-mono font-semibold ${selected ? "text-white" : "text-gray-900"}`}>
              {formatCurrency(opp.expectedValueUsd)}
            </span>
          )}
          <ConfidenceBadge confidence={opp.confidence} />
        </div>
      </div>
      
      {/* Quick action hint on hover */}
      {!selected && (
        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-2">
          <span className="text-[9px] text-gray-400 flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[8px] font-mono">↵</kbd> to open
          </span>
        </div>
      )}
    </li>
  );
}

function TaskRow({
  task,
  onSelectOpportunity,
}: {
  task: CrmTodayTask;
  onSelectOpportunity: (opportunityId: string) => void;
}) {
  const due = parseDate(task.dueAt);
  const isHighPriority = task.priority === "high" || task.priority === "urgent";

  return (
    <li 
      className="group px-3 py-2.5 bg-white hover:bg-gray-50 cursor-pointer transition-all duration-150"
      onClick={() => {
        if (task.opportunityId) {
          onSelectOpportunity(task.opportunityId);
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isHighPriority && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500" />
            )}
            <span className="font-medium text-sm truncate text-gray-900">{task.title}</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide ${
              task.priority === "urgent" ? "bg-red-100 text-red-800" :
              task.priority === "high" ? "bg-amber-100 text-amber-800" :
              "bg-gray-100 text-gray-600"
            }`}>
              TASK
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            {task.relationshipName && (
              <span className="font-medium">{task.relationshipName}</span>
            )}
            <span className="opacity-30">•</span>
            <span>{task.ownerName}</span>
            {due && (
              <>
                <span className="opacity-30">•</span>
                <span>
                  {due.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function TodayStack({ sections, selectedId, onSelect }: TodayStackProps) {
  const [collapsed, setCollapsed] = useState<Record<TodaySectionId, boolean>>({
    overdue: false,
    dueToday: false,
    hot: false,
    waitingOnThem: false,
    draftsReady: false,
  });

  // Calculate totals for summary
  const totals = useMemo(() => {
    let totalItems = 0;
    let totalValue = 0;
    let overdueCount = 0;
    
    TODAY_SECTIONS.forEach(section => {
      const bucket = sections?.[section.id];
      const opps = bucket?.opportunities ?? [];
      const tasks = bucket?.tasks ?? [];
      totalItems += opps.length + tasks.length;
      opps.forEach(opp => {
        totalValue += opp.expectedValueUsd ?? 0;
      });
      if (section.id === "overdue") {
        overdueCount = opps.length + tasks.length;
      }
    });
    
    return { totalItems, totalValue, overdueCount };
  }, [sections]);

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="bg-gray-900 text-white rounded-xl px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Today's Focus</span>
          <span className="text-[10px] text-gray-500 font-mono">
            {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-2xl font-bold font-mono">{totals.totalItems}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Active Items</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {formatCurrency(totals.totalValue)}
            </div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Pipeline Value</div>
          </div>
          <div>
            <div className={`text-2xl font-bold font-mono ${totals.overdueCount > 0 ? "text-red-400" : "text-gray-400"}`}>
              {totals.overdueCount}
            </div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Overdue</div>
          </div>
        </div>
      </div>

      {/* Section cards */}
      {TODAY_SECTIONS.map((section) => {
        const bucket = sections?.[section.id];
        const opps = bucket?.opportunities ?? [];
        const tasks = bucket?.tasks ?? [];
        const count = opps.length + tasks.length;
        const isEmpty = count === 0;
        const colors = SECTION_COLORS[section.id];

        return (
          <section
            key={section.id}
            className={`rounded-xl overflow-hidden transition-all duration-200 ${
              isEmpty 
                ? "border border-dashed border-gray-200 bg-gray-50/50" 
                : `border-2 ${colors.accent} bg-white shadow-sm hover:shadow-md`
            }`}
          >
            <button
              type="button"
              onClick={() =>
                setCollapsed((prev) => ({
                  ...prev,
                  [section.id]: !prev[section.id],
                }))
              }
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                isEmpty ? "bg-gray-50/50" : colors.bg
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Count badge */}
                <span className={`inline-flex items-center justify-center min-w-[28px] h-7 text-xs font-bold font-mono rounded-lg ${
                  isEmpty ? "bg-gray-200 text-gray-500" : colors.badge
                }`}>
                  {count}
                </span>
                <div>
                  <span className={`text-sm font-semibold ${isEmpty ? "text-gray-400" : "text-gray-900"}`}>
                    {section.label}
                  </span>
                  <p className={`text-[11px] ${isEmpty ? "text-gray-400" : "text-gray-600"}`}>
                    {section.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Section value if has items */}
                {!isEmpty && opps.length > 0 && (
                  <span className="text-xs font-mono text-gray-500 hidden sm:block">
                    {formatCurrency(opps.reduce((sum, o) => sum + (o.expectedValueUsd ?? 0), 0))}
                  </span>
                )}
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                    collapsed[section.id] ? "" : "rotate-180"
                  }`}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {!collapsed[section.id] && (
              <div className="max-h-80 overflow-y-auto">
                {isEmpty ? (
                  <div className="px-4 py-6 text-center">
                    <div className="text-gray-300 mb-2">
                      <svg className="w-8 h-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-xs text-gray-400">
                      All clear — nothing in this stack
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {opps.map((opp) => (
                      <OpportunityRow
                        key={opp.id}
                        opp={opp}
                        selected={opp.id === selectedId}
                        onSelect={() => onSelect(opp.id)}
                        sectionId={section.id}
                      />
                    ))}
                    {tasks.map((task) => (
                      <TaskRow
                        key={`task-${task.id}`}
                        task={task}
                        onSelectOpportunity={(id) => onSelect(id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
