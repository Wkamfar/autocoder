/**
 * WIRE Node.js SDK
 * 
 * Official SDK for integrating WIRE voice-based authorization
 */

import axios, { AxiosInstance } from "axios";
import crypto from "node:crypto";

export interface WireConfig {
  apiKey: string;
  apiSecret?: string;
  baseUrl?: string;
  sandbox?: boolean;
  /**
   * Optional API prefix. Defaults to `/api/wire`.
   * If you set `baseUrl` to `http://localhost:3000`, keep this as `/api/wire`.
   * If you set `baseUrl` to `http://localhost:3000/api/wire`, set this to `` (empty).
   */
  apiPrefix?: string;
  /**
   * Optional sandbox admin token used for `/api/sandbox/*` endpoints.
   */
  sandboxAdminToken?: string;
}

export interface CreateIntentParams {
  railsType: "ACH" | "WIRE";
  amountMinor: string;
  currency: string;
  beneficiaryId: string;
  purpose: string;
}

export interface Intent {
  id: string;
  orgId: string;
  createdByUserId: string;
  railsType: "ACH" | "WIRE";
  amountMinor: string;
  currency: string;
  beneficiaryId: string;
  purpose: string;
  status: string;
  riskScore: number;
  requiredApprovals: number;
  createdAt: string;
}

export interface CreateBeneficiaryParams {
  displayName: string;
  country: string;
  railsAllowed: ("ACH" | "WIRE")[];
  bankLast4: string;
  bankTokenHash: string;
}

export interface Beneficiary {
  id: string;
  orgId: string;
  displayName: string;
  country: string;
  railsAllowed: ("ACH" | "WIRE")[];
  bankLast4: string;
  status: string;
  createdAt: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export type WebhookConfig = {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  updatedAt?: string;
};

export class WireClient {
  private client: AxiosInstance;
  private config: WireConfig;

  constructor(config: WireConfig) {
    this.config = {
      baseUrl: config.baseUrl || "https://api.wire.pose.xyz",
      sandbox: config.sandbox || false,
      apiPrefix: config.apiPrefix ?? "/api/wire",
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        ...(this.buildAuthHeaders()),
        "Content-Type": "application/json",
      },
    });

