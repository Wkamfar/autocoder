import { useState } from "react";
import type { RankedInvestorRow } from "./InvestorUniverseTable";

export interface EnrichedInvestorRow extends RankedInvestorRow {
  /**
   * Normalized 0–100 fit score + simple commit probabilities
   * from the enrichment script.
   */
  poseFitScore?: number;
  commitProbability30d?: number;
  commitProbability90d?: number;
  reasons?: string[];
  contra?: string[];
  /**
   * Deep research / public‑web enrichment fields. These are populated
   * incrementally by the investor universe engine.
   */
  researchFields?: {
    fieldKey:
      | "fund_size"
      | "check_size"
      | "stage_focus"
      | "geo_focus"
      | "thesis"
      | "token_equity_mix";
    valueJson: any;
    sourceType: string;
    sourceUrls: string[];
    fetchedAt: string;
    dataConfidence: number;
  }[];
  /**
   * Research gaps that remain after "structural completeness" hydration.
   * If present, this should be treated as the canonical research queue
   * indicator instead of `missingFields`.
   */
  researchGaps?: string[];
  thesisBullets?: string[];
  flagshipDeals?: {
    project: string;
    note?: string | null;
  }[];
  submissionPaths?: {
    label: string;
    value: string;
  }[];
  owners?: {
    name: string;
    role: "front" | "backchannel" | "closer" | "other";
  }[];
  strategicContacts?: {
    name: string;
    roleTitle?: string | null;
    channel?: string | null;
    handleOrAddress?: string | null;
    note?: string | null;
  }[];
  founderBrief?: {
    whyTheyMatter: string;
    howToWinThem: string;
    bestFirstMove: string;
    biggestRisks: string;
    goNoGoRule: string;
  };
}

export interface InvestorUniverseOpportunitySummary {
  id: string;
  ownerName: string;
  stage: string;
  status: string;
  expectedValueUsd?: number | null;
  confidence?: number;
}

export interface InvestorUniverseDetailPanelProps {
  investor: EnrichedInvestorRow | null;
  opportunity?: InvestorUniverseOpportunitySummary | null;
}

