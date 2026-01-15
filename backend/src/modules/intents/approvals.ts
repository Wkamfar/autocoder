/**
 * Agent D: Approval Management
 * 
 * Enforces distinct approver constraint: 1 approval per user per intent+bindingHash.
 * Handles approval invalidation on binding hash changes.
 */

import { prisma } from "../../db/prisma.js";
import { DecisionType } from "@prisma/client";

/**
 * Create an approval record, enforcing distinct approver constraint
 */
export async function createApproval(params: {
  intentId: string;
  orgId: string;
  approverUserId: string;
  bindingHash: string;
  decisionType: DecisionType;
  decisionId?: string;
}): Promise<{ approval: any; isDuplicate: boolean }> {
  // Check for existing active approval for this user+intent+bindingHash
  const existing = await prisma.approval.findFirst({
    where: {
      intentId: params.intentId,
      approverUserId: params.approverUserId,
      bindingHash: params.bindingHash,
      invalidatedAt: null,
    },
  });

  if (existing) {
    return { approval: existing, isDuplicate: true };
  }

  // Create new approval
  const approval = await prisma.approval.create({
    data: {
      id: `approval_${params.intentId}_${params.approverUserId}_${Date.now()}`,
      intentId: params.intentId,
      orgId: params.orgId,
      approverUserId: params.approverUserId,
      bindingHash: params.bindingHash,
      decisionType: params.decisionType,
      decisionId: params.decisionId ?? null,
    },
  });

  return { approval, isDuplicate: false };
}

/**
 * Invalidate all approvals for an intent when binding hash changes
 */
export async function invalidateApprovalsForBindingChange(
  intentId: string,
  oldBindingHash: string
): Promise<number> {
  const result = await prisma.approval.updateMany({
    where: {
      intentId,
      bindingHash: oldBindingHash,
      invalidatedAt: null,
    },
    data: {
      invalidatedAt: new Date(),
    },
  });

  return result.count;
}

/**
 * Count distinct active approvals for an intent+bindingHash
 */
export async function countDistinctApprovals(
  intentId: string,
  bindingHash: string
): Promise<number> {
  const approvals = await prisma.approval.findMany({
    where: {
      intentId,
      bindingHash,
      invalidatedAt: null,
      decisionType: "APPROVE",
    },
    select: {
      approverUserId: true,
    },
    distinct: ["approverUserId"],
  });

  return approvals.length;
}

/**
 * Get all active approvals for an intent+bindingHash
 */
export async function getActiveApprovals(
  intentId: string,
  bindingHash: string
): Promise<any[]> {
  return await prisma.approval.findMany({
    where: {
      intentId,
      bindingHash,
      invalidatedAt: null,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

/**
 * Check if a user has already approved an intent for a given bindingHash
 */
export async function hasUserApproved(
  intentId: string,
  userId: string,
  bindingHash: string
): Promise<boolean> {
  const approval = await prisma.approval.findFirst({
    where: {
      intentId,
      approverUserId: userId,
      bindingHash,
      invalidatedAt: null,
      decisionType: "APPROVE",
    },
  });

  return approval !== null;
}
