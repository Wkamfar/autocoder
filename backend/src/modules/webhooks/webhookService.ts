/**
 * Webhook Management Service
 * 
 * Handles webhook configuration, delivery, and retries
 */

import { prisma } from "../../db/prisma.js";
import { sha256Hex } from "../../lib/sha256.js";
import {
  decryptSecretFromBase64url,
  encryptSecretToBase64url,
  getSecretsEncryptionKey,
} from "../../lib/secretBox.js";
import { enqueueJob } from "../../jobs/jobQueue.js";
import { JOB_TYPES } from "../../jobs/jobTypes.js";
import crypto from "crypto";
import axios from "axios";
import { assertSafeOutboundUrl, UnsafeOutboundUrlError } from "../../lib/outboundUrlSafety.js";
import { withSemaphore } from "../../lib/resilience/semaphore.js";
import { assertCircuitAllows, recordCircuitFailure, recordCircuitSuccess } from "../../lib/resilience/circuitBreaker.js";
import { makeTraceparent, newTraceId } from "../../lib/resilience/trace.js";

function webhookUrlSafetyOptions() {
  const allowHttp = process.env.WEBHOOK_ALLOW_HTTP === "true";
  const allowLocalhost = process.env.WEBHOOK_ALLOW_LOCALHOST === "true";
  // Default: resolve DNS to prevent obvious SSRF targets (recommended for production).
  // For hermetic test environments, set WEBHOOK_RESOLVE_DNS=false.
  const resolveDns = process.env.WEBHOOK_RESOLVE_DNS !== "false";
  return { allowHttp, allowLocalhost, resolveDns };
}

async function validateWebhookTargetOrThrow(url: string): Promise<void> {
  try {
    await assertSafeOutboundUrl(url, webhookUrlSafetyOptions());
  } catch (e) {
    if (e instanceof UnsafeOutboundUrlError) {
      const err = new Error(e.message) as Error & { code?: string };
      err.code = e.code;
      throw err;
    }
    throw e;
  }
}

export type WebhookEventType =
  | "intent.created"
  | "intent.updated"
  | "intent.approved"
  | "intent.denied"
  | "intent.executed"
  | "intent.canceled"
  | "challenge.created"
  | "proof.submitted"
  | "decision.made"
  | "beneficiary.created"
  | "beneficiary.updated"
  | "beneficiary.locked"
  // Internal-only event type used for test delivery.
  | "webhook.test";

export interface Webhook {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  secretHash: string;
  secretEncrypted?: string | null;
  active: boolean;
  lastTriggeredAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generate webhook secret
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString("hex")}`;
}

/**
 * Create a new webhook
 */
export async function createWebhook(params: {
  orgId: string;
  userId: string;
  name: string;
  url: string;
  events: WebhookEventType[];
}): Promise<{ webhook: Webhook; secret: string }> {
  // SSRF guardrails: validate target URL before storing.
  await validateWebhookTargetOrThrow(params.url);

  const secret = generateWebhookSecret();
  const secretHash = sha256Hex(secret);
  const key = getSecretsEncryptionKey();
  // Tighten adoption: require encryption key in production to ensure v1 signing.
  if (process.env.NODE_ENV === "production" && !key) {
    const err = new Error("Missing WIRE2_SECRETS_ENCRYPTION_KEY for webhook signing") as Error & { code?: string };
    err.code = "WEBHOOK_SIGNING_CONFIG_MISSING";
    throw err;
  }
  const secretEncrypted = key ? encryptSecretToBase64url(key, secret) : null;
  
  const webhook = await prisma.webhook.create({
    data: {
      id: `webhook_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
      orgId: params.orgId,
      userId: params.userId,
      name: params.name,
      url: params.url,
      events: params.events,
      secretHash,
      secretEncrypted: secretEncrypted ?? undefined,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  
  return {
    webhook: {
      id: webhook.id,
      orgId: webhook.orgId,
      userId: webhook.userId,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events as WebhookEventType[],
      secretHash: webhook.secretHash,
      secretEncrypted: (webhook as any).secretEncrypted ?? null,
      active: webhook.active,
      lastTriggeredAt: webhook.lastTriggeredAt,
      lastSuccessAt: webhook.lastSuccessAt,
      lastFailureAt: webhook.lastFailureAt,
      failureCount: webhook.failureCount,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    },
    secret, // Only returned once on creation
  };
}

/**
 * List webhooks for an organization
 */
export async function listWebhooks(orgId: string): Promise<Webhook[]> {
  const webhooks = await prisma.webhook.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  
  return webhooks.map((w) => ({
    id: w.id,
    orgId: w.orgId,
    userId: w.userId,
    name: w.name,
    url: w.url,
    events: w.events as WebhookEventType[],
    secretHash: w.secretHash,
    secretEncrypted: (w as any).secretEncrypted ?? null,
    active: w.active,
    lastTriggeredAt: w.lastTriggeredAt,
    lastSuccessAt: w.lastSuccessAt,
    lastFailureAt: w.lastFailureAt,
    failureCount: w.failureCount,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  }));
}

