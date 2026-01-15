/**
 * Agent 7: Provider event ingestion + dedupe + processing scaffold
 *
 * This implements the "normalized provider event" boundary:
 * - store raw payload (as JSON string)
 * - store normalized envelope
 * - dedupe by stable key
 * - process into execution ledger updates and reconciliation exceptions
 */

import crypto from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";
import { sha256Hex } from "../../lib/sha256.js";
import { enqueueJob } from "../../jobs/jobQueue.js";
import { JOB_TYPES } from "../../jobs/jobTypes.js";
import { appendIntentEvent } from "../evidence/eventChain.js";

export type IngestProviderEventParams = {
  provider: string; // "plaid" | "mock" | ...
  providerEventType: string;
  providerEventId?: string | null;
  orgId?: string | null;
  intentId?: string | null;
  executionRef?: string | null;
  rawPayload: unknown;
  enqueueProcessing?: boolean;
};

function computeProviderEventDedupeKey(params: {
  provider: string;
  providerEventType: string;
  providerEventId?: string | null;
  intentId?: string | null;
  executionRef?: string | null;
  rawPayload: unknown;
}): string {
  // Include providerEventId when present, but also include a hash of the body
  // because not all providers supply a stable event id.
  const bodyHash = sha256Hex(canonicalJsonStringify(params.rawPayload));
  return sha256Hex(
    canonicalJsonStringify({
      provider: params.provider,
      providerEventType: params.providerEventType,
      providerEventId: params.providerEventId ?? null,
      intentId: params.intentId ?? null,
      executionRef: params.executionRef ?? null,
      bodyHash,
    })
  );
}

export async function ingestProviderEvent(params: IngestProviderEventParams): Promise<{
  created: boolean;
  providerEventId: string;
  dedupeKey: string;
}> {
  const dedupeKey = computeProviderEventDedupeKey(params);
  const id = `pevt_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
  const rawPayloadJson = canonicalJsonStringify(params.rawPayload);

  const normalizedPayloadJson = canonicalJsonStringify({
    provider: params.provider,
    type: params.providerEventType,
    providerEventId: params.providerEventId ?? null,
    orgId: params.orgId ?? null,
    intentId: params.intentId ?? null,
    executionRef: params.executionRef ?? null,
    receivedAt: new Date().toISOString(),
    raw: params.rawPayload,
  });

  try {
    await prisma.providerEvent.create({
      data: {
        id,
        provider: params.provider,
        providerEventId: params.providerEventId ?? null,
        providerEventType: params.providerEventType,
        orgId: params.orgId ?? null,
        intentId: params.intentId ?? null,
        executionRef: params.executionRef ?? null,
        dedupeKey,
        rawPayloadJson,
        normalizedPayloadJson,
        receivedAt: new Date(),
      },
    });
    // Enqueue processing (best effort). Dedupe by uniqueKey so multiple ingests don't cause job storms.
    if (params.orgId && params.enqueueProcessing !== false) {
      await enqueueJob({
        type: JOB_TYPES.PROVIDER_EVENT_PROCESS,
        payload: { providerEventId: id, orgId: params.orgId },
        uniqueKey: `pevt:${dedupeKey}`,
      }).catch(() => null);
    }
    return { created: true, providerEventId: id, dedupeKey };
  } catch (err: any) {
    // Unique constraint hit: event already ingested.
    if (err?.code === "P2002") {
      const existing = await prisma.providerEvent.findUnique({ where: { dedupeKey } });
      // Ensure processing is enqueued even on duplicates (best effort).
      if (existing?.id && params.orgId && params.enqueueProcessing !== false) {
        await enqueueJob({
          type: JOB_TYPES.PROVIDER_EVENT_PROCESS,
          payload: { providerEventId: existing.id, orgId: params.orgId },
          uniqueKey: `pevt:${dedupeKey}`,
        }).catch(() => null);
      }
      return { created: false, providerEventId: existing?.id ?? id, dedupeKey };
    }
    throw err;
  }
}

async function createReconciliationException(params: {
  orgId?: string | null;
  executionRef?: string | null;
  providerEventId: string;
  kind: string;
  details: Record<string, unknown>;
}): Promise<void> {
  await prisma.reconciliationException.create({
    data: {
      id: `rex_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
      status: "OPEN",
      orgId: params.orgId ?? null,
      executionRef: params.executionRef ?? null,
      providerEventId: params.providerEventId,
      kind: params.kind,
      detailsJson: canonicalJsonStringify(params.details),
      createdAt: new Date(),
    },
  });
}