    // Add request interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          throw new WireError(
            error.response.data?.error || "API request failed",
            error.response.status,
            error.response.data
          );
        }
        throw new WireError("Network error", 0, error.message);
      }
    );
  }

  private buildAuthHeaders(): Record<string, string> {
    // Wire2 backend supports:
    // - Authorization: ApiKey <key>                      (legacy / key-only)
    // - Authorization: Basic base64(<key>:<secret>)      (recommended when secret is present)
    if (this.config.apiSecret) {
      const token = Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`, "utf8").toString("base64");
      return { Authorization: `Basic ${token}` };
    }
    return { Authorization: `ApiKey ${this.config.apiKey}` };
  }

  private p(path: string): string {
    const prefix = this.config.apiPrefix ?? "/api/wire";
    const a = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    const b = path.startsWith("/") ? path : `/${path}`;
    return `${a}${b}`;
  }

  /**
   * Create a transfer intent
   */
  async createIntent(params: CreateIntentParams): Promise<Intent> {
    const response = await this.client.post(this.p("/intents"), params);
    return response.data;
  }

  /**
   * Get an intent by ID
   */
  async getIntent(intentId: string): Promise<Intent> {
    const response = await this.client.get(this.p(`/intents/${intentId}`));
    return response.data;
  }

  /**
   * List intents
   */
  async listIntents(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Intent[]> {
    const response = await this.client.get(this.p("/intents"), { params });
    return response.data;
  }

  /**
   * Create a beneficiary
   */
  async createBeneficiary(params: CreateBeneficiaryParams): Promise<Beneficiary> {
    const response = await this.client.post(this.p("/beneficiaries"), params);
    return response.data;
  }

  /**
   * List beneficiaries
   */
  async listBeneficiaries(): Promise<Beneficiary[]> {
    const response = await this.client.get(this.p("/beneficiaries"));
    return response.data;
  }

  /**
   * Create a voice challenge for an intent
   */
  async createChallenge(intentId: string, params?: { language?: "EN" | "ES" }): Promise<{ id: string; challengeText: string }> {
    const response = await this.client.post(this.p(`/intents/${intentId}/challenge`), {
      language: params?.language ?? "EN",
    });
    return response.data;
  }

  /**
   * Submit voice proof for a challenge (Node-friendly JSON mode)
   */
  async submitProof(params: {
    challengeId: string;
    audio: Buffer | string; // Buffer (preferred) or base64 string
    transcript: string;
    channel?: "BROWSER" | "PHONE";
    deviceMetadata?: Record<string, unknown>;
  }): Promise<{ id: string; verified?: boolean; scoresJson?: any }> {
    const audioBase64 = Buffer.isBuffer(params.audio)
      ? params.audio.toString("base64")
      : Buffer.from(params.audio, "base64").toString("base64");

    const response = await this.client.post(this.p(`/challenges/${params.challengeId}/proof`), {
      channel: params.channel ?? "BROWSER",
      transcript: params.transcript,
      deviceMetadataJson: {
        ...(params.deviceMetadata ?? {}),
        audioBuffer: audioBase64,
      },
    });
    return response.data;
  }

  /**
   * Create a decision (approve/deny/step-up) for an intent
   */
  async createDecision(
    intentId: string,
    params: { action: "APPROVE" | "DENY" | "STEP_UP"; proofId: string; reasonCodesJson?: string[] }
  ): Promise<{
    id: string;
    approvalToken?: string;
  }> {
    const response = await this.client.post(this.p(`/intents/${intentId}/decision`), params);
    return response.data;
  }

  /**
   * Mint a fresh execution token for an approved intent
   */
  async mintExecutionToken(intentId: string): Promise<{ approvalToken: string; expiresAt: string }> {
    const response = await this.client.post(this.p(`/intents/${intentId}/execution-token`), {});
    return response.data;
  }

  /**
   * Execute an intent (uses X-POSE-APPROVAL header; idempotency via X-Idempotency-Key)
   */
  async executeIntent(params: {
    intentId: string;
    approvalToken: string;
    idempotencyKey?: string;
  }): Promise<{ status: string; executionRef: string; ledgerId?: string }> {
    const response = await this.client.post(
      this.p(`/intents/${params.intentId}/execute`),
      {},
      {
        headers: {
          "X-POSE-APPROVAL": params.approvalToken,
          ...(params.idempotencyKey ? { "X-Idempotency-Key": params.idempotencyKey } : {}),
        },
      }
    );
    return response.data;
  }

  /**
   * Webhooks: list/create/test/deliveries/rotate-secret
   */
  async listWebhooks(): Promise<WebhookConfig[]> {
    const response = await this.client.get(this.p("/webhooks"));
    return response.data;
  }

  async createWebhook(params: { name: string; url: string; events: string[] }): Promise<{ id: string; secret: string }> {
    const response = await this.client.post(this.p("/webhooks"), params);
    return response.data;
  }

  async testWebhook(webhookId: string): Promise<{ success: boolean; deliveryId: string }> {
    const response = await this.client.post(this.p(`/webhooks/${webhookId}/test`), {});
    return response.data;
  }

  async listWebhookDeliveries(webhookId: string, limit: number = 25): Promise<any[]> {
    const response = await this.client.get(this.p(`/webhooks/${webhookId}/deliveries`), { params: { limit } });
    return response.data;
  }

  async rotateWebhookSecret(webhookId: string): Promise<{ secret: string }> {
    const response = await this.client.post(this.p(`/webhooks/${webhookId}/rotate-secret`), {});
    return response.data;
  }

  /**
   * Sandbox: reset deterministic dataset (requires SANDBOX_MODE + optional X-SANDBOX-ADMIN)
   */
  async sandboxReset(seed: string = "default"): Promise<any> {
    const headers: Record<string, string> = {};
    if (this.config.sandboxAdminToken) headers["X-SANDBOX-ADMIN"] = this.config.sandboxAdminToken;
    const response = await this.client.post("/api/sandbox/reset", { seed }, { headers });
    return response.data;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(params: {
    rawBody: string; // raw request body (string) exactly as received
    signatureHeader: string; // X-WIRE-Signature header value, e.g. "t=1700000000000,v1=..."
    secret: string; // whsec_...
    toleranceSeconds?: number; // default 300s
  }): boolean {
    const { rawBody, signatureHeader, secret } = params;
    const toleranceSeconds = params.toleranceSeconds ?? 300;

    const parsed = parseWireSignatureHeader(signatureHeader);
    if (!parsed) return false;

    const now = Date.now();
    if (Math.abs(now - parsed.timestamp) > toleranceSeconds * 1000) {
      return false;
    }

    const message = `${parsed.timestamp}.${rawBody}`;
    const expected = crypto.createHmac("sha256", secret).update(message, "utf8").digest("hex");
    return timingSafeEqualHex(parsed.signatureHex, expected);
  }
}

export class WireError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "WireError";
  }
}

// Export default instance factory
export function createWireClient(config: WireConfig): WireClient {
  return new WireClient(config);
}

// Export types
export type { WireConfig, CreateIntentParams, Intent, CreateBeneficiaryParams, Beneficiary };

function parseWireSignatureHeader(header: string): { timestamp: number; signatureHex: string } | null {
  // Format: "t=<ms>,v1=<hex>" (preferred) or legacy "t=<ms>,v0=<hex>"
  const parts = header.split(",").map((p) => p.trim()).filter(Boolean);
  const tPart = parts.find((p) => p.startsWith("t="));
  const v1Part = parts.find((p) => p.startsWith("v1="));
  const v0Part = parts.find((p) => p.startsWith("v0="));
  if (!tPart) return null;
  const timestamp = Number(tPart.slice(2));
  if (!Number.isFinite(timestamp)) return null;
  const sig = v1Part?.slice(3) ?? v0Part?.slice(3);
  if (!sig || !/^[0-9a-f]{64}$/i.test(sig)) return null;
  return { timestamp, signatureHex: sig.toLowerCase() };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
