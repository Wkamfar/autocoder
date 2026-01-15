import { useState } from "react";
import type { EnrichedInvestorRow } from "./InvestorUniverseDetailPanel";

interface InvestorUniverseQuickActionsProps {
  selectedInvestors: EnrichedInvestorRow[];
  onBulkAction: (action: string, investorIds: string[]) => void;
}

function exportToCSV(investors: EnrichedInvestorRow[]): void {
  const headers = [
    "Name",
    "Tier",
    "Score",
    "Fit Score",
    "Segment",
    "Country",
    "Website",
    "Thesis",
    "Flagship Deals",
    "Strategic Contacts",
    "Submission Path",
    "Owner",
  ];

  const rows = investors.map((inv) => [
    inv.name,
    inv.rankTier,
    inv.rankScore?.toString() || "",
    inv.poseFitScore?.toString() || "",
    inv.segment || "",
    inv.country || "",
    inv.website || "",
    inv.thesisBullets?.join("; ") || "",
    inv.flagshipDeals?.map((d) => d.project).join("; ") || "",
    inv.strategicContacts?.map((c) => c.name).join("; ") || "",
    inv.submissionPaths?.map((p) => p.value).join("; ") || "",
    inv.owners?.map((o) => `${o.name} (${o.role})`).join("; ") || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `investor-universe-export-${new Date().toISOString().split("T")[0]}.csv`,
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function InvestorUniverseQuickActions({
  selectedInvestors,
  onBulkAction,
}: InvestorUniverseQuickActionsProps) {
  const [showMenu, setShowMenu] = useState(false);

  if (selectedInvestors.length === 0) {
    return null;
  }

  const actions = [
    {
      id: "assign-owner",
      label: `Assign owner (${selectedInvestors.length})`,
      icon: "👤",
    },
    {
      id: "create-opportunities",
      label: `Create opportunities (${selectedInvestors.length})`,
      icon: "💼",
    },
    {
      id: "export-csv",
      label: `Export to CSV (${selectedInvestors.length})`,
      icon: "📊",
      onClick: () => exportToCSV(selectedInvestors),
    },
    {
      id: "add-to-attack-list",
      label: `Add to attack list (${selectedInvestors.length})`,
      icon: "🎯",
    },
    {
      id: "mark-researched",
      label: `Mark as researched (${selectedInvestors.length})`,
      icon: "✅",
    },
    {
      id: "remove-from-attack-list",
      label: `Remove from attack list (${selectedInvestors.length})`,
      icon: "🚫",
    },
    {
      id: "unmark-researched",
      label: `Unmark researched (${selectedInvestors.length})`,
      icon: "↩️",
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-black text-white rounded-2xl shadow-2xl border-2 border-white">
        <div className="px-4 py-3 border-b border-white/20">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold">
              {selectedInvestors.length} selected
            </span>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="text-xs uppercase tracking-wide hover:underline"
            >
              {showMenu ? "Hide" : "Actions"}
            </button>
          </div>
        </div>
        {showMenu && (
          <div className="px-2 py-2 space-y-1">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  if (action.onClick) {
                    action.onClick();
                  } else {
                    onBulkAction(
                      action.id,
                      selectedInvestors.map((inv) => inv.id),
                    );
                  }
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-sm flex items-center gap-2"
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