export async function processProviderEvent(providerEventId: string): Promise<void> {
  // Claim processing by setting processedAt only if currently null (prevents double processing races).
  const claimed = await prisma.providerEvent.updateMany({
    where: { id: providerEventId, processedAt: null },
    data: { processedAt: new Date() },
  });
  if (claimed.count === 0) return;

  const evt = await prisma.providerEvent.findUnique({ where: { id: providerEventId } });
  if (!evt) return;

  // Minimal deterministic mapping for scaffold:
  // - payment.settled => execution CONFIRMED + reconciliationStatus matched
  // - payment.returned/failed => execution FAILED
  const type = evt.providerEventType;
  const executionRef = evt.executionRef ?? null;
  type SettlementReceiptToIssue = { orgId: string; intentId: string; executionRef: string; providerEventId: string };
  let issueSettlementReceipt: SettlementReceiptToIssue | null = null;

  try {
    issueSettlementReceipt =
      ((await prisma.$transaction(async (tx) => {
      // IMPORTANT: return the post-commit side effect input rather than mutating an outer variable.
      // This keeps TypeScript narrowing sane and makes the intent explicit.
      let receiptToIssue: SettlementReceiptToIssue | null = null;

      // Plaid Transfer webhooks like TRANSFER_EVENTS_UPDATE are "signals to sync" and do not correlate to a single executionRef.
      // Enqueue a sync job and do not create reconciliation exceptions.
      if (evt.provider === "plaid" && type === "plaid.TRANSFER.TRANSFER_EVENTS_UPDATE") {
        if (evt.orgId) {
          await enqueueJob({
            type: JOB_TYPES.PLAID_TRANSFER_EVENT_SYNC,
            payload: { orgId: evt.orgId, triggerProviderEventId: evt.id },
            // Dedupe per webhook provider event id (never blocks future sync jobs).
            uniqueKey: `plaid_transfer_sync:${evt.orgId}:${evt.id}`,
          }).catch(() => null);
        }
        await tx.providerEvent.update({
          where: { id: evt.id },
          data: { processingError: null },
        });
        return null;
      }

      // Plaid Transfer events synced from /transfer/event/sync should be handled deterministically when correlated.
      if (evt.provider === "plaid" && type.startsWith("plaid.TRANSFER.EVENT.")) {
        if (!executionRef) {
          await tx.reconciliationException.create({
            data: {
              id: `rex_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
              status: "OPEN",
              orgId: evt.orgId ?? null,
              executionRef: null,
              providerEventId: evt.id,
              kind: "unscoped_event",
              detailsJson: canonicalJsonStringify({ providerEventType: type, reason: "missing_executionRef" }),
              createdAt: new Date(),
            },
          });
          await tx.providerEvent.update({ where: { id: evt.id }, data: { processingError: null } });
          return null;
        }

        const ledger = await tx.executionLedger.findFirst({
          where: { executionRef, orgId: evt.orgId ?? undefined },
        });
        if (!ledger) {
          await tx.reconciliationException.create({
            data: {
              id: `rex_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
              status: "OPEN",
              orgId: evt.orgId ?? null,
              executionRef,
              providerEventId: evt.id,
              kind: "unmatched_event",
              detailsJson: canonicalJsonStringify({ reason: "execution_not_found", providerEventType: type }),
              createdAt: new Date(),
            },
          });
          await tx.providerEvent.update({ where: { id: evt.id }, data: { processingError: null } });
          return null;
        }

        const suffix = type.replace("plaid.TRANSFER.EVENT.", "");
        const eventType = suffix; // e.g. pending/posted/settled/failed/returned/cancelled

        // Monotonic-ish progression guardrail (bank-grade).
        const rank: Record<string, number> = { pending: 1, posted: 2, settled: 3 };
        const existingRank = rank[String(ledger.state ?? "")] ?? 0;
        const nextRank = rank[eventType] ?? 0;
        const isTerminal = ledger.status === "CONFIRMED" || ledger.status === "FAILED" || ledger.status === "RECONCILED";
        const wouldRewind = nextRank > 0 && existingRank > nextRank;

        if (isTerminal && nextRank > 0) {
          await tx.reconciliationException.create({
            data: {
              id: `rex_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
              status: "OPEN",
              orgId: evt.orgId ?? null,
              executionRef,
              providerEventId: evt.id,
              kind: "state_conflict",
              detailsJson: canonicalJsonStringify({
                reason: "terminal_state_conflict",
                currentStatus: ledger.status,
                currentState: ledger.state,
                incomingEventType: eventType,
              }),
              createdAt: new Date(),
            },
          });
          await tx.providerEvent.update({ where: { id: evt.id }, data: { processingError: null } });
          return null;
        }

        if (wouldRewind) {
          await tx.reconciliationException.create({
            data: {
              id: `rex_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
              status: "OPEN",
              orgId: evt.orgId ?? null,
              executionRef,
              providerEventId: evt.id,
              kind: "out_of_order_event",
              detailsJson: canonicalJsonStringify({
                reason: "would_rewind_state",
                currentState: ledger.state,
                incomingEventType: eventType,
              }),
              createdAt: new Date(),
            },
          });
          await tx.providerEvent.update({ where: { id: evt.id }, data: { processingError: null } });
          return;
        }

        if (eventType === "pending") {
          await tx.executionLedger.update({
            where: { executionRef },
            data: { status: "PENDING", state: "pending", provider: "plaid", externalStatus: eventType, updatedAt: new Date() },
          });
        } else if (eventType === "posted") {
          await tx.executionLedger.update({
            where: { executionRef },
            data: { status: "SUBMITTED", state: "posted", provider: "plaid", externalStatus: eventType, updatedAt: new Date() },
          });
        } else if (eventType === "settled") {
          const wasUnsettled = ledger.reconciliationAt == null;
          await tx.executionLedger.update({
            where: { executionRef },
            data: {
              status: "CONFIRMED",
              state: "settled",
              provider: "plaid",
              externalStatus: eventType,
              reconciliationStatus: "matched",
              reconciliationAt: new Date(),
              updatedAt: new Date(),
            },
          });
          // Agent 7.1: issue a settlement receipt after we commit this state transition.
          receiptToIssue =
            wasUnsettled && ledger.intentId
              ? { orgId: ledger.orgId, intentId: ledger.intentId, executionRef: ledger.executionRef, providerEventId: evt.id }
              : null;
        } else if (eventType === "failed" || eventType === "returned" || eventType === "cancelled") {
          await tx.executionLedger.update({
            where: { executionRef },
            data: {
              status: "FAILED",
              state: eventType,
              provider: "plaid",
              externalStatus: eventType,
              errorMessage: `Plaid Transfer reported ${eventType}`,
              updatedAt: new Date(),
            },
          });
        } else {
          await tx.reconciliationException.create({
            data: {
              id: `rex_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
              status: "OPEN",
              orgId: evt.orgId ?? null,
              executionRef,
              providerEventId: evt.id,
              kind: "unmapped_event_type",
              detailsJson: canonicalJsonStringify({ providerEventType: type }),
              createdAt: new Date(),
            },
          });
        }

        await tx.providerEvent.update({ where: { id: evt.id }, data: { processingError: null } });
        return receiptToIssue;
      }

      if (executionRef) {
        const ledger = await tx.executionLedger.findFirst({
          where: { executionRef, orgId: evt.orgId ?? undefined },
        });
        if (!ledger) {
          await tx.reconciliationException.create({
            data: {
              id: `rex_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
              status: "OPEN",
              orgId: evt.orgId ?? null,
              executionRef,
              providerEventId: evt.id,
              kind: "unmatched_event",
              detailsJson: canonicalJsonStringify({ reason: "execution_not_found", providerEventType: type }),
              createdAt: new Date(),
            },
          });
        } else if (type === "payment.settled") {
          const wasUnsettled = ledger.reconciliationAt == null;
          await tx.executionLedger.update({
            where: { executionRef },
            data: {
              status: "CONFIRMED",
              state: "settled",
              provider: evt.provider,
              externalRef: evt.providerEventId ?? ledger.externalRef ?? null,
              externalStatus: type,
              reconciliationStatus: "matched",
              reconciliationAt: new Date(),
              updatedAt: new Date(),
            },
          });
          receiptToIssue =
            wasUnsettled && ledger.intentId
              ? { orgId: ledger.orgId, intentId: ledger.intentId, executionRef: ledger.executionRef, providerEventId: evt.id }
              : null;
        } else if (type === "payment.failed" || type === "payment.returned") {
          await tx.executionLedger.update({
            where: { executionRef },
            data: {
              status: "FAILED",
              state: type === "payment.returned" ? "returned" : "failed",
              provider: evt.provider,
              externalRef: evt.providerEventId ?? ledger.externalRef ?? null,
              externalStatus: type,
              errorMessage: "Provider reported failure/return",
              updatedAt: new Date(),
            },
          });
        } else {
          await tx.reconciliationException.create({
            data: {
              id: `rex_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
              status: "OPEN",
              orgId: evt.orgId ?? null,
              executionRef,
              providerEventId: evt.id,
              kind: "unmapped_event_type",
              detailsJson: canonicalJsonStringify({ providerEventType: type }),
              createdAt: new Date(),
            },
          });
        }
      } else {
        await tx.reconciliationException.create({
          data: {
            id: `rex_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
            status: "OPEN",
            orgId: evt.orgId ?? null,
            executionRef: null,
            providerEventId: evt.id,
            kind: "unscoped_event",
            detailsJson: canonicalJsonStringify({ providerEventType: type, reason: "missing_executionRef" }),
            createdAt: new Date(),
          },
        });
      }

      await tx.providerEvent.update({
        where: { id: evt.id },
        data: { processingError: null },
      });

      return receiptToIssue;
    })) as SettlementReceiptToIssue | null | undefined) ?? null;
  } catch (error: any) {
    await prisma.providerEvent.update({
      where: { id: evt.id },
      data: {
        processingError: error?.message ?? String(error),
      },
    });
  }

  // Post-commit side effect: mint portable settlement receipt (best-effort).
  if (issueSettlementReceipt) {
    try {
      // Agent 11: append settlement event first (so the receipt includes the updated chain head),
      // then enqueue POSE anchoring for Blockscout visibility.
      const settlementEvent = await appendIntentEvent({
        orgId: issueSettlementReceipt.orgId,
        intentId: issueSettlementReceipt.intentId,
        eventType: "settlement.reported",
        payload: { executionRef: issueSettlementReceipt.executionRef, providerEventId: issueSettlementReceipt.providerEventId },
        createdByUserId: null,
        createdAt: new Date(),
      });

      await enqueueJob({
        type: JOB_TYPES.POSE_ANCHOR_INTENT_EVENT,
        payload: {
          orgId: settlementEvent.orgId,
          intentId: settlementEvent.intentId,
          seq: settlementEvent.seq,
          eventType: settlementEvent.eventType,
          eventHash: settlementEvent.eventHash,
          prevEventHash: settlementEvent.prevHash ?? null,
        },
        uniqueKey: `pose_anchor:${settlementEvent.orgId}:${settlementEvent.intentId}:${settlementEvent.seq}:${settlementEvent.eventHash}`,
        maxAttempts: 10,
      }).catch(() => null);

      const { issuePoseVerificationToken } = await import("../verification/poseReceipt.js");
      await issuePoseVerificationToken({
        orgId: issueSettlementReceipt.orgId,
        intentId: issueSettlementReceipt.intentId,
        executionRef: issueSettlementReceipt.executionRef,
        receiptType: "settlement.reported",
      });
    } catch {
      // Best-effort; never fail provider event processing due to receipt issuance.
    }
  }
}

export async function processUnprocessedProviderEvents(limit = 100): Promise<{
  processed: number;
}> {
  const rows = await prisma.providerEvent.findMany({
    where: { processedAt: null },
    orderBy: { receivedAt: "asc" },
    take: Math.max(1, Math.min(limit, 500)),
  });

  for (const r of rows) {
    await processProviderEvent(r.id);
  }

  return { processed: rows.length };
}

