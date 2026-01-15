/**
 * API Testing Utilities
 * 
 * Helper functions for testing API endpoints against the OpenAPI specification.
 * Ensures tests match the documented contract.
 */

import type { FastifyInstance } from "fastify";
import { expect } from "vitest";

export interface ApiTestConfig {
  baseUrl?: string;
  userId?: string;
  orgId?: string;
}

export class ApiTestClient {
  constructor(
    private app: FastifyInstance,
    private config: ApiTestConfig = {}
  ) {}

  /**
   * Make authenticated request
   */
  async request(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    options: {
      body?: any;
      headers?: Record<string, string>;
      userId?: string;
    } = {}
  ) {
    const headers = {
      "X-USER-ID": options.userId || this.config.userId || "test_user",
      ...(this.config.orgId ? { "X-ORG-ID": this.config.orgId } : {}),
      ...options.headers,
    };

    const url = path.startsWith("/") ? path : `/${path}`;

    if (method === "GET" || method === "DELETE") {
      return this.app.inject({
        method,
        url,
        headers,
      });
    } else {
      return this.app.inject({
        method,
        url,
        headers: {
          ...headers,
          "content-type": "application/json",
        },
        payload: options.body,
      });
    }
  }

  /**
   * Health check
   */
  async getHealth() {
    return this.request("GET", "/api/wire/health");
  }

  /**
   * Intent operations
   */
  async listIntents(userId?: string) {
    return this.request("GET", "/api/wire/intents", { userId });
  }

  async getIntent(intentId: string, userId?: string) {
    return this.request("GET", `/api/wire/intents/${intentId}`, { userId });
  }

  async createIntent(
    data: {
      railsType: "ACH" | "WIRE";
      amountMinor: string;
      currency?: string;
      beneficiaryId: string;
      purpose: string;
    },
    userId?: string
  ) {
    return this.request("POST", "/api/wire/intents", {
      body: data,
      userId,
    });
  }

  async updateIntent(
    intentId: string,
    data: {
      beneficiaryId?: string;
      purpose?: string;
      amountMinor?: string;
      railsType?: "ACH" | "WIRE";
    },
    userId?: string
  ) {
    return this.request("PATCH", `/api/wire/intents/${intentId}`, {
      body: data,
      userId,
    });
  }

  /**
   * Challenge operations
   */
  async createChallenge(
    intentId: string,
    data: { language?: "EN" | "ES" } = {},
    userId?: string
  ) {
    return this.request("POST", `/api/wire/intents/${intentId}/challenge`, {
      body: data,
      userId,
    });
  }

  async submitProof(
    challengeId: string,
    data: {
      channel?: "BROWSER" | "PHONE";
      transcript: string;
      transcriptLanguage?: string | null;
      deviceMetadataJson?: Record<string, unknown>;
    },
    userId?: string
  ) {
    return this.request("POST", `/api/wire/challenges/${challengeId}/proof`, {
      body: data,
      userId,
    });
  }

  /**
   * Decision operations
   */
  async createDecision(
    intentId: string,
    data: {
      action: "APPROVE" | "DENY" | "STEP_UP";
      proofId: string;
      reasonCodesJson?: string[];
    },
    userId?: string
  ) {
    return this.request("POST", `/api/wire/intents/${intentId}/decision`, {
      body: data,
      userId,
    });
  }

  /**
   * Execution
   */
  async executeIntent(
    intentId: string,
    approvalToken: string,
    userId?: string
  ) {
    return this.request("POST", `/api/wire/intents/${intentId}/execute`, {
      headers: {
        "X-POSE-APPROVAL": approvalToken,
      },
      userId,
    });
  }

  /**
   * Events
   */
  async listIntentEvents(intentId: string, userId?: string) {
    return this.request("GET", `/api/wire/intents/${intentId}/events`, {
      userId,
    });
  }

  /**
   * Bundles
   */
  async generateAuditBundle(intentId: string, userId?: string) {
    return this.request("POST", `/api/wire/intents/${intentId}/bundle`, {
      userId,
    });
  }

  /**
   * Beneficiary operations
   */
  async listBeneficiaries(userId?: string) {
    return this.request("GET", "/api/wire/beneficiaries", { userId });
  }

  async createBeneficiary(
    data: {
      displayName: string;
      country: string;
      railsAllowed: ("ACH" | "WIRE")[];
      bankLast4: string;
      bankTokenHash: string;
    },
    userId?: string
  ) {
    return this.request("POST", "/api/wire/beneficiaries", {
      body: data,
      userId,
    });
  }

