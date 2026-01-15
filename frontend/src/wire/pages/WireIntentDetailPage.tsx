import React, { useCallback, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  useWireIntent,
  useCreateDecision,
  useApprovalStatus,
  useEventLogs,
  useServiceHealth,
} from "../hooks/useWireIntents";
import { WireChallengeModal } from "../components/WireChallengeModal";
import { WirePhoneCallFlow } from "../components/WirePhoneCallFlow";
import { WireConsentModal } from "../components/WireConsentModal";
import { WireApprovalStatus } from "../components/WireApprovalStatus";
import { WireRiskPreview } from "../components/WireRiskPreview";
import { WireExecutionPanel } from "../components/WireExecutionPanel";
import { WireCooldownTimer } from "../ui/WireDesignSystem";
import { IntentStatusBadge, RiskScoreBadge } from "../ui/WireDesignSystem";
import { Badge, SkeletonCard } from "../../crm/ui/CrmDesignSystem";
import { WireLoadingState, WireErrorState } from "../ui/WireEmptyStates";
import { api } from "../api";
import { useAuth } from "../contexts/AuthContext";
import type { VoiceChallenge, VoiceProof } from "../types/wire";
import { gateIf, gateIfMissingPermission } from "../utils/access";
import { WireActionButton } from "../ui/WireActionButton";

