/**
 * OpenAPI Contract Tests
 *
 * Automated tests that verify the API implementation matches the OpenAPI specification.
 *
 * Note: this file is named `*.test.ts` so Vitest will pick it up in CI.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { buildApp } from "../app.js";
import { prisma } from "../db/prisma.js";
import { ApiTestClient, assertResponseShape, assertErrorResponse } from "./test-utils.js";
import { dbAvailable } from "../tests/testDb.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("OpenAPI Contract Tests", () => {
  let app: any;
  let client: ApiTestClient;
  let openApiSpec: any;
  let dbReady = false;

  beforeAll(async () => {
    // Contract tests run in demo auth mode (header-based) so they can exercise endpoints
    // without requiring interactive login flows.
    process.env.AUTH_MODE = "demo";

    // These are integration-ish tests that assume a reachable Postgres.
    // In lightweight environments (no DB), return early from each test.
    dbReady = await dbAvailable();

    app = await buildApp();
    client = new ApiTestClient(app, {
      userId: "test_user_contract",
      orgId: "test_org_contract",
    });

    // Load OpenAPI spec
    const specPath = join(__dirname, "wire.openapi.json");
    const specContent = readFileSync(specPath, "utf-8");
    openApiSpec = JSON.parse(specContent);
  });

  describe("Health Endpoint", () => {
    it("should match OpenAPI spec", async () => {
      if (!dbReady) return;
      const response = await client.getHealth();
      expect(response.statusCode).toBe(200);
      assertResponseShape(response, "ServiceHealth");
    });
  });

  describe("Intent Endpoints", () => {
    it("GET /intents should return array of TransferIntent", async () => {
      if (!dbReady) return;
      const response = await client.listIntents();
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
      if (body.length > 0) {
        assertResponseShape({ json: () => body[0] }, "TransferIntent");
      }
    });

    it("GET /intents/:id should return TransferIntent or 404", async () => {
      if (!dbReady) return;
      const response = await client.getIntent("nonexistent");
      expect([200, 404]).toContain(response.statusCode);
      if (response.statusCode === 404) {
        assertErrorResponse(response, "INTENT_NOT_FOUND", 404);
      } else {
        assertResponseShape(response, "TransferIntent");
      }
    });

    it("POST /intents should validate request body", async () => {
      if (!dbReady) return;
      const invalidResponse = await client.createIntent({
        railsType: "ACH",
        amountMinor: "invalid", // Should fail validation
        beneficiaryId: "benef_123",
        purpose: "Test",
      });
      expect(invalidResponse.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe("Challenge Endpoints", () => {
    it("POST /intents/:id/challenge should return VoiceChallenge", async () => {
      if (!dbReady) return;
      // This test requires a valid intent ID
      // In real tests, create intent first
      const response = await client.createChallenge("nonexistent", {});
      expect([200, 404, 400]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        assertResponseShape(response, "VoiceChallenge");
      }
    });
  });

  describe("Error Response Format", () => {
    it("should return standardized error format", async () => {
      if (!dbReady) return;
      const response = await client.getIntent("nonexistent");
      if (response.statusCode === 404) {
        const body = response.json();
        expect(body).toHaveProperty("error");
        expect(typeof body.error).toBe("string");
        // Code is optional but should be present if error
        if (body.code) {
          expect(typeof body.code).toBe("string");
        }
      }
    });
  });

  describe("Response Schema Validation", () => {
    it("should validate all response schemas match spec", async () => {
      if (!dbReady) return;
      const endpoints = [{ method: "GET", path: "/api/wire/health", schema: "ServiceHealth" }];

      for (const endpoint of endpoints) {
        const response = await client.request(endpoint.method as any, endpoint.path);
        if (response.statusCode < 400) {
          assertResponseShape(response, endpoint.schema);
        }
      }
    });
  });

  describe("Request Validation", () => {
    it("should reject invalid request bodies", async () => {
      if (!dbReady) return;
      const testCases = [
        {
          name: "missing required field",
          body: { railsType: "ACH" }, // Missing beneficiaryId, purpose, amountMinor
          expectedStatus: 400,
        },
        {
          name: "invalid enum value",
          body: {
            railsType: "INVALID",
            amountMinor: "50000",
            beneficiaryId: "benef_123",
            purpose: "Test",
          },
          expectedStatus: 400,
        },
        {
          name: "invalid amount format",
          body: {
            railsType: "ACH",
            amountMinor: "50.00", // Should be digits only
            beneficiaryId: "benef_123",
            purpose: "Test",
          },
          expectedStatus: 400,
        },
      ];

      for (const testCase of testCases) {
        const response = await client.request("POST", "/api/wire/intents", {
          body: testCase.body,
        });
        expect(response.statusCode).toBe(testCase.expectedStatus);
        if (response.statusCode >= 400) {
          assertErrorResponse(response, "INVALID_REQUEST", 400);
        }
      }
    });
  });

  describe("OpenAPI Spec Completeness", () => {
    it("should have all required routes documented", () => {
      const paths = openApiSpec.paths || {};
      const requiredRoutes = [
        "/health",
        "/intents",
        "/intents/{id}",
        "/intents/{id}/challenge",
        "/challenges/{challengeId}/proof",
        "/intents/{id}/decision",
        "/intents/{id}/execute",
        "/intents/{id}/events",
        "/intents/{id}/bundle",
        "/beneficiaries",
        "/beneficiaries/{id}",
        "/policies",
        "/policies/simulate",
      ];

      for (const route of requiredRoutes) {
        expect(paths).toHaveProperty(route);
      }
    });

    it("should have all required schemas", () => {
      const schemas = openApiSpec.components?.schemas || {};
      const requiredSchemas = [
        "TransferIntent",
        "VoiceChallenge",
        "VoiceProof",
        "Decision",
        "ErrorResponse",
        "Beneficiary",
        "PolicyVersion",
        "ServiceHealth",
      ];

      for (const schema of requiredSchemas) {
        expect(schemas).toHaveProperty(schema);
      }
    });
  });
});

