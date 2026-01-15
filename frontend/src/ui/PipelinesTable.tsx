import { useState, useMemo, useCallback, useRef, useEffect } from "react";

interface PipelineOpportunity {
  id: string;
  name: string;
  type: string;
  stage: string;
  status: string;
  relationshipName: string;
  relationshipType?: string; // investor, enterprise, government
  ownerName: string;
  ownerId?: string | null;
  expectedValueUsd: number | null;
  confidence: number;
}

export interface CrmUser {
  id: string;
  name: string;
  email: string;
  status: string;
  role: { name: string };
}

export interface PipelinesTableProps {
  opportunities: PipelineOpportunity[];
  selectedOpportunityId?: string | null;
  availableUsers?: CrmUser[];
  onSelectOpportunity?: (opportunityId: string, relationshipName: string) => void;
  onUpdateOpportunity?: (opportunityId: string, field: string, value: any) => Promise<void>;
  onAssignOwner?: (opportunityId: string) => void;
}

// Stage progression for visual indicator
const STAGE_ORDER = [
  "fundraising.mapped",
  "fundraising.intro_made", 
  "fundraising.first_call",
  "fundraising.followup",
  "fundraising.due_diligence",
  "fundraising.term_sheet",
  "fundraising.closing",
  "fundraising.committed",
  "fundraising.closed_lost",
];

function getStageIndex(stage: string): number {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx >= 0 ? idx : 0;
}

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function formatTypeLabel(type: string): string {
  // e.g. enterprise_contract -> Enterprise
  if (type === "enterprise_contract") return "Enterprise";
  if (type === "government_pilot") return "Government";
  if (type === "fundraising") return "Fundraising";
  if (type === "partnership") return "Partnership";
  // fallback: title-case words
  return type
    .split(".")
    .pop()
    ?.replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase()) ?? type;
}

function TypeBadge({ type }: { type: string }) {
  const config =
    type === "fundraising"
      ? { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" }
      : type === "enterprise_contract"
        ? { bg: "bg-zinc-100", text: "text-zinc-700", dot: "bg-zinc-500" }
        : type === "government_pilot"
          ? { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-500" }
          : type === "partnership"
            ? { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" }
            : { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-400" };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.text}`}
      title={type}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {formatTypeLabel(type)}
    </span>
  );
}

// Confidence heat indicator (Palantir-style)
function ConfidenceHeat({ confidence }: { confidence: number }) {
  const getColor = () => {
    if (confidence >= 80) return "bg-emerald-500";
    if (confidence >= 60) return "bg-emerald-400";
    if (confidence >= 40) return "bg-amber-400";
    if (confidence >= 20) return "bg-amber-500";
    return "bg-red-400";
  };
  
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-300 ${getColor()}`}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <span className="font-mono text-[11px] w-8 text-right">{confidence}%</span>
    </div>
  );
}

// Stage progress indicator
function StageProgress({ stage }: { stage: string }) {
  const currentIndex = getStageIndex(stage);
  const isClosed = stage.includes("closed") || stage.includes("committed");
  
  const displayStage = stage.split(".").pop()?.replace(/_/g, " ") || stage;
  
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-shrink-0">
        {/* Stage dots */}
        <div className="flex items-center gap-0.5">
          {[...Array(5)].map((_, i) => {
            const filled = i <= Math.floor(currentIndex / 2);
            return (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  filled 
                    ? isClosed && stage.includes("committed") ? "bg-emerald-500" 
                      : isClosed ? "bg-gray-400" 
                      : "bg-blue-500"
                    : "bg-gray-200"
                }`}
              />
            );
          })}
        </div>
      </div>
      <span className={`text-[11px] capitalize truncate ${
        stage.includes("committed") ? "text-emerald-600 font-medium" :
        stage.includes("closed_lost") ? "text-gray-400" :
        "text-gray-700"
      }`}>
        {displayStage}
      </span>
    </div>
  );
}