export default function WireIntentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: intent, isLoading } = useWireIntent(id || "");
  const { data: approvalStatus } = useApprovalStatus(id || "");
  const { data: eventLogs } = useEventLogs(id || "");
  const { data: health } = useServiceHealth();
  const createDecision = useCreateDecision();
  
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [approvalToken, setApprovalToken] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<VoiceChallenge | null>(null);
  const [pendingDecisionAction, setPendingDecisionAction] = useState<
    "APPROVE" | "DENY" | "STEP_UP"
  >("APPROVE");

  const ensureChallenge = useCallback(async (): Promise<VoiceChallenge | null> => {
    if (!intent) return null;
    // Always generate a fresh challenge (avoids expired cached challenges).
    const next = await api.generateChallenge(intent.id, "EN");
    setChallenge(next || null);
    return next || null;
  }, [intent]);

  const handleProofComplete = async (proof: VoiceProof) => {
    if (!intent) return;

    try {
      const result = await createDecision.mutateAsync({
        intentId: intent.id,
        action: pendingDecisionAction,
        proofId: proof.id,
      });

      if ("approvalToken" in result && result.approvalToken) {
        setApprovalToken(result.approvalToken);
      }

      setShowChallengeModal(false);
      setShowPhoneModal(false);
    } catch (err) {
      console.error("Failed to create decision:", err);
    }
  };

  const startDecision = async (action: "APPROVE" | "DENY" | "STEP_UP") => {
    if (!intent) return;
    try {
      setPendingDecisionAction(action);
      // If voice service is down, offer phone fallback.
      if (health?.voiceService === "down") {
        setShowConsentModal(true);
        return;
      }
      const ch = await ensureChallenge();
      if (!ch) return;
      setShowChallengeModal(true);
    } catch (err) {
      console.error("Failed to start voice decision:", err);
    }
  };

  const handleExecute = async () => {
    if (!intent) {
      throw new Error("Missing intent");
    }

    let token: string | null = approvalToken;
    if (!token) {
      const minted = await api.mintExecutionToken(intent.id);
      token = minted.approvalToken;
      setApprovalToken(token);
    }

    if (!token) {
      throw new Error("Unable to obtain execution token");
    }

    const result = await api.executeIntent(intent.id, token);
    // Keep user on the page; the event log + status will update on refresh.
    return result;
  };

  const formatAmount = (amountMinor: string, currency: string) => {
    const amount = parseFloat(amountMinor) / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!intent) {
    return (
      <WireErrorState
        title="Intent Not Found"
        message="The transfer intent you're looking for doesn't exist or has been removed."
        onRetry={() => navigate("/intents")}
      />
    );
  }

  const approveGate = useMemo(() => {
    const perm = gateIfMissingPermission(user, "intent:approve", "You don’t have approval permission.");
    if (!perm.allowed) return perm;
    const makerChecker = gateIf(user!.id === intent.createdByUserId, "Maker-checker: you can’t approve your own intent.");
    if (!makerChecker.allowed) return makerChecker;
    const terminal = gateIf(
      ["EXECUTED", "DENIED", "CANCELED", "EXPIRED"].includes(intent.status),
      "This intent is no longer approvable."
    );
    if (!terminal.allowed) return terminal;
    const voiceDown = gateIf(health?.voiceService === "down", "Voice service is down. Use phone approval.");
    if (!voiceDown.allowed) return voiceDown;
    return { allowed: true } as const;
  }, [user, intent, health?.voiceService]);

  const denyGate = approveGate; // same gating rules

  const executeGate = useMemo(() => {
    const perm = gateIfMissingPermission(user, "intent:execute", "You don’t have executor permission.");
    if (!perm.allowed) return perm;
    const statusGate = gateIf(intent.status !== "APPROVED", "Execution is available once the intent is APPROVED.");
    if (!statusGate.allowed) return statusGate;
    const cooldownGate = gateIf(
      Boolean(intent.cooldownUntil && new Date(intent.cooldownUntil) > new Date()),
      "Cooling down. Execution is temporarily disabled."
    );
    if (!cooldownGate.allowed) return cooldownGate;
    return { allowed: true } as const;
  }, [user, intent]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Detail Panel */}
      <div className="lg:col-span-2 space-y-6">
        {/* Intent Details Panel */}
        <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
          <header className="border-b border-gray-100 px-4 py-4 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-lg font-bold text-gray-900 truncate">
                    Transfer Intent
                  </h2>
                  <IntentStatusBadge status={intent.status} />
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{intent.railsType}</Badge>
                  <RiskScoreBadge score={intent.riskScore} />
                </div>
              </div>
              <button
                onClick={() => navigate("/intents")}
                className="text-xs text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  Amount
                </div>
                <div className="text-lg font-bold text-gray-900">
                  {formatAmount(intent.amountMinor, intent.currency)}
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  Purpose
                </div>
                <div className="text-sm font-medium text-gray-900 truncate">
                  {intent.purpose}
                </div>
              </div>
            </div>

            {/* Risk Preview */}
            <WireRiskPreview
              riskScore={intent.riskScore}
              riskRationale={intent.riskRationaleJson}
              requiredApprovals={intent.requiredApprovals}
              requiredChallengeLevel={intent.requiredChallengeLevel}
            />

            {/* Approval Status */}
            {approvalStatus && intent.requiredApprovals > 1 && (
              <WireApprovalStatus
                required={approvalStatus.required}
                completed={approvalStatus.completed}
                approvers={approvalStatus.approvers}
                currentUserId={user?.id || ""}
              />
            )}

            {/* Actions */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch gap-3">
                <WireActionButton
                  variant="primary"
                  className="w-full"
                  disabled={!approveGate.allowed}
                  disabledReason={!approveGate.allowed ? approveGate.reason : undefined}
                  onClick={() => void startDecision("APPROVE")}
                >
                  Approve (Voice)
                </WireActionButton>
                <WireActionButton
                  variant="secondary"
                  className="w-full"
                  disabled={!denyGate.allowed}
                  disabledReason={!denyGate.allowed ? denyGate.reason : undefined}
                  onClick={() => void startDecision("DENY")}
                >
                  Deny (Voice)
                </WireActionButton>
              </div>

              {(health?.voiceService === "down" || health?.phoneService !== "down") && (
                <WireActionButton
                  variant="secondary"
                  disabled={!gateIfMissingPermission(user, "intent:approve").allowed || health?.phoneService === "down"}
                  disabledReason={
                    health?.phoneService === "down"
                      ? "Phone service is down."
                      : !gateIfMissingPermission(user, "intent:approve").allowed
                        ? "You don’t have approval permission."
                        : undefined
                  }
                  onClick={() => {
                    setPendingDecisionAction("APPROVE");
                    setShowConsentModal(true);
                  }}
                >
                  Approve via Phone Call
                </WireActionButton>
              )}

              {intent.status === "APPROVED" && executeGate.allowed && (
                <WireExecutionPanel
                  intent={intent}
                  approvalToken={approvalToken}
                  onExecute={handleExecute}
                  onRequestApprovalToken={async () => {
                    if (!intent) return;
                    const minted = await api.mintExecutionToken(intent.id);
                    setApprovalToken(minted.approvalToken);
                  }}
                />
              )}

              {!executeGate.allowed && (
                <div className="text-[11px] text-gray-500">{executeGate.reason}</div>
              )}

              <button
                onClick={() => navigate(`/evidence/${intent.id}`)}
                className="w-full px-4 py-2 border-2 border-black text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                View Evidence
              </button>
            </div>
          </div>
        </div>

        {/* Event Log Panel */}
        {eventLogs && eventLogs.length > 0 && (
          <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
            <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-sm font-bold text-gray-900">Event Log</h2>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {eventLogs.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm border border-gray-200"
                >
                  <div>
                    <span className="font-medium text-gray-900">{event.eventType}</span>
                    <span className="text-gray-600 ml-2 text-xs">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-gray-500">
                    {event.eventHash.slice(0, 8)}...
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar - Empty for now, can add related info */}
      <div className="lg:col-span-1">
        {/* Additional info can go here */}
      </div>

      {/* Modals */}
      {showConsentModal && (
        <WireConsentModal
          onConsent={() => {
            void (async () => {
              setShowConsentModal(false);
              const ch = await ensureChallenge();
              if (ch) setShowPhoneModal(true);
            })();
          }}
          onCancel={() => setShowConsentModal(false)}
        />
      )}

      {showChallengeModal && challenge && (
        <WireChallengeModal
          challenge={challenge}
          intent={intent}
          onComplete={handleProofComplete}
          onError={(err) => console.error(err)}
          onClose={() => setShowChallengeModal(false)}
          onUsePhone={() => {
            setShowChallengeModal(false);
            setShowConsentModal(true);
          }}
        />
      )}

      {showPhoneModal && challenge && (
        <WirePhoneCallFlow
          challenge={challenge}
          intent={intent}
          phoneNumber="+1 (555) 123-4567"
          onComplete={handleProofComplete}
          onError={(err) => console.error(err)}
          onClose={() => setShowPhoneModal(false)}
        />
      )}
    </div>
  );
}
