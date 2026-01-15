/**
 * Plaid Transfer event sync worker utilities
 *
 * - Uses `/transfer/event/sync` with `after_id` paging (bank-grade: guarantees no missed events).
 * - Ingests each returned transfer event as a ProviderEvent (deduped).
 * - Correlates by `transfer_id` -> `ExecutionLedger.externalRef` (expected invariant for Plaid Transfer executions).
 * - Applies deterministic ExecutionLedger transitions via the ProviderEvent processor.
 */

import axios from "axios";
import { prisma } from "../../../db/prisma.js";
import { ingestProviderEvent, processProviderEvent } from "../../payments/providerEvents.js";

type PlaidEnv = "sandbox" | "development" | "production";

function plaidBaseUrl(env: PlaidEnv): string {
  switch (env) {
    case "sandbox":
      return "https://sandbox.plaid.com";
    case "development":
      return "https://development.plaid.com";
    case "production":
      return "https://production.plaid.com";
  }
}

function requirePlaidCreds(): { clientId: string; secret: string; env: PlaidEnv } {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = (process.env.PLAID_ENV as PlaidEnv | undefined) ?? "sandbox";
  if (!clientId || !secret) throw new Error("PLAID_CLIENT_ID/PLAID_SECRET not configured");
  return { clientId, secret, env };
}

export type PlaidTransferEvent = {
  event_id: number;
  timestamp: string;
  event_type: string;
  transfer_id?: string | null;
  // There are additional optional fields; we preserve them in raw payload.
  [k: string]: unknown;
};

type TransferEventSyncResponse = {
  transfer_events: PlaidTransferEvent[];
  has_more: boolean;
  request_id?: string;
};

async function plaidTransferEventSync(params: { afterId: number; count?: number }): Promise<TransferEventSyncResponse> {
  const { clientId, secret, env } = requirePlaidCreds();
  const url = `${plaidBaseUrl(env)}/transfer/event/sync`;
  const res = await axios.post(
    url,
    { after_id: params.afterId, count: params.count ?? 500 },
    {
      headers: {
        "Content-Type": "application/json",
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
      timeout: 15_000,
    }
  );
  return res.data as TransferEventSyncResponse;
}

async function getLastSeenEventId(orgId: string): Promise<number> {
  // Bank-grade correctness: use numeric max(event_id) across already ingested Plaid transfer events.
  // We store Plaid transfer event_id in ProviderEvent.providerEventId as a string.
  const rows = await prisma.$queryRaw<{ max_id: bigint | null }[]>`
    SELECT MAX(CAST("providerEventId" AS bigint)) AS max_id
    FROM "ProviderEvent"
    WHERE "orgId" = ${orgId}
      AND "provider" = 'plaid'
      AND "providerEventType" LIKE 'plaid.TRANSFER.EVENT.%'
      AND "providerEventId" ~ '^[0-9]+$'
  `;
  const max = rows?.[0]?.max_id ?? null;
  return max ? Number(max) : 0;
}

async function correlateExecutionRef(params: {
  orgId: string;
  transferId: string;
}): Promise<{ executionRef: string; intentId: string | null } | null> {
  const ledger = await prisma.executionLedger.findFirst({
    where: { orgId: params.orgId, externalRef: params.transferId },
    select: { executionRef: true, intentId: true },
  });
  if (!ledger) return null;
  return { executionRef: ledger.executionRef, intentId: ledger.intentId ?? null };
}

export async function runPlaidTransferEventSync(params: {
  orgId: string;
  // Used only for auditing/dedupe; does not change sync cursor.
  triggerProviderEventId?: string;
  // Safety cap per job tick.
  maxPages?: number;
}): Promise<{ fetched: number; ingested: number; processed: number; lastEventId: number }> {
  const maxPages = Math.max(1, Math.min(params.maxPages ?? 10, 50));

  let afterId = await getLastSeenEventId(params.orgId);
  let fetched = 0;
  let ingested = 0;
  let processed = 0;
  let pages = 0;

  while (pages < maxPages) {
    pages++;
    const resp = await plaidTransferEventSync({ afterId, count: 500 });
    const events = Array.isArray(resp.transfer_events) ? resp.transfer_events : [];
    fetched += events.length;

    let maxEventIdThisPage = afterId;

    for (const ev of events) {
      const eventIdNum = typeof ev.event_id === "number" ? ev.event_id : Number(ev.event_id);
      if (Number.isFinite(eventIdNum)) {
        if (eventIdNum > maxEventIdThisPage) maxEventIdThisPage = eventIdNum;
      }

      const transferId = (ev.transfer_id as string | null | undefined) ?? null;
      const corr = transferId ? await correlateExecutionRef({ orgId: params.orgId, transferId }) : null;

      const res = await ingestProviderEvent({
        provider: "plaid",
        providerEventType: `plaid.TRANSFER.EVENT.${String(ev.event_type)}`,
        providerEventId: String(ev.event_id),
        orgId: params.orgId,
        intentId: corr?.intentId ?? null,
        executionRef: corr?.executionRef ?? null,
        rawPayload: {
          schema: "plaid.transfer_event.v1",
          triggerProviderEventId: params.triggerProviderEventId ?? null,
          event: ev,
        },
        // Avoid job-bloat: we process inline in this sync job.
        enqueueProcessing: false,
      });

      if (res.created) ingested++;

      // Apply deterministic ledger transition now (idempotent claim-by-processedAt).
      await processProviderEvent(res.providerEventId);
      processed++;
    }

    afterId = maxEventIdThisPage;

    if (!resp.has_more) break;
    // If has_more but no progress, avoid infinite loop.
    if (events.length === 0) break;
  }

  return { fetched, ingested, processed, lastEventId: afterId };
}

