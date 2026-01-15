import { useEffect, useState } from "react";
import type { CrmTodayItem } from "./types";
import { useVoiceGatedFetch } from "../hooks/useVoiceWriteGate";

export interface DetailPanelProps {
  item: CrmTodayItem | null;
  onUpdated?: () => void;
}

// Progress ring component (Apple-inspired)
function ProgressRing({ 
  progress, 
  size = 48, 
  strokeWidth = 4,
  colorClass = "stroke-emerald-500",
  bgColorClass = "stroke-gray-100",
  label,
  sublabel,
}: { 
  progress: number; 
  size?: number; 
  strokeWidth?: number;
  colorClass?: string;
  bgColorClass?: string;
  label?: string;
  sublabel?: string;
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
          className={bgColorClass}
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
      {(label || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {label && <span className="text-lg font-bold text-gray-900">{label}</span>}
          {sublabel && <span className="text-[9px] text-gray-500 uppercase tracking-wide">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}

// Metric card component
function MetricCard({ 
  label, 
  value, 
  sublabel,
  trend,
  icon,
  colorClass = "text-gray-900"
}: { 
  label: string; 
  value: string | number; 
  sublabel?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  colorClass?: string;
}) {
  const trendColors = {
    up: "text-emerald-500",
    down: "text-red-500",
    neutral: "text-gray-400"
  };
  
  return (
    <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-3 border border-gray-100">
      <div className="flex items-start justify-between mb-1">
        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-xl font-bold ${colorClass}`}>{value}</span>
        {trend && (
          <span className={`text-xs ${trendColors[trend]}`}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
          </span>
        )}
      </div>
      {sublabel && (
        <span className="text-[10px] text-gray-400">{sublabel}</span>
      )}
    </div>
  );
}

// Stage timeline visualization
function StageTimeline({ stage }: { stage: string }) {
  const stages = ["mapped", "intro", "first_call", "followup", "due_diligence", "term_sheet", "closing", "committed"];
  const currentStageKey = stage.split(".").pop() || "";
  const currentIndex = stages.findIndex(s => currentStageKey.includes(s));
  
  return (
    <div className="flex items-center gap-1">
      {stages.slice(0, 6).map((s, i) => {
        const isActive = i <= currentIndex;
        const isCurrent = i === currentIndex;
        
        return (
          <div key={s} className="flex items-center">
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
              isCurrent ? "w-3 h-3 bg-blue-500 ring-2 ring-blue-200" :
              isActive ? "bg-blue-500" : "bg-gray-200"
            }`} />
            {i < 5 && (
              <div className={`w-4 h-0.5 ${isActive ? "bg-blue-500" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Action button component
function ActionButton({ 
  children, 
  variant = "primary",
  size = "md",
  disabled,
  loading,
  onClick 
}: { 
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}) {
  const variants = {
    primary: "bg-black text-white hover:bg-gray-800 active:bg-gray-900",
    secondary: "bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 active:bg-gray-100",
    ghost: "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-[11px]",
    md: "px-4 py-2 text-xs"
  };
  
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150
        ${variants[variant]} ${sizes[size]}
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      {loading && (
        <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
}

export function DetailPanel({ item, onUpdated }: DetailPanelProps) {
  const [localValue, setLocalValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const { run: voiceGatedFetch, hasValidToken } = useVoiceGatedFetch();

  useEffect(() => {
    if (item?.expectedValueUsd != null) {
      setLocalValue(String(item.expectedValueUsd));
    } else {
      setLocalValue("");
    }
    setError(null);
  }, [item]);

  if (!item) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gradient-to-br from-gray-50 to-white">
        <div className="p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-700 mb-1">Select an opportunity</p>
          <p className="text-xs text-gray-400 max-w-[200px]">
            Click any row in the Today Stack to view detailed context and take action
          </p>
        </div>
      </div>
    );
  }

  const nextActionDate =
    item.nextActionDueAt != null ? new Date(item.nextActionDueAt) : null;
  
  const isOverdue = nextActionDate && nextActionDate < new Date();
  const daysUntilDue = nextActionDate 
    ? Math.ceil((nextActionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const handleHighValueSave = async () => {
    if (!item) return;
    setError(null);

    const parsed = localValue.trim() === "" ? null : Number(localValue);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      setError("Enter a valid non-negative amount or leave blank.");
      return;
    }

    try {
      setSaving(true);
      const res = await voiceGatedFetch(`/api/crm/opportunities/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expectedValueUsd: parsed,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const msg =
          json.message ||
          json.error ||
          `Failed to save. Server responded with ${res.status}.`;
        setError(String(msg));
        return;
      }

      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
      if (onUpdated) onUpdated();
    } catch (e: any) {
      const msg =
        e?.code === "VOICE_WRITE_TOKEN_REQUIRED"
          ? "Voice verification required. Use the Voice Write Gate button, then retry."
          : e?.message || "Failed to save high-value edit.";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  return (
    <div className="h-full border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-gray-100 px-4 py-4 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">
              {item.relationshipName}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                {item.type}
              </span>
              <StageTimeline stage={item.stage} />
            </div>
          </div>
          {/* Confidence ring */}
          <div className="flex-shrink-0">
            <ProgressRing
              progress={item.confidence}
              size={56}
              strokeWidth={5}
              colorClass={item.confidence >= 60 ? "stroke-emerald-500" : item.confidence >= 30 ? "stroke-amber-500" : "stroke-red-500"}
              label={`${item.confidence}`}
              sublabel="conf"
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Expected Value"
            value={item.expectedValueUsd ? formatCurrency(item.expectedValueUsd) : "—"}
            colorClass={item.expectedValueUsd && item.expectedValueUsd >= 500000 ? "text-emerald-600" : "text-gray-900"}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <MetricCard
            label="Owner"
            value={item.ownerName}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />
        </div>

        {/* Next Action */}
        <div className={`rounded-xl p-4 border ${
          isOverdue ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-100"
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                  isOverdue ? "text-red-600" : "text-blue-600"
                }`}>
                  Next Action
                </span>
                {isOverdue && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white">
                    OVERDUE
                  </span>
                )}
              </div>
              <p className={`text-sm ${isOverdue ? "text-red-900" : "text-gray-900"}`}>
                {item.nextAction ?? (
                  <span className="italic text-gray-400">
                    No next action defined — set one to keep momentum
                  </span>
                )}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              {nextActionDate ? (
                <div className={`text-sm font-medium ${isOverdue ? "text-red-600" : "text-blue-600"}`}>
                  {daysUntilDue === 0 ? "Today" :
                   daysUntilDue === 1 ? "Tomorrow" :
                   daysUntilDue && daysUntilDue > 0 ? `${daysUntilDue}d` :
                   `${Math.abs(daysUntilDue || 0)}d ago`}
                </div>
              ) : (
                <span className="text-xs text-gray-400">No date</span>
              )}
              {nextActionDate && (
                <div className="text-[10px] text-gray-500">
                  {nextActionDate.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tasks & Interactions placeholder */}
        <div className="rounded-xl border border-gray-100 p-4 bg-gray-50/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">
              Activity Timeline
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">Coming soon</span>
          </div>
          <div className="flex items-center justify-center py-6">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-xs text-gray-400">
                Tasks and interaction history will appear here
              </p>
            </div>
          </div>
        </div>

        {/* Value edit section */}
        <div className="rounded-xl border border-gray-200 p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">
                Update Expected Value
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {hasValidToken ? "Voice verified — ready to save" : "Voice verification required"}
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] ${
              hasValidToken ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${hasValidToken ? "bg-emerald-500" : "bg-amber-500"}`} />
              {hasValidToken ? "Verified" : "Need voice"}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                inputMode="decimal"
                className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-300 transition-all"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                placeholder="0"
              />
            </div>
            <ActionButton
              variant="primary"
              onClick={handleHighValueSave}
              disabled={saving}
              loading={saving}
            >
              {showSaveSuccess ? (
                <>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </>
              ) : (
                "Save"
              )}
            </ActionButton>
          </div>
          
          {error && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ActionButton variant="ghost" size="sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit
          </ActionButton>
          <ActionButton variant="ghost" size="sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </ActionButton>
        </div>
        <ActionButton variant="secondary" size="sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open Full View
        </ActionButton>
      </div>
    </div>
  );
}
