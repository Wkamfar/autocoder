import "dotenv/config";
import { claimDueJobs, computeBackoffMs, markJobDead, markJobSucceeded, reapStuckJobs, rescheduleJob } from "./jobs/jobQueue.js";
import { JOB_TYPES } from "./jobs/jobTypes.js";
import { sleep } from "./jobs/sleep.js";
import { logger } from "./lib/observability.js";
import { attemptWebhookDeliveryById } from "./modules/webhooks/webhookService.js";
import { sendEmail } from "./modules/email/emailService.js";
import { generateAuditBundle } from "./modules/intents/intentService.js";
import { processProviderEvent } from "./modules/payments/providerEvents.js";
import { runPlaidTransferEventSync } from "./modules/providers/plaid/transferEventSync.js";
import { withSemaphore } from "./lib/resilience/semaphore.js";
import { assertCircuitAllows, recordCircuitFailure, recordCircuitSuccess } from "./lib/resilience/circuitBreaker.js";
import { processPoseAnchorIntentEventJob } from "./modules/pose/poseAnchoring.js";
import { processWireV3ExecuteIntentJob } from "./modules/wireV3/executionRetry.js";

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const workerId = process.env.JOB_WORKER_ID ?? `worker_${process.pid}`;
const pollIntervalMs = envNumber("JOB_POLL_INTERVAL_MS", 1000);
const concurrency = envNumber("JOB_CONCURRENCY", 10);
const visibilityTimeoutMs = envNumber("JOB_VISIBILITY_TIMEOUT_MS", 10 * 60 * 1000);
const reapEveryTicks = envNumber("JOB_REAP_EVERY_TICKS", 30);

let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

