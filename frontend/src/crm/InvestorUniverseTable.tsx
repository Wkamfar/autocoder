import { useMemo, useState, useEffect } from "react";

export interface RankedInvestorRow {
  id: string;
  name: string;
  website?: string | null;
  segment?: string | null;
  country?: string | null;
  /**
   * Deterministic 0–1000 score from the universe engine.
   */
  rankScore: number;
  rankTier: "A+" | "A" | "B" | "C";
  /**
   * High-level theme + tags from the raw/normalized universe.
   */
  categories?: string[];
  tags?: string[];
  /**
   * Deeper schema fields that the backend already computes but the
   * v1 UI was not surfacing. Keeping them optional lets us roll out
   * richer panels without breaking existing data.
   */
  city?: string | null;
  stageFocus?: string[];
  geoFocus?: string[];
  checkSizeUsdMin?: number | null;
  checkSizeUsdMax?: number | null;
  sourceType?: string;
  sourceUrls?: string[];
  dataConfidence?: number;
  nextActionTemplate?: string;
  introLikelihood?: number;
  missingFields?: string[];
  researchGaps?: string[];
}

export interface InvestorUniverseTableProps {
  investors: RankedInvestorRow[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  opportunityByRelationshipName?: Record<
    string,
    { id: string; ownerName: string; stage: string; status: string }
  >;
  investorState?: Record<
    string,
    {
      investorId: string;
      relationshipId: string;
      relationshipName: string;
      researched: boolean;
      inAttackList: boolean;
      ownerId: string | null;
      ownerName: string | null;
    }
  >;
  onOpenOpportunity?: (relationshipName: string) => void;
  onBulkSelect?: (ids: string[]) => void;
}

export function InvestorUniverseTable({
  investors,
  selectedId,
  onSelect,
  opportunityByRelationshipName,
  investorState,
  onOpenOpportunity,
  onBulkSelect,
}: InvestorUniverseTableProps) {
  // CRITICAL: All hooks must be called before any conditional returns
  // This ensures hooks are called in the same order on every render
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [tierFilter, setTierFilter] = useState<"" | "A+" | "A" | "B" | "C">("");
  const [segmentFilter, setSegmentFilter] = useState<string>("");
  const [completenessFilter, setCompletenessFilter] = useState<
    "" | "complete" | "needs_research"
  >("");

  // ALL hooks must be called before early return - including useMemo and useEffect
  const segments = useMemo(() => {
    if (!investors || investors.length === 0) return [];
    const set = new Set<string>();
    investors.forEach((inv) => {
      if (inv.segment) set.add(inv.segment);
    });
    return Array.from(set).sort();
  }, [investors]);

  const filtered = useMemo(() => {
    if (!investors || investors.length === 0) return [];
    return investors.filter((inv) => {
      if (tierFilter && inv.rankTier !== tierFilter) return false;
      if (segmentFilter && inv.segment !== segmentFilter) return false;
      if (completenessFilter) {
        const gaps = inv.researchGaps ?? inv.missingFields ?? [];
        const isComplete = gaps.length === 0;
        if (completenessFilter === "complete" && !isComplete) return false;
        if (completenessFilter === "needs_research" && isComplete) return false;
      }
      return true;
    });
  }, [investors, tierFilter, segmentFilter, completenessFilter]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + A: Select all visible
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        const allIds = new Set(filtered.map((inv) => inv.id));
        setBulkSelectedIds(allIds);
        onBulkSelect?.(Array.from(allIds));
      }
      // Escape: Clear selection
      if (e.key === "Escape") {
        setBulkSelectedIds(new Set());
        onBulkSelect?.([]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtered, onBulkSelect]);

  // Notify parent of bulk selection changes
  useEffect(() => {
    onBulkSelect?.(Array.from(bulkSelectedIds));
  }, [bulkSelectedIds, onBulkSelect]);

  // Early return AFTER all hooks
  if (!investors || investors.length === 0) {
    return (
      <div className="border border-dashed border-gray-300 rounded-2xl px-4 py-6 text-sm text-gray-500">
        Investor universe is currently empty. Once the universe engine has been
        run, this view will show ranked investors with tiers and segments.
      </div>
    );
  }

  return (
    <div className="border-2 border-black rounded-2xl overflow-hidden bg-white flex flex-col">
      <div className="border-b-2 border-black bg-gray-50 px-4 py-2 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-800">
            Investor Universe
          </h2>
          <span className="text-[11px] text-gray-600">
            {filtered.length} of {investors.length} investors
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <select
            className="border border-gray-300 rounded-full px-2 py-1 bg-white"
            value={tierFilter}
            onChange={(e) =>
              setTierFilter(e.target.value as "" | "A+" | "A" | "B" | "C")
            }
          >
            <option value="">All tiers</option>
            <option value="A+">Tier A+</option>
            <option value="A">Tier A</option>
            <option value="B">Tier B</option>
            <option value="C">Tier C</option>
          </select>
          <select
            className="border border-gray-300 rounded-full px-2 py-1 bg-white"
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
          >
            <option value="">All segments</option>
            {segments.map((seg) => (
              <option key={seg} value={seg}>
                {seg}
              </option>
            ))}
          </select>
          <select
            className="border border-gray-300 rounded-full px-2 py-1 bg-white"
            value={completenessFilter}
            onChange={(e) =>
              setCompletenessFilter(
                e.target.value as "" | "complete" | "needs_research",
              )
            }
          >
            <option value="">All data quality</option>
            <option value="complete">Complete profiles</option>
            <option value="needs_research">Needs research</option>
          </select>
        </div>
      </div>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-100 border-b border-black">
            <tr className="text-[11px] text-gray-700">
              <th className="px-3 py-2 text-left w-8">
                <input
                  type="checkbox"
                  checked={
                    filtered.length > 0 &&
                    filtered.every((inv) => bulkSelectedIds.has(inv.id))
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      const allIds = new Set(filtered.map((inv) => inv.id));
                      setBulkSelectedIds(allIds);
                    } else {
                      setBulkSelectedIds(new Set());
                    }
                  }}
                  className="cursor-pointer"
                />
              </th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Segment</th>
              <th className="px-3 py-2 text-left">Country</th>
              <th className="px-3 py-2 text-left">Owner</th>
              <th className="px-3 py-2 text-center">Researched</th>
              <th className="px-3 py-2 text-center">Attack list</th>
              <th className="px-3 py-2 text-right">Tier</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2 text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv, index) => {
              const opp = opportunityByRelationshipName?.[inv.name];
              const state = investorState?.[inv.id];
              const isSelected = selectedId === inv.id;
              const isBulkSelected = bulkSelectedIds.has(inv.id);
              const gaps = inv.researchGaps ?? inv.missingFields ?? [];
              const isComplete = gaps.length === 0;
              return (
                <tr
                  key={`${inv.id}-${index}`}
                  className={`border-b border-gray-200 cursor-pointer ${
                    isSelected
                      ? "bg-black text-white"
                      : isBulkSelected
                      ? "bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={(e) => {
                    // Don't trigger row select if clicking checkbox
                    if ((e.target as HTMLElement).tagName === "INPUT") return;
                    onSelect && onSelect(inv.id);
                  }}
                >
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={isBulkSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        const newSet = new Set(bulkSelectedIds);
                        if (e.target.checked) {
                          newSet.add(inv.id);
                        } else {
                          newSet.delete(inv.id);
                        }
                        setBulkSelectedIds(newSet);
                      }}
                      className="cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span className="font-medium">{inv.name}</span>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {inv.segment ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {inv.country ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {state?.ownerName || opp?.ownerName ? (
                      <span className="font-mono text-[11px]">
                        {state?.ownerName || opp?.ownerName}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[11px]">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold border ${
                        state?.researched
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-gray-100 text-gray-600 border-gray-300"
                      }`}
                      title={
                        state?.researched
                          ? "Operator-marked researched"
                          : "Not marked researched"
                      }
                    >
                      {state?.researched ? "✓" : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold border ${
                        state?.inAttackList
                          ? "bg-red-100 text-red-800 border-red-300"
                          : "bg-gray-100 text-gray-600 border-gray-300"
                      }`}
                      title={
                        state?.inAttackList
                          ? "In today's attack list (operator override)"
                          : "Not in attack list"
                      }
                    >
                      {state?.inAttackList ? "🎯" : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap font-mono">
                    {inv.rankTier}
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap font-mono">
                    {inv.rankScore}
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenOpportunity) {
                          onOpenOpportunity(inv.name);
                        }
                      }}
                      className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-semibold ${
                        isComplete
                          ? "border-black bg-black text-white hover:bg-white hover:text-black"
                          : "border-gray-400 text-gray-700 bg-white hover:bg-gray-100"
                      }`}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

