import React from "react";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import type { IntentStatus, ChallengeLevel, RequestStatus } from "../types/wire";
import { intentStatusLabel, requestStatusLabel } from "../utils/statusLabels";

// Risk Score Badge
export function RiskScoreBadge({ score }: { score: number }) {
  const color =
    score <= 30
      ? "success"
      : score <= 60
        ? "warning"
        : score <= 80
          ? "danger"
          : "danger";
  return <Badge tone={color}>{score}</Badge>;
}

// Status Badge
export function IntentStatusBadge({ status }: { status: IntentStatus }) {
  const toneMap: Record<IntentStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
    DRAFT: "neutral",
    PENDING_PROOF: "warning",
    CHALLENGING: "warning",
    PENDING_APPROVALS: "warning",
    APPROVED: "success",
    DENIED: "danger",
    EXECUTED: "info",
    EXPIRED: "neutral",
    CANCELED: "neutral",
  };
  return <Badge tone={toneMap[status]}>{intentStatusLabel(status)}</Badge>;
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const toneMap: Record<RequestStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
    DRAFT: "neutral",
    PENDING_VERIFICATION: "warning",
    PENDING_APPROVAL: "warning",
    APPROVED: "success",
    DENIED: "danger",
    PAID: "info",
    EXPIRED: "neutral",
  };
  return <Badge tone={toneMap[status]}>{requestStatusLabel(status)}</Badge>;
}

// Challenge Level Badge
export function ChallengeLevelBadge({ level }: { level: ChallengeLevel }) {
  const colorMap: Record<ChallengeLevel, "success" | "warning" | "danger"> = {
    L1: "success",
    L2: "warning",
    L3: "danger",
  };
  return <Badge tone={colorMap[level]}>{level}</Badge>;
}

// Cooldown Timer Component
export function WireCooldownTimer({
  expiresAt,
  label = "Expires in",
}: {
  expiresAt: string;
  label?: string;
}) {
  const [timeLeft, setTimeLeft] = React.useState<string>("");
  const [isExpired, setIsExpired] = React.useState(false);

  React.useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft("00:00");
        setIsExpired(true);
        return;
      }

      setIsExpired(false);
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 ${
      isExpired ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"
    }`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <span className={`text-xs font-mono font-bold ${isExpired ? "text-red-600" : "text-gray-900"}`}>
        {isExpired ? "Expired" : timeLeft}
      </span>
    </div>
  );
}

// Permission Strip Component
export function WirePermissionStrip({
  requiredPermission,
  currentUserRole,
  reason,
}: {
  requiredPermission: string;
  currentUserRole: string;
  reason?: string;
}) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
      <strong>Disabled:</strong> {reason || `Requires ${requiredPermission}`}
    </div>
  );
}

// Service Health Indicator
export function ServiceHealthIndicator({
  status,
  label,
}: {
  status: "healthy" | "degraded" | "down";
  label: string;
}) {
  const emoji = status === "healthy" ? "🟢" : status === "degraded" ? "🟡" : "🔴";
  const color =
    status === "healthy"
      ? "text-emerald-700"
      : status === "degraded"
        ? "text-amber-700"
        : "text-red-700";

  return (
    <span className={`inline-flex items-center gap-1 ${color}`}>
      <span>{emoji}</span>
      <span>{label}</span>
    </span>
  );
}