// Status badge with semantic colors
function StatusBadge({ status }: { status: string }) {
  const config = {
    active: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
    inactive: { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" },
    closed_won: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
    closed_lost: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400" },
  }[status] || { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
}

// Inline edit input with smooth animations
function InlineEdit({
  value,
  onChange,
  onSave,
  onCancel,
  type = "text",
  options,
  prefix,
  suffix,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  type?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  const baseStyles = "px-2 py-1 text-xs bg-white border-2 border-blue-500 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all";
  
  if (type === "select" && options) {
    return (
      <div className="flex items-center gap-1">
        {prefix && <span className="text-xs text-gray-500">{prefix}</span>}
        <select
          ref={inputRef as any}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
          className={`${baseStyles} ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1">
      {prefix && <span className="text-xs text-gray-500">{prefix}</span>}
      <input
        ref={inputRef as any}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
        className={`${baseStyles} w-24 ${className}`}
        onClick={(e) => e.stopPropagation()}
        min={type === "number" ? 0 : undefined}
        max={type === "number" && suffix === "%" ? 100 : undefined}
      />
      {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
    </div>
  );
}

// Filter chip component
function FilterChip({ 
  label, 
  value, 
  onClear,
  active 
}: { 
  label: string; 
  value: string; 
  onClear: () => void;
  active: boolean;
}) {
  if (!active) return null;
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-black text-white rounded-full text-[10px] font-medium">
      <span className="text-gray-400">{label}:</span>
      <span>{value}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        className="ml-0.5 hover:bg-white/20 rounded-full p-0.5 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

export function PipelinesTable({ 
  opportunities, 
  selectedOpportunityId,
  availableUsers = [],
  onSelectOpportunity,
  onUpdateOpportunity,
  onAssignOwner,
}: PipelinesTableProps) {
  const [stageFilter, setStageFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [relationshipTypeFilter, setRelationshipTypeFilter] = useState<string>("");
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const stages = useMemo(() => {
    const set = new Set<string>();
    opportunities.forEach((opp) => set.add(opp.stage));
    return Array.from(set).sort();
  }, [opportunities]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    opportunities.forEach((opp) => set.add(opp.status));
    return Array.from(set).sort();
  }, [opportunities]);

  const types = useMemo(() => {
    const set = new Set<string>();
    opportunities.forEach((opp) => set.add(opp.type));
    return Array.from(set).sort();
  }, [opportunities]);

  const relationshipTypes = useMemo(() => {
    const set = new Set<string>();
    opportunities.forEach((opp) => {
      if (opp.relationshipType) {
        set.add(opp.relationshipType);
      }
    });
    return Array.from(set).sort();
  }, [opportunities]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    opportunities.forEach((opp) => set.add(opp.ownerName));
    return Array.from(set).sort();
  }, [opportunities]);

  const filtered = useMemo(() => {
    let result = opportunities.filter((opp) => {
      if (stageFilter && opp.stage !== stageFilter) return false;
      if (statusFilter && opp.status !== statusFilter) return false;
      if (typeFilter && opp.type !== typeFilter) return false;
      if (relationshipTypeFilter && opp.relationshipType !== relationshipTypeFilter) return false;
      if (ownerFilter && opp.ownerName !== ownerFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!opp.relationshipName.toLowerCase().includes(query) &&
            !opp.name.toLowerCase().includes(query) &&
            !opp.ownerName.toLowerCase().includes(query) &&
            !opp.type.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
    
    // Apply sorting
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        let aVal: any = a[sortConfig.key as keyof PipelineOpportunity];
        let bVal: any = b[sortConfig.key as keyof PipelineOpportunity];
        
        // Handle null values
        if (aVal == null) aVal = sortConfig.direction === "asc" ? Infinity : -Infinity;
        if (bVal == null) bVal = sortConfig.direction === "asc" ? Infinity : -Infinity;
        
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    
    return result;
  }, [opportunities, stageFilter, statusFilter, typeFilter, relationshipTypeFilter, ownerFilter, searchQuery, sortConfig]);

  // Summary metrics
  const metrics = useMemo(() => {
    const total = filtered.length;
    const totalValue = filtered.reduce((sum, o) => sum + (o.expectedValueUsd ?? 0), 0);
    const avgConfidence = total > 0 
      ? Math.round(filtered.reduce((sum, o) => sum + o.confidence, 0) / total)
      : 0;
    const activeCount = filtered.filter(o => o.status === "active").length;
    
    return { total, totalValue, avgConfidence, activeCount };
  }, [filtered]);

  const handleSort = useCallback((key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return prev.direction === "asc" 
          ? { key, direction: "desc" }
          : null;
      }
      return { key, direction: "asc" };
    });
  }, []);

  const handleCellClick = (opp: PipelineOpportunity, field: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!onUpdateOpportunity) return;
    
    setEditingCell({ id: opp.id, field });
    
    if (field === "expectedValueUsd" || field === "confidence") {
      setEditValue(opp[field]?.toString() || "");
    } else if (field === "ownerId") {
      setEditValue(opp.ownerId || "");
    } else {
      setEditValue(opp[field as keyof PipelineOpportunity]?.toString() || "");
    }
  };

  const handleCellSave = async () => {
    if (!editingCell || !onUpdateOpportunity) return;
    
    let value: any = editValue;
    
    if (editingCell.field === "expectedValueUsd" || editingCell.field === "confidence") {
      const numValue = parseFloat(editValue);
      if (isNaN(numValue)) {
        setEditingCell(null);
        setEditValue("");
        return;
      }
      value = editingCell.field === "confidence" ? Math.max(0, Math.min(100, numValue)) : numValue;
    }
    
    if (value === "" && (editingCell.field === "expectedValueUsd" || editingCell.field === "ownerId")) {
      value = null;
    }
    
    await onUpdateOpportunity(editingCell.id, editingCell.field, value);
    setEditingCell(null);
    setEditValue("");
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue("");
  };
  
  const isEditing = (oppId: string, field: string) => {
    return editingCell?.id === oppId && editingCell?.field === field;
  };

  const hasActiveFilters = stageFilter || statusFilter || typeFilter || relationshipTypeFilter || ownerFilter || searchQuery;

  const clearAllFilters = () => {
    setStageFilter("");
    setStatusFilter("");
    setTypeFilter("");
    setRelationshipTypeFilter("");
    setOwnerFilter("");
    setSearchQuery("");
  };

  if (opportunities.length === 0) {
    return (
      <div className="border-2 border-dashed border-gray-200 rounded-2xl px-8 py-12 text-center">
        <div className="text-gray-300 mb-3">
          <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-600 mb-1">No opportunities yet</p>
        <p className="text-xs text-gray-400">
          Import data or create opportunities to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="border-2 border-black rounded-2xl overflow-hidden bg-white flex flex-col">
      {/* Header with metrics */}
      <div className="border-b-2 border-black bg-gradient-to-r from-gray-50 to-white px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-gray-900">Pipeline</h2>
            {/* Quick stats */}
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-gray-500">{metrics.activeCount} active</span>
              </span>
              <span className="text-gray-300">|</span>
              <span className="font-mono text-gray-700">{formatCurrency(metrics.totalValue)}</span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-500">{metrics.avgConfidence}% avg conf</span>
            </div>
          </div>
          <span className="text-[11px] text-gray-500 font-mono">
            {filtered.length} / {opportunities.length}
          </span>
        </div>
        
        {/* Search and filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-40 pl-8 pr-3 py-1.5 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
            />
          </div>
          
          {/* Filters */}
          <select
            className="px-3 py-1.5 text-[11px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black/5"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="">All stages</option>
            {stages.map((stage) => (
              <option key={stage} value={stage}>{stage.split(".").pop()?.replace(/_/g, " ")}</option>
            ))}
          </select>
          
          <select
            className="px-3 py-1.5 text-[11px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black/5"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          
          <select
            className="px-3 py-1.5 text-[11px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black/5"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {types.map((type) => (
              <option key={type} value={type}>{formatTypeLabel(type)}</option>
            ))}
          </select>

          <select
            className="px-3 py-1.5 text-[11px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black/5"
            value={relationshipTypeFilter}
            onChange={(e) => setRelationshipTypeFilter(e.target.value)}
          >
            <option value="">All relationships</option>
            {relationshipTypes.map((relType) => (
              <option key={relType} value={relType}>
                {relType === "investor" ? "Investors" : relType === "enterprise" ? "Enterprises" : relType === "government" ? "Governments" : relType}
              </option>
            ))}
          </select>

          <select
            className="px-3 py-1.5 text-[11px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black/5"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <option value="">All owners</option>
            {owners.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
          
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="px-2 py-1.5 text-[11px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
        
        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <FilterChip label="Stage" value={stageFilter.split(".").pop()?.replace(/_/g, " ") || ""} onClear={() => setStageFilter("")} active={!!stageFilter} />
            <FilterChip label="Status" value={statusFilter} onClear={() => setStatusFilter("")} active={!!statusFilter} />
            <FilterChip label="Type" value={typeFilter} onClear={() => setTypeFilter("")} active={!!typeFilter} />
            {relationshipTypeFilter && (
              <FilterChip 
                label="Relationship" 
                value={relationshipTypeFilter === "investor" ? "Investors" : relationshipTypeFilter === "enterprise" ? "Enterprises" : relationshipTypeFilter === "government" ? "Governments" : relationshipTypeFilter} 
                onClear={() => setRelationshipTypeFilter("")} 
                active={!!relationshipTypeFilter} 
              />
            )}
            <FilterChip label="Owner" value={ownerFilter} onClear={() => setOwnerFilter("")} active={!!ownerFilter} />
            {searchQuery && (
              <FilterChip label="Search" value={`"${searchQuery}"`} onClear={() => setSearchQuery("")} active={true} />
            )}
          </div>
        )}
      </div>
      
      {/* Table */}
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr className="text-[11px] text-gray-500">
              <th 
                className="px-3 py-2.5 text-left font-medium cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort("relationshipName")}
              >
                <div className="flex items-center gap-1">
                  Relationship
                  {sortConfig?.key === "relationshipName" && (
                    <span className="text-black">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
              <th className="px-3 py-2.5 text-left font-medium">Name</th>
              <th
                className="px-3 py-2.5 text-left font-medium cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort("type")}
              >
                <div className="flex items-center gap-1">
                  Type
                  {sortConfig?.key === "type" && (
                    <span className="text-black">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-3 py-2.5 text-left font-medium cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort("stage")}
              >
                <div className="flex items-center gap-1">
                  Stage
                  {sortConfig?.key === "stage" && (
                    <span className="text-black">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
              <th className="px-3 py-2.5 text-left font-medium">Status</th>
              <th className="px-3 py-2.5 text-left font-medium">Owner</th>
              <th 
                className="px-3 py-2.5 text-right font-medium cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort("expectedValueUsd")}
              >
                <div className="flex items-center gap-1 justify-end">
                  Value
                  {sortConfig?.key === "expectedValueUsd" && (
                    <span className="text-black">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-3 py-2.5 text-right font-medium cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort("confidence")}
              >
                <div className="flex items-center gap-1 justify-end">
                  Confidence
                  {sortConfig?.key === "confidence" && (
                    <span className="text-black">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((opp) => {
              const isSelected = selectedOpportunityId === opp.id;
              return (
                <tr
                  key={opp.id}
                  className={`group cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? "bg-black text-white"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => onSelectOpportunity?.(opp.id, opp.relationshipName)}
                >
                  {/* Relationship */}
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOpportunity?.(opp.id, opp.relationshipName);
                      }}
                      className={`font-medium text-sm truncate max-w-[200px] block ${
                        isSelected
                          ? "text-white"
                          : "text-gray-900 hover:text-blue-600"
                      }`}
                    >
                      {opp.relationshipName}
                    </button>
                  </td>
                  
                  {/* Name */}
                  <td className="px-3 py-2.5">
                    <span className={`text-[11px] truncate max-w-[160px] block ${isSelected ? "text-gray-300" : "text-gray-500"}`}>
                      {opp.name}
                    </span>
                  </td>

                  {/* Type */}
                  <td
                    className={`px-3 py-2.5 cursor-pointer ${!isSelected && "hover:bg-gray-100"}`}
                    onClick={(e) => handleCellClick(opp, "type", e)}
                  >
                    {isEditing(opp.id, "type") ? (
                      <InlineEdit
                        value={editValue}
                        onChange={setEditValue}
                        onSave={handleCellSave}
                        onCancel={handleCellCancel}
                        type="select"
                        options={types.map((t) => ({ value: t, label: formatTypeLabel(t) }))}
                      />
                    ) : (
                      <TypeBadge type={opp.type} />
                    )}
                  </td>
                  
                  {/* Stage */}
                  <td 
                    className={`px-3 py-2.5 cursor-pointer ${!isSelected && "hover:bg-gray-100"}`}
                    onClick={(e) => handleCellClick(opp, "stage", e)}
                  >
                    {isEditing(opp.id, "stage") ? (
                      <InlineEdit
                        value={editValue}
                        onChange={setEditValue}
                        onSave={handleCellSave}
                        onCancel={handleCellCancel}
                        type="select"
                        options={stages.map(s => ({ value: s, label: s.split(".").pop()?.replace(/_/g, " ") || s }))}
                      />
                    ) : (
                      <StageProgress stage={opp.stage} />
                    )}
                  </td>
                  
                  {/* Status */}
                  <td 
                    className={`px-3 py-2.5 cursor-pointer ${!isSelected && "hover:bg-gray-100"}`}
                    onClick={(e) => handleCellClick(opp, "status", e)}
                  >
                    {isEditing(opp.id, "status") ? (
                      <InlineEdit
                        value={editValue}
                        onChange={setEditValue}
                        onSave={handleCellSave}
                        onCancel={handleCellCancel}
                        type="select"
                        options={statuses.map(s => ({ value: s, label: s }))}
                      />
                    ) : (
                      <StatusBadge status={opp.status} />
                    )}
                  </td>
                  
                  {/* Owner */}
                  <td 
                    className={`px-3 py-2.5 cursor-pointer ${!isSelected && "hover:bg-gray-100"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onAssignOwner) {
                        onAssignOwner(opp.id);
                      }
                    }}
                  >
                    <span className={`inline-flex items-center gap-1.5 text-[11px] ${
                      isSelected ? "text-gray-300" : "text-gray-600 hover:text-gray-900"
                    }`}>
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-[10px] font-medium text-gray-600">
                        {opp.ownerName?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                      <span className="truncate max-w-[80px]">{opp.ownerName || "—"}</span>
                    </span>
                  </td>
                  
                  {/* Value */}
                  <td 
                    className={`px-3 py-2.5 text-right cursor-pointer ${!isSelected && "hover:bg-gray-100"}`}
                    onClick={(e) => handleCellClick(opp, "expectedValueUsd", e)}
                  >
                    {isEditing(opp.id, "expectedValueUsd") ? (
                      <InlineEdit
                        value={editValue}
                        onChange={setEditValue}
                        onSave={handleCellSave}
                        onCancel={handleCellCancel}
                        type="number"
                        prefix="$"
                      />
                    ) : (
                      <span className={`font-mono text-sm font-medium ${
                        isSelected ? "text-white" : 
                        (opp.expectedValueUsd ?? 0) >= 500000 ? "text-emerald-600" : "text-gray-900"
                      }`}>
                        {formatCurrency(opp.expectedValueUsd)}
                      </span>
                    )}
                  </td>
                  
                  {/* Confidence */}
                  <td 
                    className={`px-3 py-2.5 cursor-pointer ${!isSelected && "hover:bg-gray-100"}`}
                    onClick={(e) => handleCellClick(opp, "confidence", e)}
                  >
                    {isEditing(opp.id, "confidence") ? (
                      <InlineEdit
                        value={editValue}
                        onChange={setEditValue}
                        onSave={handleCellSave}
                        onCancel={handleCellCancel}
                        type="number"
                        suffix="%"
                      />
                    ) : isSelected ? (
                      <span className="font-mono text-sm text-white">{opp.confidence}%</span>
                    ) : (
                      <ConfidenceHeat confidence={opp.confidence} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Footer with keyboard hints */}
      <div className="border-t border-gray-100 px-4 py-2 bg-gray-50 text-[10px] text-gray-400 flex items-center justify-between">
        <span>Click any cell to edit inline</span>
        <div className="flex items-center gap-3">
          <span><kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">Enter</kbd> Select</span>
          <span><kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">Esc</kbd> Cancel</span>
        </div>
      </div>
    </div>
  );
}