async function handleJob(job: { id: string; type: string; payloadJson: string; attempts: number; maxAttempts: number }) {
  const { id, type, attempts, maxAttempts } = job;
  const payload = JSON.parse(job.payloadJson || "{}");

  try {
    switch (type) {
      case JOB_TYPES.WEBHOOK_DELIVERY: {
        const deliveryId = (payload as any).deliveryId as string | undefined;
        const orgId = (payload as any).orgId as string | undefined;
        if (!deliveryId) {
          await markJobDead({ jobId: id, lastError: "missing payload.deliveryId" });
          return;
        }
        if (!orgId) {
          await markJobDead({ jobId: id, lastError: "missing payload.orgId" });
          return;
        }

        const result = await attemptWebhookDeliveryById(deliveryId, orgId);
        if (result.ok) {
          await markJobSucceeded(id);
          return;
        }

        // Delivery failed; retry only if nextRetryAt exists and attempts remain.
        const nextRetryAt = result.nextRetryAt ?? null;
        if (!nextRetryAt) {
          await markJobDead({ jobId: id, lastError: "delivery failed: max retries reached (no nextRetryAt)" });
          return;
        }

        if (attempts >= maxAttempts) {
          await markJobDead({ jobId: id, lastError: "job maxAttempts reached" });
          return;
        }

        await rescheduleJob({ jobId: id, runAt: nextRetryAt, lastError: "delivery failed; scheduled retry" });
        return;
      }

      case JOB_TYPES.EMAIL_SEND: {
        const to = (payload as any).to as string | undefined;
        const templateType = (payload as any).templateType as string | undefined;
        const subject = (payload as any).subject as string | undefined;
        if (!to || !templateType || !subject) {
          await markJobDead({ jobId: id, lastError: "missing email payload fields (to/templateType/subject)" });
          return;
        }

        const orgId = (payload as any).orgId as string | undefined;
        const tenantLimit = Number(process.env.JOB_TENANT_CONCURRENCY || 5);
        const emailProvider = process.env.EMAIL_PROVIDER || "console";
        const circuitKey = `email:${emailProvider}`;

        assertCircuitAllows(circuitKey);
        const result = await withSemaphore(`tenant:${orgId || "unknown"}`, tenantLimit, async () => {
          return await sendEmail({
            to,
            templateType: templateType as any,
            subject,
            bodyHtml: (payload as any).bodyHtml,
            bodyText: (payload as any).bodyText,
            variables: (payload as any).variables,
          });
        });

        if (result.success) {
          recordCircuitSuccess(circuitKey);
          await markJobSucceeded(id);
          return;
        }

        recordCircuitFailure(circuitKey);
        throw new Error(result.error || "email send failed");
      }

      case JOB_TYPES.EVIDENCE_BUNDLE_GENERATE: {
        const orgId = (payload as any).orgId as string | undefined;
        const userId = (payload as any).userId as string | undefined;
        const intentId = (payload as any).intentId as string | undefined;
        const mode = (payload as any).mode as "full" | "redacted" | undefined;
        if (!orgId || !userId || !intentId || !mode) {
          await markJobDead({ jobId: id, lastError: "missing bundle payload fields (orgId/userId/intentId/mode)" });
          return;
        }

        const exportLimit = Number(process.env.JOB_EXPORT_CONCURRENCY_PER_TENANT || 2);
        const bundle = await withSemaphore(`tenant:${orgId}:exports`, exportLimit, async () => {
          return await generateAuditBundle({ orgId, userId, intentId, mode });
        });
        if (!bundle) {
          await markJobDead({ jobId: id, lastError: "intent not found; cannot generate bundle" });
          return;
        }

        await markJobSucceeded(id);
        return;
      }

      case JOB_TYPES.PROVIDER_EVENT_PROCESS: {
        const providerEventId = (payload as any).providerEventId as string | undefined;
        const orgId = (payload as any).orgId as string | undefined;
        if (!providerEventId || !orgId) {
          await markJobDead({ jobId: id, lastError: "missing provider event payload fields (providerEventId/orgId)" });
          return;
        }

        // Processing is idempotent (claimed by processedAt) and safe under retries.
        await processProviderEvent(providerEventId);
        await markJobSucceeded(id);
        return;
      }

      case JOB_TYPES.PLAID_TRANSFER_EVENT_SYNC: {
        const orgId = (payload as any).orgId as string | undefined;
        const triggerProviderEventId = (payload as any).triggerProviderEventId as string | undefined;
        if (!orgId) {
          await markJobDead({ jobId: id, lastError: "missing payload.orgId" });
          return;
        }

        await runPlaidTransferEventSync({ orgId, triggerProviderEventId, maxPages: 10 });
        await markJobSucceeded(id);
        return;
      }

      case JOB_TYPES.POSE_ANCHOR_INTENT_EVENT: {
        await processPoseAnchorIntentEventJob({ jobId: id, payload });
        await markJobSucceeded(id);
        return;
      }

      case JOB_TYPES.WIRE_V3_EXECUTE_INTENT: {
        const orgId = (payload as any).orgId as string | undefined;
        const userId = (payload as any).userId as string | undefined;
        const intentId = (payload as any).intentId as string | undefined;
        const sessionId = (payload as any).sessionId as string | undefined;
        const clientConfirmationId = (payload as any).clientConfirmationId as string | undefined;
        if (!orgId || !userId || !intentId || !sessionId || !clientConfirmationId) {
          await markJobDead({ jobId: id, lastError: "missing wire v3 execute payload fields" });
          return;
        }

        await processWireV3ExecuteIntentJob({
          orgId,
          userId,
          intentId,
          sessionId,
          clientConfirmationId,
        });
        await markJobSucceeded(id);
        return;
      }

      default: {
        await markJobDead({ jobId: id, lastError: `unknown job type: ${type}` });
        return;
      }
    }
  } catch (error: any) {
    const message = error?.message ? String(error.message) : "unknown error";

    if (attempts >= maxAttempts) {
      await markJobDead({ jobId: id, lastError: message });
      return;
    }

    const delayMs = computeBackoffMs(attempts);
    await rescheduleJob({
      jobId: id,
      runAt: new Date(Date.now() + delayMs),
      lastError: message,
    });
  }
}

async function main() {
  logger.info("job worker starting", { workerId, pollIntervalMs, concurrency, visibilityTimeoutMs });

  let tick = 0;

  while (!stopping) {
    tick++;

    try {
      if (tick % reapEveryTicks === 0) {
        const reaped = await reapStuckJobs({ visibilityTimeoutMs });
        if (reaped > 0) logger.warn("reaped stuck jobs", { count: reaped });
      }

      const jobs = await claimDueJobs({ limit: concurrency, workerId });
      if (jobs.length === 0) {
        await sleep(pollIntervalMs);
        continue;
      }

      await Promise.all(jobs.map((j) => handleJob(j)));
    } catch (error: any) {
      logger.error("job worker tick failed", error, { workerId });
      await sleep(Math.min(5000, pollIntervalMs));
    }
  }

  logger.info("job worker stopping", { workerId });
}

await main();