export function InvestorUniverseDetailPanel({
  investor,
  opportunity,
}: InvestorUniverseDetailPanelProps) {
  if (!investor) {
    return (
      <div className="border border-dashed border-gray-200 rounded-2xl px-4 py-6 text-xs text-gray-500">
        Select an investor in the universe to see deep context, fit, and next
        actions.
      </div>
    );
  }

  const fitScore = investor.poseFitScore ?? investor.rankScore ?? 0;
  const p30 = investor.commitProbability30d ?? undefined;
  const p90 = investor.commitProbability90d ?? undefined;

  const states = [
    "cold",
    "researched",
    "open",
    "in_conversation",
    "in_ic",
    "term_sheet",
    "closed_won",
    "closed_lost",
    "parked",
  ] as const;
  type LocalState = (typeof states)[number];
  const [localState, setLocalState] = useState<LocalState>("cold");

  const researchGaps = investor.researchGaps ?? investor.missingFields ?? [];
  const dataConfidence = investor.dataConfidence ?? investor.poseFitScore ?? 0;
  const isComplete = researchGaps.length === 0;
  const priorityLabel =
    investor.rankTier === "A+" || investor.rankTier === "A"
      ? isComplete
        ? "P1 — immediate"
        : "P1 — research then move"
      : investor.rankTier === "B"
      ? "P2 — strong fit"
      : "P3 — optional";

  return (
    <div className="border-2 border-black rounded-2xl bg-white flex flex-col h-full overflow-hidden">
      <div className="border-b-2 border-black px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold leading-tight">
            {investor.name}
          </h2>
          <p className="text-[11px] text-gray-600">
            {investor.segment ?? "Unclassified"} ·{" "}
            {investor.country ?? "Geo unknown"}
          </p>
          {investor.website && (
            <a
              href={investor.website}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-blue-700 underline"
            >
              {investor.website}
            </a>
          )}
          {investor.owners && investor.owners.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {investor.owners.map((o, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center rounded-full border px-2 py-[1px] text-[10px] font-mono ${
                    o.role === "front"
                      ? "border-black bg-black text-white"
                      : o.role === "backchannel"
                      ? "border-blue-600 bg-blue-50 text-blue-800"
                      : o.role === "closer"
                      ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                      : "border-gray-300 bg-gray-50 text-gray-800"
                  }`}
                >
                  {o.name}
                  <span className="ml-1 text-[9px] uppercase tracking-wide">
                    {o.role === "front"
                      ? "Front"
                      : o.role === "backchannel"
                      ? "Backchannel"
                      : o.role === "closer"
                      ? "Closer"
                      : "Owner"}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 min-w-0 flex-shrink">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center rounded-full border border-black px-3 py-1 text-[10px] font-mono bg-black text-white whitespace-nowrap">
              Tier {investor.rankTier}
            </span>
            <div className="text-right space-y-0.5 flex-shrink-0">
              <div className="text-[11px] text-gray-600">Fit score</div>
              <div className="text-xs font-mono">{fitScore}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end flex-wrap flex-shrink-0">
            <div className="inline-flex items-center rounded-full border px-2 py-[1px] text-[9px] font-mono uppercase tracking-wide bg-black text-white whitespace-nowrap">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
              {priorityLabel}
            </div>
            <div className="inline-flex items-center rounded-full border px-2 py-[1px] text-[9px] font-mono uppercase tracking-wide bg-gray-50 border-gray-300 text-gray-700 whitespace-nowrap">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Data {dataConfidence}/100
            {researchGaps.length > 0 ? (
                <span className="ml-1 text-[9px] text-gray-500">
                · {researchGaps.length} gap
                {researchGaps.length > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="ml-1 text-[9px] text-emerald-700">· complete</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1 justify-end mt-1 w-full max-w-full">
            {states.map((s) => (
              <span
                key={s}
                onClick={() => setLocalState(s)}
                className={`cursor-pointer rounded-full border px-2 py-[1px] text-[9px] font-mono uppercase tracking-wide whitespace-nowrap flex-shrink-0 ${
                  localState === s
                    ? "border-black bg-black text-white"
                    : "border-gray-300 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {s.replace("_", " ")}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-4 text-xs">
        {investor.founderBrief && (
          <section className="border border-black rounded-xl px-3 py-2 bg-gradient-to-br from-[#fafafa] to-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-800">
                🎯 Founder cheat sheet
              </h3>
              <span className="text-[9px] font-mono text-gray-500">
                Strategic intelligence
              </span>
            </div>
            <div className="space-y-2">
              <div className="border-l-2 border-black pl-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 mb-0.5">
                  Why they matter
                </p>
                <p className="text-[11px] text-gray-900 leading-relaxed">
                  {investor.founderBrief.whyTheyMatter}
                </p>
              </div>
              <div className="border-l-2 border-blue-600 pl-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 mb-0.5">
                  How to win them
                </p>
                <p className="text-[11px] text-gray-900 leading-relaxed">
                  {investor.founderBrief.howToWinThem}
                </p>
              </div>
              <div className="border-l-2 border-emerald-600 pl-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 mb-0.5">
                  Best first move
                </p>
                <p className="text-[11px] text-gray-900 leading-relaxed">
                  {investor.founderBrief.bestFirstMove}
                </p>
              </div>
              <div className="border-l-2 border-yellow-600 pl-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-yellow-700 mb-0.5">
                  Risks & watch-outs
                </p>
                <p className="text-[11px] text-gray-900 leading-relaxed">
                  {investor.founderBrief.biggestRisks}
                </p>
              </div>
              <div className="border-l-2 border-red-600 pl-2 bg-red-50 rounded-r px-2 py-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-700 mb-0.5">
                  Go / No-Go rule
                </p>
                <p className="text-[11px] text-gray-900 leading-relaxed font-medium">
                  {investor.founderBrief.goNoGoRule}
                </p>
              </div>
            </div>
          </section>
        )}

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-2">
            Commit probability
          </h3>
          {p30 !== undefined && p90 !== undefined ? (
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-600">30-day</span>
                  <span className="text-[11px] font-mono font-semibold">{p30}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${p30}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-600">90-day</span>
                  <span className="text-[11px] font-mono font-semibold">{p90}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all"
                    style={{ width: `${p90}%` }}
                  />
                </div>
              </div>
              <p className="text-[9px] text-gray-500 mt-1">
                Heuristic from fit score ({fitScore}/100) and tier ({investor.rankTier})
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-gray-500">
              Not yet estimated for this investor.
            </p>
          )}
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-2">
            Mandate snapshot
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Check size
                </p>
                {(() => {
                  const rf = investor.researchFields?.find(
                    (f) => f.fieldKey === "check_size",
                  );
                  if (rf?.sourceUrls && rf.sourceUrls.length > 0) {
                    return (
                      <span className="inline-flex items-center rounded-full px-1 py-0.5 text-[7px] font-mono uppercase tracking-wide bg-emerald-600 text-white">
                        Sourced
                      </span>
                    );
                  }
                  if (rf?.dataConfidence && rf.dataConfidence < 50) {
                    return (
                      <span className="inline-flex items-center rounded-full px-1 py-0.5 text-[7px] font-mono uppercase tracking-wide bg-yellow-600 text-white">
                        Est
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <p className="text-[11px] text-gray-800">
                {investor.checkSizeUsdMin || investor.checkSizeUsdMax
                  ? `${investor.checkSizeUsdMin ? `$${(investor.checkSizeUsdMin / 1_000_000).toFixed(1)}M` : "?"} – ${
                      investor.checkSizeUsdMax
                        ? `$${(investor.checkSizeUsdMax / 1_000_000).toFixed(1)}M`
                        : "?"
                    }`
                  : "Not yet researched"}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Stages & geos
                </p>
                {(() => {
                  const geoRf = investor.researchFields?.find(
                    (f) => f.fieldKey === "geo_focus",
                  );
                  if (geoRf?.sourceUrls && geoRf.sourceUrls.length > 0) {
                    return (
                      <span className="inline-flex items-center rounded-full px-1 py-0.5 text-[7px] font-mono uppercase tracking-wide bg-emerald-600 text-white">
                        Sourced
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <p className="text-[11px] text-gray-800">
                {(investor.stageFocus && investor.stageFocus.length > 0) ||
                (investor.geoFocus && investor.geoFocus.length > 0) ? (
                  <>
                    {investor.stageFocus && investor.stageFocus.length > 0 && (
                      <span>{investor.stageFocus.join(", ")} </span>
                    )}
                    {investor.geoFocus && investor.geoFocus.length > 0 && (
                      <span className="text-gray-500">
                        · {investor.geoFocus.join(", ")}
                      </span>
                    )}
                  </>
                ) : (
                  <>Not yet researched</>
                )}
              </p>
            </div>
          </div>
        </section>

        {opportunity && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-1">
              Mapped fundraising opportunity
            </h3>
            <div className="border border-black rounded-xl px-3 py-2 bg-white flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono">{opportunity.stage}</span>
                <span className="text-[10px] uppercase tracking-wide text-gray-600">
                  {opportunity.status}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-gray-800">
                <span>
                  Owner:{" "}
                  <span className="font-mono">{opportunity.ownerName}</span>
                </span>
                {typeof opportunity.confidence === "number" && (
                  <span className="text-[10px] text-gray-600">
                    {opportunity.confidence}% confidence
                  </span>
                )}
              </div>
              {typeof opportunity.expectedValueUsd === "number" && (
                <p className="text-[10px] text-gray-700">
                  Value:{" "}
                  <span className="font-mono">
                    {opportunity.expectedValueUsd >= 1_000_000
                      ? `$${(opportunity.expectedValueUsd / 1_000_000).toFixed(1)}M`
                      : `$${opportunity.expectedValueUsd.toLocaleString()}`}
                  </span>
                </p>
              )}
              <p className="text-[10px] text-gray-500">
                Stage changes happen in the Pipelines view and are voice‑gated
                for safety.
              </p>
            </div>
          </section>
        )}

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-1">
            Why they might be a fit
          </h3>
          {investor.reasons && investor.reasons.length > 0 ? (
            <ul className="list-disc pl-4 space-y-0.5">
              {investor.reasons.slice(0, 5).map((r, idx) => (
                <li key={idx} className="text-[11px] text-gray-800">
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-gray-500">
              This investor has not yet been fully profiled; fit reasons will
              appear here as intelligence is added.
            </p>
          )}
        </section>

        {investor.contra && investor.contra.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-1">
              Watch‑outs
            </h3>
            <ul className="list-disc pl-4 space-y-0.5">
              {investor.contra.slice(0, 4).map((c, idx) => (
                <li key={idx} className="text-[11px] text-gray-800">
                  {c}
                </li>
              ))}
            </ul>
          </section>
        )}

        {investor.thesisBullets && investor.thesisBullets.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-2">
              Investment thesis
            </h3>
            <div className="space-y-1.5">
              {investor.thesisBullets.map((t, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <span className="text-[10px] font-mono text-gray-400 mt-0.5">
                    {idx + 1}.
                  </span>
                  <p className="text-[11px] text-gray-800 leading-relaxed flex-1">
                    {t}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {investor.flagshipDeals && investor.flagshipDeals.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-2">
              Portfolio signals
            </h3>
            <div className="space-y-2">
              {investor.flagshipDeals.map((d, idx) => (
                <div
                  key={idx}
                  className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold text-gray-900">
                      {d.project}
                    </span>
                    <span className="text-[9px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      Portfolio
                    </span>
                  </div>
                  {d.note && (
                    <p className="text-[10px] text-gray-700 leading-relaxed">
                      {d.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {investor.submissionPaths && investor.submissionPaths.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-1">
              Known submission paths
            </h3>
            <ul className="list-disc pl-4 space-y-0.5">
              {investor.submissionPaths.map((p, idx) => (
                <li key={idx} className="text-[11px] text-gray-800">
                  <span className="font-semibold">{p.label}:</span>{" "}
                  <span className="font-mono">{p.value}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {investor.strategicContacts &&
          investor.strategicContacts.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-2">
                Strategic contacts
              </h3>
              <div className="space-y-2">
                {investor.strategicContacts.map((c, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="text-[11px] font-semibold text-gray-900">
                          {c.name}
                        </p>
                        {c.roleTitle && (
                          <p className="text-[10px] text-gray-600">
                            {c.roleTitle}
                          </p>
                        )}
                      </div>
                      {c.channel && (
                        <span className="text-[9px] font-mono uppercase tracking-wide text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {c.channel}
                        </span>
                      )}
                    </div>
                    {c.handleOrAddress && (
                      <p className="text-[10px] font-mono text-blue-700 break-all">
                        {c.handleOrAddress}
                      </p>
                    )}
                    {c.note && (
                      <p className="text-[10px] text-gray-600 mt-1 italic">
                        {c.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

        {/* Evidence Panel — Show sourced fields with URLs */}
        {investor.researchFields && investor.researchFields.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-2">
              Evidence & Provenance
            </h3>
            <div className="space-y-2">
              {investor.researchFields
                .filter((rf) => rf.sourceUrls && rf.sourceUrls.length > 0)
                .map((rf, idx) => {
                  const hasRealUrls = rf.sourceUrls && rf.sourceUrls.length > 0;
                  const isSourced = hasRealUrls && rf.dataConfidence >= 70;
                  const isEstimated = rf.dataConfidence < 50 || rf.valueJson?.isEstimate;
                  return (
                    <div
                      key={idx}
                      className={`border rounded-lg px-3 py-2 ${
                        isSourced
                          ? "border-emerald-600 bg-emerald-50"
                          : isEstimated
                          ? "border-yellow-600 bg-yellow-50"
                          : "border-gray-300 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-700">
                              {rf.fieldKey.replace(/_/g, " ")}
                            </span>
                            {isSourced && (
                              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wide bg-emerald-600 text-white">
                                Sourced
                              </span>
                            )}
                            {isEstimated && (
                              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wide bg-yellow-600 text-white">
                                Estimated
                              </span>
                            )}
                            {!isSourced && !isEstimated && (
                              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wide bg-gray-500 text-white">
                                Derived
                              </span>
                            )}
                            <span className="text-[9px] font-mono text-gray-500">
                              {rf.dataConfidence}% conf
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-700 mb-1">
                            {rf.fieldKey === "fund_size" &&
                              rf.valueJson?.amountUsd && (
                                <span className="font-semibold">
                                  ${(rf.valueJson.amountUsd / 1_000_000).toFixed(2)}M
                                </span>
                              )}
                            {rf.fieldKey === "check_size" &&
                              (rf.valueJson?.minUsd || rf.valueJson?.maxUsd) && (
                                <span className="font-semibold">
                                  ${rf.valueJson.minUsd ? `$${(rf.valueJson.minUsd / 1_000_000).toFixed(1)}M` : "?"} – ${rf.valueJson.maxUsd ? `$${(rf.valueJson.maxUsd / 1_000_000).toFixed(1)}M` : "?"}
                                </span>
                              )}
                            {rf.fieldKey === "stage_focus" &&
                              rf.valueJson?.stages && (
                                <span className="font-semibold">
                                  {rf.valueJson.stages.join(", ")}
                                </span>
                              )}
                            {rf.fieldKey === "geo_focus" &&
                              rf.valueJson?.geos && (
                                <span className="font-semibold">
                                  {rf.valueJson.geos.join(", ")}
                                </span>
                              )}
                            {rf.fieldKey === "thesis" &&
                              rf.valueJson?.bullets && (
                                <span className="text-gray-600">
                                  {rf.valueJson.bullets.length} thesis points
                                </span>
                              )}
                          </div>
                          {rf.sourceUrls && rf.sourceUrls.length > 0 && (
                            <div className="space-y-0.5 mt-1">
                              <p className="text-[9px] text-gray-600 uppercase tracking-wide">
                                Sources ({rf.sourceUrls.length}):
                              </p>
                              {rf.sourceUrls.slice(0, 3).map((url, urlIdx) => (
                                <a
                                  key={urlIdx}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block text-[9px] font-mono text-blue-700 hover:text-blue-900 underline truncate"
                                  title={url}
                                >
                                  {url.length > 60 ? `${url.slice(0, 57)}...` : url}
                                </a>
                              ))}
                              {rf.sourceUrls.length > 3 && (
                                <p className="text-[8px] text-gray-500">
                                  +{rf.sourceUrls.length - 3} more
                                </p>
                              )}
                            </div>
                          )}
                          {rf.valueJson?.note && (
                            <p className="text-[9px] text-gray-600 italic mt-1">
                              {rf.valueJson.note}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              {investor.researchFields.filter(
                (rf) => rf.sourceUrls && rf.sourceUrls.length > 0,
              ).length === 0 && (
                <p className="text-[10px] text-gray-500 text-center py-2">
                  No sourced evidence yet. Fields are derived from Layer-0 data
                  (focus notes, tags).
                </p>
              )}
            </div>
          </section>
        )}

        {researchGaps.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-1">
              Research queue
            </h3>
            <p className="text-[11px] text-gray-700 mb-1">
              Fields still missing for this investor. When an operator or agent
              fills these in, the fit score and commit odds will automatically
              tighten.
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              {researchGaps.map((field) => (
                <li key={field} className="text-[11px] text-gray-800">
                  <span className="font-mono text-[10px] uppercase tracking-wide">
                    {field}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
