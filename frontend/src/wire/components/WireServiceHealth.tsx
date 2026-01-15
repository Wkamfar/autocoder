import React from "react";
import type { ServiceHealth } from "../types/wire";
import { ServiceHealthIndicator } from "../ui/WireDesignSystem";

interface WireServiceHealthProps {
  health: ServiceHealth;
}

export function WireServiceHealth({ health }: WireServiceHealthProps) {
  const hasIssues =
    health.voiceService !== "healthy" ||
    health.phoneService !== "healthy" ||
    health.storageService !== "healthy";

  if (!hasIssues) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl px-4 py-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
            <span className="font-semibold text-amber-900 uppercase tracking-wide">Service Status</span>
            <ServiceHealthIndicator status={health.voiceService} label="Voice" />
            <ServiceHealthIndicator status={health.phoneService} label="Phone" />
            <ServiceHealthIndicator status={health.storageService} label="Storage" />
          </div>
        </div>
      </div>
    </div>
  );
}
