/**
 * Agent D: Transaction Support for Atomic Operations
 * 
 * Provides transaction helpers for complex multi-step operations
 * that must be atomic (e.g., approval + status update + event).
 */

import { prisma } from "../../db/prisma.js";
import { Prisma } from "@prisma/client";

/**
 * Execute multiple operations atomically within a transaction
 */
export async function executeInTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(callback, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5000, // 5 seconds max wait for transaction
    timeout: 10000, // 10 seconds max execution time
  });
}

/**
 * Execute with retry on transaction conflict
 */
export async function executeWithRetry<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await executeInTransaction(callback);
    } catch (error: any) {
      // Retry on serialization failure or deadlock
      if (
        error?.code === "P2034" || // Transaction conflict
        error?.code === "P1008" || // Operations timed out
        error?.message?.includes("deadlock") ||
        error?.message?.includes("serialization")
      ) {
        lastError = error;
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
        continue;
      }
      throw error;
    }
  }
  
  throw lastError || new Error("Transaction failed after retries");
}
