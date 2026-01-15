import React from "react";
import type { Permission, UserRole } from "../types/wire";

interface WirePermissionStripProps {
  requiredPermission: Permission;
  currentUserRole: UserRole;
  reason?: string;
}

export function WirePermissionStrip({
  requiredPermission,
  currentUserRole,
  reason,
}: WirePermissionStripProps) {
  const getPermissionText = () => {
    if (reason) return reason;
    if (requiredPermission.includes("ADMIN")) return "Requires ADMIN";
    if (requiredPermission.includes("2nd approver")) return "Requires 2nd approver (maker–checker)";
    return `Requires ${requiredPermission}`;
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
      <strong>Disabled:</strong> {getPermissionText()}
    </div>
  );
}
