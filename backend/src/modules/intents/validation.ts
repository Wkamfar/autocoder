/**
 * Agent D: Validation Helpers
 * 
 * Comprehensive validation for intent operations
 */

import { IntentStatus } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { isTerminalState } from "./stateMachine.js";

/**
 * Validate intent exists and belongs to org
 */
export async function validateIntentAccess(
  orgId: string,
  intentId: string
): Promise<{ valid: boolean; intent?: any; error?: string }> {
  // Agent 4: tenant guardrail — do not leak existence across orgs.
  const intent = await prisma.intent.findFirst({
    where: { id: intentId, orgId },
  });
  if (!intent) return { valid: false, error: "Intent not found" };
  return { valid: true, intent };
}

/**
 * Validate intent is not in terminal state
 */
export function validateNotTerminal(
  status: IntentStatus,
  operation: string
): void {
  if (isTerminalState(status)) {
    throw new Error(
      `Cannot ${operation} intent in terminal state: ${status}`
    );
  }
}

/**
 * Validate user has permission to approve
 */
export async function validateApproverPermission(
  orgId: string,
  userId: string,
  intentId: string
): Promise<{ valid: boolean; error?: string }> {
  const intent = await prisma.intent.findFirst({
    where: { id: intentId, orgId },
  });

  if (!intent) {
    return { valid: false, error: "Intent not found" };
  }

  // Check if user is the creator (maker-checker rule)
  if (intent.createdByUserId === userId) {
    return {
      valid: false,
      error: "Maker-checker: initiator cannot approve their own intent",
    };
  }

  // Additional checks could go here (role-based, department-based, etc.)

  return { valid: true };
}

/**
 * Validate binding hash hasn't changed since approval
 */
export async function validateBindingHash(
  orgId: string,
  intentId: string,
  expectedBindingHash: string
): Promise<{ valid: boolean; error?: string }> {
  const intent = await prisma.intent.findFirst({
    where: { id: intentId, orgId },
    select: { bindingHash: true },
  });

  if (!intent) {
    return { valid: false, error: "Intent not found" };
  }

  if (intent.bindingHash !== expectedBindingHash) {
    return {
      valid: false,
      error: "Binding hash mismatch - intent was modified after approval",
    };
  }

  return { valid: true };
}

/**
 * Validate approval token is valid and not expired
 */
export async function validateApprovalToken(
  tokenHash: string,
  intentId: string,
  bindingHash: string
): Promise<{ valid: boolean; error?: string }> {
  const token = await prisma.approvalToken.findUnique({
    where: { tokenHash },
  });

  if (!token) {
    return { valid: false, error: "Approval token not found" };
  }

  if (token.intentId !== intentId) {
    return { valid: false, error: "Approval token does not match intent" };
  }

  if (token.bindingHash !== bindingHash) {
    return {
      valid: false,
      error: "Approval token binding hash mismatch",
    };
  }

  if (token.invalidatedAt) {
    return { valid: false, error: "Approval token has been invalidated" };
  }

  if (token.consumedAt) {
    return { valid: false, error: "Approval token has already been consumed" };
  }

  if (token.expiresAt.getTime() <= Date.now()) {
    return { valid: false, error: "Approval token has expired" };
  }

  return { valid: true };
}
