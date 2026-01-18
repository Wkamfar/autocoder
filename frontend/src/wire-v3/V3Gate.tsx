import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../wire/contexts/AuthContext";

function isV3EnabledForOrg(orgId?: string | null) {
  const enabled = import.meta.env.VITE_WIRE_V3_ENABLED === "true";
  if (!enabled) return false;
  const allowlist = (import.meta.env.VITE_WIRE_V3_ORG_IDS || "")
    .split(",")
    .map((id: string) => id.trim())
    .filter(Boolean);
  if (allowlist.length === 0) return true;
  return orgId ? allowlist.includes(orgId) : false;
}

export function V3Gate({ children }: { children: React.ReactNode }) {
  const { organization, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-8 text-gray-600">Loading…</div>;
  }

  if (!isV3EnabledForOrg(organization?.id)) {
    return <Navigate to="/v2/" replace />;
  }

  return <>{children}</>;
}
