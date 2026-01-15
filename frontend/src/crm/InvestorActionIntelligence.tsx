import { useMemo } from "react";
import type { EnrichedInvestorRow } from "./InvestorUniverseDetailPanel";

interface InvestorActionIntelligenceProps {
  investor: EnrichedInvestorRow | null;
  opportunity?: {
    id: string;
    ownerName: string;
    stage: string;
    status: string;
    expectedValueUsd?: number | null;
    confidence?: number;
  } | null;
}

interface SmartAction {
  id: string;
  type: "email" | "research" | "meeting" | "follow_up" | "create_opportunity";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  suggestedTemplate?: string;
  deadline?: string;
  owner?: string;
}

export function InvestorActionIntelligence({
  investor,
  opportunity,
}: InvestorActionIntelligenceProps) {
  const smartActions = useMemo<SmartAction[]>(() => {
    if (!investor) return [];

    const actions: SmartAction[] = [];
    const now = new Date();
    const isTopTier = investor.rankTier === "A+" || investor.rankTier === "A";
    const isHighFit = (investor.poseFitScore || 0) > 70;
    const hasOpportunity = !!opportunity;
    const isComplete = !investor.missingFields || investor.missingFields.length === 0;

    // Research actions
    if (!isComplete && investor.missingFields && investor.missingFields.length > 0) {
      actions.push({
        id: "research-missing-fields",
        type: "research",
        priority: isTopTier ? "high" : "medium",
        title: `Research missing fields: ${investor.missingFields.slice(0, 2).join(", ")}`,
        description: `Complete profile by researching ${investor.missingFields.length} missing field${investor.missingFields.length > 1 ? "s" : ""}. This will improve fit score and commit probability.`,
        owner: investor.owners?.[0]?.name || "Unassigned",
      });
    }

    // Create opportunity if doesn't exist
    if (!hasOpportunity && isHighFit && isTopTier) {
      actions.push({
        id: "create-opportunity",
        type: "create_opportunity",
        priority: "high",
        title: "Create fundraising opportunity",
        description: `High-fit top-tier investor—create opportunity in ${investor.rankTier} pipeline. Expected value: $${isTopTier ? "5-10M" : "1-5M"}.`,
        owner: investor.owners?.[0]?.name || "Unassigned",
      });
    }

    // First outreach email
    if (!hasOpportunity && investor.founderBrief?.bestFirstMove) {
      const contactMethod = investor.submissionPaths?.[0]?.value || investor.website || "their website";
      const emailPath = investor.submissionPaths?.find((p) => p.value.includes("@"));
      
      if (emailPath) {
        actions.push({
          id: "first-outreach",
          type: "email",
          priority: isTopTier && isHighFit ? "high" : "medium",
          title: "Send initial outreach email",
          description: investor.founderBrief.bestFirstMove,
          suggestedTemplate: generateEmailTemplate(investor, "initial"),
          owner: investor.owners?.find((o) => o.role === "front")?.name || investor.owners?.[0]?.name || "Unassigned",
          deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        });
      }
    }

    // Follow-up if opportunity exists
    if (hasOpportunity && opportunity) {
      const daysSinceStage = getDaysSinceStageChange(opportunity.stage);
      
      if (opportunity.stage === "fundraising.initial_contact" && daysSinceStage > 3) {
        actions.push({
          id: "follow-up-initial",
          type: "follow_up",
          priority: "high",
          title: "Follow up on initial contact",
          description: `No response after ${daysSinceStage} days. Send follow-up with additional context or alternative angle.`,
          suggestedTemplate: generateEmailTemplate(investor, "follow_up"),
          owner: opportunity.ownerName,
        });
      }

      if (opportunity.stage === "fundraising.pitch_sent" && daysSinceStage > 7) {
        actions.push({
          id: "follow-up-pitch",
          type: "follow_up",
          priority: "high",
          title: "Follow up on pitch deck",
          description: `Pitch sent ${daysSinceStage} days ago. Check in on feedback or request meeting.`,
          owner: opportunity.ownerName,
        });
      }
    }

    // Meeting scheduling
    if (hasOpportunity && opportunity?.stage === "fundraising.in_conversation") {
      actions.push({
        id: "schedule-meeting",
        type: "meeting",
        priority: "high",
        title: "Schedule partner meeting",
        description: "In conversation stage—schedule technical deep-dive with partner. Prepare demo and system architecture overview.",
        owner: opportunity.ownerName,
      });
    }

    // Strategic contact warm intro
    if (investor.strategicContacts && investor.strategicContacts.length > 0 && !hasOpportunity) {
      const hasWarmIntro = investor.introLikelihood && investor.introLikelihood > 0.3;
      if (hasWarmIntro) {
        actions.push({
          id: "warm-intro",
          type: "email",
          priority: "medium",
          title: "Request warm introduction",
          description: `High intro likelihood (${Math.round((investor.introLikelihood || 0) * 100)}%). Reach out to mutual connections for warm intro to ${investor.strategicContacts[0].name}.`,
          owner: investor.owners?.find((o) => o.role === "backchannel")?.name || investor.owners?.[0]?.name || "Unassigned",
        });
      }
    }

    return actions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [investor, opportunity]);

  if (!investor) {
    return (
      <div className="border border-dashed border-gray-200 rounded-2xl px-4 py-6 text-xs text-gray-500">
        Select an investor to see smart action recommendations.
      </div>
    );
  }

  return (
    <div className="border-2 border-black rounded-2xl bg-white flex flex-col h-full">
      <div className="border-b-2 border-black px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-800">
          Smart Actions
        </h2>
        <p className="text-[10px] text-gray-600 mt-1">
          Strategic next steps based on investor profile and current state
        </p>
      </div>
      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {smartActions.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-8">
            No immediate actions required. Investor profile is complete and
            opportunity is progressing normally.
          </div>
        ) : (
          smartActions.map((action) => (
            <div
              key={action.id}
              className={`border rounded-xl px-3 py-2 ${
                action.priority === "high"
                  ? "border-red-600 bg-red-50"
                  : action.priority === "medium"
                  ? "border-yellow-600 bg-yellow-50"
                  : "border-gray-300 bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-[1px] text-[9px] font-mono uppercase tracking-wide ${
                        action.priority === "high"
                          ? "bg-red-600 text-white"
                          : action.priority === "medium"
                          ? "bg-yellow-600 text-white"
                          : "bg-gray-600 text-white"
                      }`}
                    >
                      {action.priority}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-800">
                      {action.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-700">{action.description}</p>
                  {action.owner && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      Owner: <span className="font-mono">{action.owner}</span>
                    </p>
                  )}
                  {action.deadline && (
                    <p className="text-[10px] text-gray-500">
                      Deadline: <span className="font-mono">{action.deadline}</span>
                    </p>
                  )}
                </div>
              </div>
              {action.suggestedTemplate && (
                <details className="mt-2">
                  <summary className="text-[10px] text-gray-600 cursor-pointer hover:text-gray-800">
                    View email template
                  </summary>
                  <div className="mt-2 p-2 bg-white border border-gray-300 rounded text-[10px] font-mono whitespace-pre-wrap">
                    {action.suggestedTemplate}
                  </div>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function generateEmailTemplate(
  investor: EnrichedInvestorRow,
  type: "initial" | "follow_up",
): string {
  const contactName = investor.strategicContacts?.[0]?.name || "Investment team";
  const firmName = investor.name;
  const pitchAngle = investor.founderBrief?.howToWinThem || "POSE is foundational identity infrastructure";

  if (type === "initial") {
    return `Subject: POSE — Identity Infrastructure for AI & Onchain Systems

Hi ${contactName},

I'm reaching out because ${firmName} has backed foundational infrastructure projects that align with what we're building at POSE.

${pitchAngle}

We're building proof-of-personhood infrastructure that enables trustless identity verification for AI and onchain systems—similar to how Worldcoin validated the category exists, but with a different technical approach.

Would you be open to a 30-minute technical deep-dive? I can share our system architecture and show how POSE fits into the infrastructure thesis you've backed before.

Best,
[Your name]`;
  } else {
    return `Subject: Following up — POSE technical overview

Hi ${contactName},

Following up on my previous email about POSE. I wanted to share a bit more context:

${pitchAngle}

Happy to jump on a quick call if you'd like to discuss further, or I can send over our technical documentation.

Best,
[Your name]`;
  }
}

function getDaysSinceStageChange(stage: string): number {
  // Mock implementation - in real system, this would check opportunity history
  return Math.floor(Math.random() * 14) + 1;
}
