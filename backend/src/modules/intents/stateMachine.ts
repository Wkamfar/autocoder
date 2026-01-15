/**
 * Agent D: Formal State Machine for Intent Status Transitions
 * 
 * Defines allowed state transitions and validates them before applying.
 * This ensures correctness and prevents invalid state changes.
 */

import { IntentStatus } from "@prisma/client";

/**
 * Allowed state transitions map: from -> to[]
 */
const ALLOWED_TRANSITIONS: Record<IntentStatus, IntentStatus[]> = {
  DRAFT: ["PENDING_PROOF", "CHALLENGING", "CANCELED"],
  PENDING_PROOF: ["CHALLENGING", "CANCELED"],
  CHALLENGING: ["PENDING_APPROVALS", "DENIED", "CANCELED"],
  PENDING_APPROVALS: ["APPROVED", "DENIED", "CHALLENGING", "CANCELED"], // CHALLENGING for STEP_UP
  APPROVED: ["EXECUTED", "EXPIRED", "CANCELED"],
  DENIED: ["CANCELED"], // Terminal state, but can be canceled
  EXECUTED: [], // Terminal state
  EXPIRED: [], // Terminal state
  CANCELED: [], // Terminal state
};

/**
 * Terminal states that cannot transition to any other state
 */
const TERMINAL_STATES: Set<IntentStatus> = new Set([
  "EXECUTED",
  "EXPIRED",
  "CANCELED",
]);

/**
 * Check if a state transition is allowed
 */
export function isTransitionAllowed(
  from: IntentStatus,
  to: IntentStatus
): boolean {
  // Same state is always allowed (idempotent)
  if (from === to) return true;

  // Terminal states cannot transition
  if (TERMINAL_STATES.has(from)) return false;

  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Validate a state transition and throw if invalid
 */
export function validateTransition(
  from: IntentStatus,
  to: IntentStatus,
  context?: string
): void {
  if (!isTransitionAllowed(from, to)) {
    throw new Error(
      `Invalid state transition: ${from} -> ${to}${context ? ` (${context})` : ""}`
    );
  }
}

/**
 * Get all allowed next states from a given state
 */
export function getAllowedNextStates(from: IntentStatus): IntentStatus[] {
  if (TERMINAL_STATES.has(from)) return [];
  return ALLOWED_TRANSITIONS[from] || [];
}

/**
 * Check if a state is terminal
 */
export function isTerminalState(status: IntentStatus): boolean {
  return TERMINAL_STATES.has(status);
}
