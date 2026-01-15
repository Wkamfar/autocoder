import crypto from "crypto";
import { prisma } from "../db/prisma.js";
import { logger } from "../lib/observability.js";
import type { JobStatus } from "@prisma/client";

export type EnqueueJobParams = {
  type: string;
  payload: unknown;
  runAt?: Date;
  maxAttempts?: number;
  uniqueKey?: string | null;
};

export type ClaimedJobRow = {
  id: string;
  type: string;
  payloadJson: string;
  status: JobStatus;
  runAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  uniqueKey: string | null;
};

export function newJobId(prefix = "job"): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

export async function enqueueJob(params: EnqueueJobParams): Promise<{ id: string }> {
  const id = newJobId();
  const runAt = params.runAt ?? new Date();
  const maxAttempts = params.maxAttempts ?? 10;
  const uniqueKey = params.uniqueKey ?? null;

  try {
    await prisma.job.create({
      data: {
        id,
        type: params.type,
        payloadJson: JSON.stringify(params.payload ?? {}),
        status: "QUEUED",
        runAt,
        attempts: 0,
        maxAttempts,
        uniqueKey,
        createdAt: new Date(),
      },
    });
    return { id };
  } catch (error: any) {
    // If (type, uniqueKey) already exists, treat enqueue as idempotent.
    if (error?.code === "P2002") {
      logger.warn("enqueueJob deduped by unique constraint", { type: params.type, uniqueKey });
      return { id: "deduped" };
    }
    throw error;
  }
}

export async function claimDueJobs(params: {
  limit: number;
  workerId: string;
}): Promise<ClaimedJobRow[]> {
  const { limit, workerId } = params;
  const now = new Date();

  // Atomic claim using UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING *
  const rows = await prisma.$queryRaw<ClaimedJobRow[]>`
    UPDATE "Job"
    SET
      "status" = 'RUNNING',
      "lockedAt" = ${now}::timestamptz,
      "lockedBy" = ${workerId},
      "attempts" = "attempts" + 1,
      "updatedAt" = ${now}::timestamptz
    WHERE "id" IN (
      SELECT "id"
      FROM "Job"
      WHERE "status" = 'QUEUED'
        AND "runAt" <= ${now}::timestamptz
      ORDER BY "runAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
  `;

  return rows;
}

export async function markJobSucceeded(jobId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "SUCCEEDED",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    },
  });
}

export async function rescheduleJob(params: {
  jobId: string;
  runAt: Date;
  lastError?: string;
}): Promise<void> {
  await prisma.job.update({
    where: { id: params.jobId },
    data: {
      status: "QUEUED",
      runAt: params.runAt,
      lastError: params.lastError,
      lockedAt: null,
      lockedBy: null,
    },
  });
}

export async function markJobDead(params: { jobId: string; lastError?: string }): Promise<void> {
  await prisma.job.update({
    where: { id: params.jobId },
    data: {
      status: "DEAD",
      lastError: params.lastError,
      lockedAt: null,
      lockedBy: null,
      completedAt: new Date(),
    },
  });
}

export async function reapStuckJobs(params: {
  visibilityTimeoutMs: number;
  limit?: number;
}): Promise<number> {
  const limit = params.limit ?? 200;
  const cutoff = new Date(Date.now() - params.visibilityTimeoutMs);

  const res = await prisma.job.updateMany({
    where: {
      status: "RUNNING",
      lockedAt: { lt: cutoff },
    },
    data: {
      status: "QUEUED",
      runAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: "reaped: visibility timeout exceeded",
    },
  });

  // Avoid surprise mass requeues; keep it bounded.
  return Math.min(res.count, limit);
}

export function computeBackoffMs(attempt: number): number {
  // attempt is 1-based (after claim). Exponential backoff with jitter.
  const baseMs = Math.min(60_000, Math.pow(2, Math.max(0, attempt - 1)) * 1_000); // 1s,2s,4s... capped 60s
  const jitter = Math.floor(Math.random() * 250);
  return baseMs + jitter;
}

