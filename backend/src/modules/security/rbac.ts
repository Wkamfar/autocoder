/**
 * Agent B: Enhanced RBAC (Role-Based Access Control)
 * 
 * Centralized permission definitions and role-to-permission mapping
 */

import type { AuthedUser } from "./auth.js";

export type Permission =
  | "intent:create"
  | "intent:read"
  | "intent:update"
  | "intent:approve"
  | "intent:deny"
  | "intent:execute"
  | "intent:view_events"
  | "intent:view_bundle"
  | "beneficiary:create"
  | "beneficiary:read"
  | "beneficiary:update"
  | "beneficiary:lock"
  | "policy:read"
  | "policy:create"
  | "policy:simulate"
  | "audit:read"
  | "user:manage"
  | "session:revoke";

/**
 * Role-to-permission mapping
 * This is the source of truth for RBAC
 */
const ROLE_PERMISSIONS: Record<AuthedUser["role"], Permission[]> = {
  ADMIN: [
    "intent:create",
    "intent:read",
    "intent:update",
    "intent:approve",
    "intent:deny",
    "intent:execute",
    "intent:view_events",
    "intent:view_bundle",
    "beneficiary:create",
    "beneficiary:read",
    "beneficiary:update",
    "beneficiary:lock",
    "policy:read",
    "policy:create",
    "policy:simulate",
    "audit:read",
    "user:manage",
    "session:revoke",
  ],
  TREASURY_INITIATOR: [
    "intent:create",
    "intent:read",
    "intent:update",
    "beneficiary:create",
    "beneficiary:read",
    "beneficiary:update",
    "policy:read",
    "policy:simulate",
  ],
  APPROVER: [
    "intent:read",
    "intent:approve",
    "intent:deny",
    "intent:view_events",
    "beneficiary:read",
    "policy:read",
  ],
  AUDITOR: [
    "intent:read",
    "intent:view_events",
    "intent:view_bundle",
    "beneficiary:read",
    "policy:read",
    "audit:read",
  ],
  READ_ONLY: [
    "intent:read",
    "beneficiary:read",
    "policy:read",
  ],
  EXECUTOR: [
    "intent:read",
    "intent:execute",
    "beneficiary:read",
    "intent:view_events",
  ],
  VIEWER: [
    "intent:read",
    "beneficiary:read",
    "policy:read",
  ],
};

/**
 * Get permissions for a role
 */
export function getPermissionsForRole(role: AuthedUser["role"]): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: AuthedUser["role"], permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Validate that user permissions match their role
 * This can be called during user provisioning/updates
 */
export function validateUserPermissions(user: {
  role: AuthedUser["role"];
  permissions: string[];
}): { valid: boolean; missing: Permission[]; extra: string[] } {
  const expectedPermissions = getPermissionsForRole(user.role);
  const actualPermissions = new Set(user.permissions);
  
  const missing = expectedPermissions.filter((p) => !actualPermissions.has(p));
  const extra = user.permissions.filter(
    (p) => !expectedPermissions.includes(p as Permission)
  );
  
  return {
    valid: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  };
}
