import { useState, useMemo } from "react";
import type { EnrichedInvestorRow } from "./InvestorUniverseDetailPanel";

interface InvestorUniverseSearchProps {
  investors: EnrichedInvestorRow[];
  onSelect: (id: string) => void;
}

export function InvestorUniverseSearch({
  investors,
  onSelect,
}: InvestorUniverseSearchProps) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    
    const q = query.toLowerCase();
    return investors
      .filter((inv) => {
        const nameMatch = inv.name.toLowerCase().includes(q);
        const segmentMatch = inv.segment?.toLowerCase().includes(q);
        const countryMatch = inv.country?.toLowerCase().includes(q);
        const thesisMatch = inv.thesisBullets?.some((t) =>
          t.toLowerCase().includes(q),
        );
        const tagsMatch = inv.tags?.some((t) => t.toLowerCase().includes(q));
        const categoriesMatch = inv.categories?.some((c) =>
          c.toLowerCase().includes(q),
        );
        const briefMatch =
          inv.founderBrief?.whyTheyMatter.toLowerCase().includes(q) ||
          inv.founderBrief?.howToWinThem.toLowerCase().includes(q);

        return (
          nameMatch ||
          segmentMatch ||
          countryMatch ||
          thesisMatch ||
          tagsMatch ||
          categoriesMatch ||
          briefMatch
        );
      })
      .slice(0, 10);
  }, [investors, query]);

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search investors by name, segment, thesis, or keywords..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        onBlur={() => setTimeout(() => setShowResults(false), 200)}
        className="w-full border-2 border-black rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      {showResults && query && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 border-2 border-black rounded-xl bg-white shadow-xl max-h-96 overflow-auto">
          {filtered.map((inv) => (
            <button
              key={inv.id}
              type="button"
              onClick={() => {
                onSelect(inv.id);
                setQuery("");
                setShowResults(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b border-gray-200 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">{inv.name}</div>
                  <div className="text-xs text-gray-600">
                    {inv.segment} · {inv.rankTier} · Score: {inv.rankScore}
                  </div>
                </div>
                <div className="text-xs font-mono text-gray-400">
                  {inv.poseFitScore || 0}/100
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {showResults && query && filtered.length === 0 && (
        <div className="absolute z-50 w-full mt-1 border-2 border-black rounded-xl bg-white shadow-xl px-4 py-3 text-sm text-gray-500">
          No investors found matching "{query}"
        </div>
      )}
    </div>
  );
}
