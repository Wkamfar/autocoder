/**
 * Agent D: Execution Ledger
 * 
 * Immutable ledger of all execution attempts for reconciliation and audit.
 * Each execution is recorded atomically and cannot be modified.
 */

import { prisma } from "../../db/prisma.js";
import { ExecutionStatus } from "@prisma/client";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";

/**
 * Create a new execution ledger entry
 */
export async function createExecutionLedgerEntry(params: {
  intentId: string;
  orgId: string;
  approvalTokenHash: string;
  bindingHash: string;
  executedByUserId: string;
  state?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ executionRef: string; ledgerEntry: any }> {
  const executionRef = `exec_${params.intentId}_${Date.now()}`;
  const now = new Date();

  const ledgerEntry = await prisma.executionLedger.create({
    data: {
      id: `ledger_${executionRef}`,
      intentId: params.intentId,
      orgId: params.orgId,
      executionRef,
      status: "PENDING",
      state: params.state ?? "created",
      provider: params.provider ?? null,
      approvalTokenHash: params.approvalTokenHash,
      bindingHash: params.bindingHash,
      executedByUserId: params.executedByUserId,
      executedAt: now,
      reconciliationStatus: "pending",
      metadataJson: params.metadata
        ? canonicalJsonStringify(params.metadata)
        : null,
    },
  });

  return { executionRef, ledgerEntry };
}

/**
 * Update execution status (for reconciliation)
 */
export async function updateExecutionStatus(
  executionRef: string,
  status: ExecutionStatus,
  externalRef?: string,
  externalStatus?: string,
  errorMessage?: string
): Promise<void> {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };

  if (externalRef) updateData.externalRef = externalRef;
  if (externalStatus) updateData.externalStatus = externalStatus;
  if (errorMessage) updateData.errorMessage = errorMessage;

  await prisma.executionLedger.update({
    where: { executionRef },
    data: updateData,
  });
}

/**
 * Mark execution as reconciled
 */
export async function reconcileExecution(
  executionRef: string,
  reconciliationStatus: "matched" | "mismatch" | "reconciled"
): Promise<void> {
  await prisma.executionLedger.update({
    where: { executionRef },
    data: {
      reconciliationStatus,
      reconciliationAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

/**
 * Increment retry count for an execution
 */
export async function incrementExecutionRetry(executionRef: string): Promise<void> {
  await prisma.executionLedger.update({
    where: { executionRef },
    data: {
      retryCount: { increment: 1 },
      updatedAt: new Date(),
    },
  });
}

/**
 * Get execution ledger entry by executionRef
 */
export async function getExecutionLedgerEntry(executionRef: string): Promise<any | null> {
  return await prisma.executionLedger.findUnique({
    where: { executionRef },
  });
}

/**
 * Get all execution ledger entries for an intent
 */
export async function getExecutionLedgerEntries(intentId: string, orgId: string): Promise<any[]> {
  return await prisma.executionLedger.findMany({
    where: { intentId, orgId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Check if an intent has already been executed (idempotency check)
 */
export async function hasIntentBeenExecuted(
  intentId: string,
  orgId: string,
  bindingHash: string
): Promise<{ executed: boolean; executionRef?: string }> {
  const entry = await prisma.executionLedger.findFirst({
    where: {
      intentId,
      orgId,
      bindingHash,
      status: {
        in: ["CONFIRMED", "RECONCILED"],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (entry) {
    return { executed: true, executionRef: entry.executionRef };
  }

  return { executed: false };
}
