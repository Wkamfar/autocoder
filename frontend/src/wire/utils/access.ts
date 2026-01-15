import type { OrgUser, Permission } from "../types/wire";

export type Gate = { allowed: true } | { allowed: false; reason: string };

export function hasPermission(user: OrgUser | null | undefined, permission: Permission): boolean {
  const perms = user?.permissions ?? [];
  return perms.includes(permission);
}

export function gateIfSignedOut(user: OrgUser | null | undefined, reason = "Sign in to continue."): Gate {
  if (!user) return { allowed: false, reason };
  return { allowed: true };
}

export function gateIfMissingPermission(
  user: OrgUser | null | undefined,
  permission: Permission,
  reason?: string
): Gate {
  if (!user) return { allowed: false, reason: "Sign in to continue." };
  if (!hasPermission(user, permission)) {
    return {
      allowed: false,
      reason: reason ?? `You don’t have permission (${permission}).`,
    };
  }
  return { allowed: true };
}

export function gateIf(condition: boolean, reason: string): Gate {
  return condition ? { allowed: false, reason } : { allowed: true };
}