  async updateBeneficiary(
    beneficiaryId: string,
    data: {
      displayName?: string;
      country?: string;
      railsAllowed?: ("ACH" | "WIRE")[];
      bankLast4?: string;
      bankTokenHash?: string;
      status?: "ACTIVE" | "LOCKED" | "PENDING_VERIFICATION";
    },
    userId?: string
  ) {
    return this.request("PATCH", `/api/wire/beneficiaries/${beneficiaryId}`, {
      body: data,
      userId,
    });
  }

  /**
   * Policy operations
   */
  async getActivePolicy(userId?: string) {
    return this.request("GET", "/api/wire/policies", { userId });
  }

  async createPolicyVersion(
    data: {
      policyId?: string;
      thresholds: {
        amountStepUpMinor: string;
        dualApprovalRiskScore: number;
        criticalRiskScore: number;
        newBeneficiaryDays: number;
        outOfHoursStartHourLocal: number;
        outOfHoursEndHourLocal: number;
      };
      rules: {
        requireDualApprovalForInternationalWire: boolean;
        requirePhoneForL3IfMicDenied: boolean;
        cooldownMinutesForHighRisk: number;
        lockoutAfterFailedAttempts: number;
      };
    },
    userId?: string
  ) {
    return this.request("POST", "/api/wire/policies", {
      body: data,
      userId,
    });
  }

  async simulatePolicy(
    data: {
      railsType: "ACH" | "WIRE";
      amountMinor: string;
      beneficiaryId: string;
    },
    userId?: string
  ) {
    return this.request("POST", "/api/wire/policies/simulate", {
      body: data,
      userId,
    });
  }
}

/**
 * Assert response matches OpenAPI schema
 */
export function assertResponseShape(
  response: any,
  expectedSchema: string,
  context?: string
) {
  if (response.statusCode >= 400) {
    // Error response
    expect(response.json()).toHaveProperty("error");
    expect(response.json()).toMatchObject({
      error: expect.any(String),
    });
    return;
  }

  // Success response
  const body = response.json();
  expect(body).toBeDefined();

  // Basic shape validation based on schema name
  switch (expectedSchema) {
    case "TransferIntent":
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("amountMinor");
      expect(body).toHaveProperty("railsType");
      break;
    case "VoiceChallenge":
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("challengeText");
      expect(body).toHaveProperty("level");
      break;
    case "VoiceProof":
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("transcript");
      expect(body).toHaveProperty("scoresJson");
      break;
    case "Decision":
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("decisionType");
      expect(body).toHaveProperty("intentId");
      break;
    case "Beneficiary":
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("displayName");
      expect(body).toHaveProperty("country");
      break;
    case "PolicyVersion":
      expect(body).toHaveProperty("policyId");
      expect(body).toHaveProperty("version");
      expect(body).toHaveProperty("thresholds");
      break;
    case "ServiceHealth":
      expect(body).toHaveProperty("voiceService");
      expect(body).toHaveProperty("phoneService");
      expect(body).toHaveProperty("storageService");
      break;
  }
}

/**
 * Assert error response format
 */
export function assertErrorResponse(
  response: any,
  expectedCode?: string,
  expectedStatus?: number
) {
  expect(response.statusCode).toBeGreaterThanOrEqual(400);
  if (expectedStatus) {
    expect(response.statusCode).toBe(expectedStatus);
  }

  const body = response.json();
  expect(body).toHaveProperty("error");
  expect(typeof body.error).toBe("string");

  if (expectedCode) {
    expect(body.code).toBe(expectedCode);
  }
}

/**
 * Helper to extract approval token from decision response
 */
export function extractApprovalToken(response: any): string | null {
  const body = response.json();
  return body.approvalToken || null;
}

/**
 * Helper to extract intent ID from create response
 */
export function extractIntentId(response: any): string | null {
  const body = response.json();
  return body.id || null;
}

/**
 * Helper to extract beneficiary ID from create response
 */
export function extractBeneficiaryId(response: any): string | null {
  const body = response.json();
  return body.id || null;
}

/**
 * Helper to extract challenge ID from create response
 */
export function extractChallengeId(response: any): string | null {
  const body = response.json();
  return body.id || null;
}

/**
 * Helper to extract proof ID from create response
 */
export function extractProofId(response: any): string | null {
  const body = response.json();
  return body.id || null;
}