/**
 * Update webhook
 */
export async function updateWebhook(params: {
  orgId: string;
  webhookId: string;
  name?: string;
  url?: string;
  events?: WebhookEventType[];
  active?: boolean;
}): Promise<Webhook | null> {
  const webhook = await prisma.webhook.findFirst({
    where: { id: params.webhookId, orgId: params.orgId },
  });
  if (!webhook) {
    return null;
  }

  if (params.url) {
    await validateWebhookTargetOrThrow(params.url);
  }
  
  const updated = await prisma.webhook.update({
    where: { id: params.webhookId },
    data: {
      name: params.name ?? webhook.name,
      url: params.url ?? webhook.url,
      events: params.events ?? webhook.events,
      active: params.active ?? webhook.active,
      updatedAt: new Date(),
    },
  });
  
  return {
    id: updated.id,
    orgId: updated.orgId,
    userId: updated.userId,
    name: updated.name,
    url: updated.url,
    events: updated.events as WebhookEventType[],
    secretHash: updated.secretHash,
    secretEncrypted: (updated as any).secretEncrypted ?? null,
    active: updated.active,
    lastTriggeredAt: updated.lastTriggeredAt,
    lastSuccessAt: updated.lastSuccessAt,
    lastFailureAt: updated.lastFailureAt,
    failureCount: updated.failureCount,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

export type WebhookDelivery = {
  id: string;
  webhookId: string;
  eventType: string;
  eventId: string;
  status: string;
  statusCode: number | null;
  responseBody: string | null;
  attemptNumber: number;
  nextRetryAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
};

export async function listWebhookDeliveries(params: {
  orgId: string;
  webhookId: string;
  limit?: number;
}): Promise<WebhookDelivery[] | null> {
  const webhook = await prisma.webhook.findFirst({
    where: { id: params.webhookId, orgId: params.orgId },
  });
  if (!webhook) return null;

  const deliveries = await prisma.webhookDelivery.findMany({
    where: { webhookId: params.webhookId },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(params.limit ?? 50, 200)),
  });

  return deliveries.map((d) => ({
    id: d.id,
    webhookId: d.webhookId,
    eventType: d.eventType,
    eventId: d.eventId,
    status: d.status,
    statusCode: d.statusCode ?? null,
    responseBody: d.responseBody ?? null,
    attemptNumber: d.attemptNumber,
    nextRetryAt: d.nextRetryAt ?? null,
    deliveredAt: d.deliveredAt ?? null,
    createdAt: d.createdAt,
  }));
}

export async function rotateWebhookSecret(params: {
  orgId: string;
  webhookId: string;
}): Promise<{ secret: string } | null> {
  const webhook = await prisma.webhook.findFirst({
    where: { id: params.webhookId, orgId: params.orgId },
  });
  if (!webhook) return null;

  const secret = generateWebhookSecret();
  const secretHash = sha256Hex(secret);
  const key = getSecretsEncryptionKey();
  // Tighten adoption: require encryption key in production to ensure v1 signing.
  if (process.env.NODE_ENV === "production" && !key) {
    const err = new Error("Missing WIRE2_SECRETS_ENCRYPTION_KEY for webhook signing") as Error & { code?: string };
    err.code = "WEBHOOK_SIGNING_CONFIG_MISSING";
    throw err;
  }
  const secretEncrypted = key ? encryptSecretToBase64url(key, secret) : null;

  await prisma.webhook.update({
    where: { id: params.webhookId },
    data: {
      secretHash,
      secretEncrypted: secretEncrypted ?? undefined,
      updatedAt: new Date(),
    },
  });

  return { secret };
}

export async function sendTestWebhook(params: {
  orgId: string;
  webhookId: string;
}): Promise<{ deliveryId: string } | null> {
  const webhook = await prisma.webhook.findFirst({
    where: { id: params.webhookId, orgId: params.orgId },
  });
  if (!webhook) return null;

  const payload = {
    ok: true,
    message: "This is a test event from Wire2.",
  } as Record<string, unknown>;

  const delivery = await prisma.webhookDelivery.create({
    data: {
      id: `delivery_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
      orgId: webhook.orgId,
      webhookId: webhook.id,
      eventType: "webhook.test",
      eventId: `evt_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
      payloadJson: JSON.stringify(payload),
      status: "pending",
      attemptNumber: 1,
      createdAt: new Date(),
    },
  });

  // Deterministic + reliable: schedule via job queue (worker will deliver).
  await scheduleWebhookDeliveryAttempt({ deliveryId: delivery.id, orgId: params.orgId });
  return { deliveryId: delivery.id };
}

/**
 * Delete webhook
 */
export async function deleteWebhook(
  orgId: string,
  webhookId: string
): Promise<boolean> {
  const webhook = await prisma.webhook.findFirst({
    where: { id: webhookId, orgId },
  });
  if (!webhook) {
    return false;
  }
  
  await prisma.webhook.delete({
    where: { id: webhookId },
  });
  
  return true;
}

/**
 * Trigger webhook delivery
 */
export async function triggerWebhook(params: {
  orgId: string;
  eventType: WebhookEventType;
  eventId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  // Find all active webhooks for this org that subscribe to this event
  const webhooks = await prisma.webhook.findMany({
    where: {
      orgId: params.orgId,
      active: true,
      events: { has: params.eventType },
    },
  });
  
  // Create delivery records and attempt delivery
  for (const webhook of webhooks) {
    await createWebhookDelivery({
      webhookId: webhook.id,
      eventType: params.eventType,
      eventId: params.eventId,
      payload: params.payload,
    });
  }
}

export async function scheduleWebhookDeliveryAttempt(params: {
  deliveryId: string;
  orgId: string;
  runAt?: Date;
}): Promise<void> {
  await enqueueJob({
    type: JOB_TYPES.WEBHOOK_DELIVERY,
    payload: { deliveryId: params.deliveryId, orgId: params.orgId },
    runAt: params.runAt ?? new Date(),
    maxAttempts: 5,
    uniqueKey: params.deliveryId,
  });
}

/**
 * Create webhook delivery and attempt to send
 */
async function createWebhookDelivery(params: {
  webhookId: string;
  eventType: WebhookEventType;
  eventId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  // Defensive: do not deliver webhooks without a tenant anchor.
  const webhook = await prisma.webhook.findFirst({
    where: { id: params.webhookId, active: true },
  });
  
  if (!webhook) return;
  
  const delivery = await prisma.webhookDelivery.create({
    data: {
      id: `delivery_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
      webhookId: params.webhookId,
      orgId: webhook.orgId,
      eventType: params.eventType,
      eventId: params.eventId,
      payloadJson: JSON.stringify(params.payload),
      status: "pending",
      attemptNumber: 1,
      createdAt: new Date(),
    },
  });

  // Agent 8: async delivery via DB-backed job queue (deduped by deliveryId).
  await scheduleWebhookDeliveryAttempt({ deliveryId: delivery.id, orgId: webhook.orgId });
}

/**
 * Attempt to deliver webhook
 */
async function attemptWebhookDelivery(
  deliveryId: string,
  orgId: string,
  url: string,
  secretHash: string,
  secretEncrypted: string | null,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; nextRetryAt?: Date | null }> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
  });
  
  if (!delivery) return { ok: true };
  
  const timestamp = Date.now();
  const eventEnvelope = {
    id: delivery.id,
    type: delivery.eventType,
    data: payload,
    timestamp,
  };
  const rawBody = JSON.stringify(eventEnvelope);

  const { signatureHeader, signingMode } = generateWebhookSignatureHeader({
    timestamp,
    rawBody,
    secretHash,
    secretEncrypted,
  });
  
  try {
    // SSRF guardrails: validate again at send time.
    await validateWebhookTargetOrThrow(url);

    // Agent 8 P1/P2: provider circuit breaker + per-tenant saturation controls + trace propagation.
    const tenantLimit = Number(process.env.JOB_TENANT_CONCURRENCY || 5);
    const circuitKey = `webhook:${delivery.webhookId}`;
    const traceparent = makeTraceparent(newTraceId());
    assertCircuitAllows(circuitKey);

    const response = await withSemaphore(`tenant:${orgId}`, tenantLimit, async () => {
      return await axios.post(url, rawBody, {
        headers: {
          "X-WIRE-Signature": signatureHeader,
          "X-WIRE-Timestamp": timestamp.toString(),
          "X-WIRE-Signature-Mode": signingMode, // "v1" or "legacy"
          "Content-Type": "application/json",
          traceparent,
        },
        timeout: 10000, // 10 second timeout
        maxRedirects: 0, // Prevent redirect-based SSRF
        // Axios will not stringify again when body is a string.
        transformRequest: [(data) => data],
      });
    });
    
    // Success
    if (response.status >= 200 && response.status < 300) {
      recordCircuitSuccess(circuitKey);
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "delivered",
          statusCode: response.status,
          responseBody: JSON.stringify(response.data),
          deliveredAt: new Date(),
        },
      });
      
      // Update webhook stats
      await prisma.webhook.update({
        where: { id: delivery.webhookId },
        data: {
          lastTriggeredAt: new Date(),
          lastSuccessAt: new Date(),
          failureCount: 0,
        },
      });

      return { ok: true };
    } else {
      throw new Error(`Unexpected status code: ${response.status}`);
    }
  } catch (error: any) {
    recordCircuitFailure(`webhook:${delivery.webhookId}`);
    // Unsafe targets should fail closed (no retries).
    if (error?.code === "UNSAFE_OUTBOUND_URL") {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "failed",
          statusCode: null,
          responseBody: `Blocked unsafe webhook target: ${String(error.message || "unsafe url")}`,
          nextRetryAt: null,
        },
      });
      return { ok: false, nextRetryAt: null };
    }

    // Failure - schedule retry
    const nextRetryAt = calculateNextRetry(delivery.attemptNumber);
    
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: nextRetryAt ? "retrying" : "failed",
        statusCode: error.response?.status,
        responseBody: error.response?.data ? JSON.stringify(error.response.data) : error.message,
        attemptNumber: delivery.attemptNumber + 1,
        nextRetryAt,
      },
    });
    
    // Update webhook stats
    await prisma.webhook.update({
      where: { id: delivery.webhookId },
      data: {
        lastTriggeredAt: new Date(),
        lastFailureAt: new Date(),
        failureCount: { increment: 1 },
      },
    });

    return { ok: false, nextRetryAt };
  }
}

export async function attemptWebhookDeliveryById(deliveryId: string, orgId: string): Promise<{
  ok: boolean;
  nextRetryAt?: Date | null;
}> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhook: true },
  });

  if (!delivery) return { ok: true };

  // Agent 4/0: tenant guardrail for async delivery paths.
  // Prefer delivery.orgId (denormalized) but also check webhook.orgId for defense-in-depth.
  if ((delivery as any).orgId !== orgId || delivery.webhook.orgId !== orgId) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "failed",
        statusCode: null,
        responseBody: "Tenant mismatch: refusing to deliver webhook",
        nextRetryAt: null,
      },
    }).catch(() => null);
    return { ok: false, nextRetryAt: null };
  }

  const payload = JSON.parse(delivery.payloadJson);
  return await attemptWebhookDelivery(
    delivery.id,
    orgId,
    delivery.webhook.url,
    delivery.webhook.secretHash,
    (delivery.webhook as any).secretEncrypted ?? null,
    payload
  );
}

/**
 * Generate webhook signature header.
 *
 * - v1 mode (preferred): HMAC-SHA256(secret, `${t}.${rawBody}`), header `t=<t>,v1=<hex>`
 * - legacy fallback: HMAC-SHA256(secretHash, `${t}.${rawBody}`), header `t=<t>,v0=<hex>`
 */
function generateWebhookSignatureHeader(params: {
  timestamp: number;
  rawBody: string;
  secretHash: string;
  secretEncrypted: string | null;
}): { signatureHeader: string; signingMode: "v1" | "legacy" } {
  const message = `${params.timestamp}.${params.rawBody}`;

  const key = getSecretsEncryptionKey();
  if (key && params.secretEncrypted) {
    const secret = decryptSecretFromBase64url(key, params.secretEncrypted);
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(message, "utf8");
    const v1 = hmac.digest("hex");
    return { signatureHeader: `t=${params.timestamp},v1=${v1}`, signingMode: "v1" };
  }

  // Backwards-compat fallback.
  const legacyHmac = crypto.createHmac("sha256", params.secretHash);
  legacyHmac.update(message, "utf8");
  const v0 = legacyHmac.digest("hex");
  return { signatureHeader: `t=${params.timestamp},v0=${v0}`, signingMode: "legacy" };
}

/**
 * Calculate next retry time (exponential backoff)
 */
function calculateNextRetry(attemptNumber: number): Date | null {
  if (attemptNumber >= 5) {
    return null; // Max 5 attempts
  }
  
  const delayMinutes = Math.pow(2, attemptNumber); // 1, 2, 4, 8, 16 minutes
  return new Date(Date.now() + delayMinutes * 60 * 1000);
}

/**
 * Retry failed webhook deliveries
 */
export async function retryFailedWebhooks(): Promise<void> {
  const now = new Date();
  const failedDeliveries = await prisma.webhookDelivery.findMany({
    where: {
      status: "retrying",
      nextRetryAt: { lte: now },
    },
    include: {
      webhook: true,
    },
    take: 100, // Process 100 at a time
  });
  
  for (const delivery of failedDeliveries) {
    // Job-based retry: enqueue attempts (deduped by uniqueKey=deliveryId)
    await scheduleWebhookDeliveryAttempt({ deliveryId: delivery.id, orgId: delivery.webhook.orgId, runAt: new Date() });
  }
}
