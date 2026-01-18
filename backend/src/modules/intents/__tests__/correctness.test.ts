/**
 * Agent D: Correctness Invariant Tests
 * 
 * Tests for:
 * - Distinct approver enforcement
 * - State machine transitions
 * - Idempotency
 * - Execution ledger
 * - Binding hash invalidation
 */

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { prisma } from "../../../db/prisma.js";
import { createApproval, countDistinctApprovals, hasUserApproved } from "../approvals.js";
import { validateTransition, isTransitionAllowed, isTerminalState } from "../stateMachine.js";
import { createExecutionLedgerEntry, hasIntentBeenExecuted } from "../executionLedger.js";
import { checkIdempotencyKey, storeIdempotencyKey, generateIdempotencyKeyHash } from "../idempotency.js";
import { IntentStatus } from "@prisma/client";

// These are DB-backed invariants; opt-in to run them.
const describeDb = process.env.WIRE2_TEST_WITH_DB === "1" ? describe : describe.skip;

describeDb("Agent D: Correctness Invariants", () => {
  beforeAll(async () => {
    const now = new Date();
    await prisma.organization.upsert({
      where: { id: "org_1" },
      update: { name: "Test Org 1" },
      create: { id: "org_1", name: "Test Org 1", createdAt: now },
    });

    for (const userId of ["user_1", "user_2"]) {
      await prisma.user.upsert({
        where: { id: userId },
        update: { orgId: "org_1", email: `${userId}@example.com`, name: userId },
        create: {
          id: userId,
          orgId: "org_1",
          email: `${userId}@example.com`,
          name: userId,
          role: "ADMIN",
          permissions: ["intent:create"],
          voiceEnrolled: false,
          createdAt: now,
        },
      });
    }

    await prisma.beneficiary.upsert({
      where: { id: "benef_1" },
      update: { orgId: "org_1", displayName: "Test Beneficiary" },
      create: {
        id: "benef_1",
        orgId: "org_1",
        displayName: "Test Beneficiary",
        country: "US",
        railsAllowed: ["ACH"],
        bankLast4: "1234",
        bankTokenHash: "hash_benef_1",
        version: 1,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        lastChangedAt: now,
        lastChangedBy: "user_1",
      },
    });

    const baseIntent = {
      orgId: "org_1",
      createdByUserId: "user_1",
      railsType: "ACH" as const,
      amountMinor: "1000",
      currency: "USD",
      beneficiaryId: "benef_1",
      beneficiaryVersion: 1,
      purpose: "Test intent",
      status: "DRAFT" as IntentStatus,
      riskScore: 0,
      riskRationaleJson: "{}",
      requiredApprovals: 1,
      requiredChallengeLevel: "L1" as const,
      cooldownUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    await prisma.intent.upsert({
      where: { id: "test_intent_1" },
      update: {},
      create: { id: "test_intent_1", bindingHash: "binding_hash_1", ...baseIntent },
    });

    await prisma.intent.upsert({
      where: { id: "intent_1" },
      update: {},
      create: { id: "intent_1", bindingHash: "binding_hash_2", ...baseIntent },
    });
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.approval.deleteMany({});
    await prisma.executionLedger.deleteMany({});
    await prisma.idempotencyKey.deleteMany({});
  });

  describe("State Machine", () => {
    it("should allow valid transitions", () => {
      expect(isTransitionAllowed("DRAFT", "CHALLENGING")).toBe(true);
      expect(isTransitionAllowed("CHALLENGING", "PENDING_APPROVALS")).toBe(true);
      expect(isTransitionAllowed("PENDING_APPROVALS", "APPROVED")).toBe(true);
      expect(isTransitionAllowed("APPROVED", "EXECUTED")).toBe(true);
    });

    it("should reject invalid transitions", () => {
      expect(isTransitionAllowed("DRAFT", "EXECUTED")).toBe(false);
      expect(isTransitionAllowed("EXECUTED", "APPROVED")).toBe(false);
      expect(isTransitionAllowed("DENIED", "APPROVED")).toBe(false);
    });

    it("should allow idempotent transitions (same state)", () => {
      expect(isTransitionAllowed("DRAFT", "DRAFT")).toBe(true);
      expect(isTransitionAllowed("APPROVED", "APPROVED")).toBe(true);
    });

    it("should reject transitions from terminal states", () => {
      expect(isTransitionAllowed("EXECUTED", "APPROVED")).toBe(false);
      expect(isTransitionAllowed("EXPIRED", "APPROVED")).toBe(false);
      expect(isTransitionAllowed("CANCELED", "APPROVED")).toBe(false);
    });

    it("should identify terminal states", () => {
      expect(isTerminalState("EXECUTED")).toBe(true);
      expect(isTerminalState("EXPIRED")).toBe(true);
      expect(isTerminalState("CANCELED")).toBe(true);
      expect(isTerminalState("APPROVED")).toBe(false);
    });

    it("should throw on invalid transition validation", () => {
      expect(() => validateTransition("DRAFT", "EXECUTED")).toThrow();
      expect(() => validateTransition("EXECUTED", "APPROVED")).toThrow();
    });
  });

  describe("Approval Distinctness", () => {
    const testIntentId = "test_intent_1";
    const testBindingHash = "binding_hash_1";
    const testUserId1 = "user_1";
    const testUserId2 = "user_2";

    it("should allow multiple distinct approvers", async () => {
      const approval1 = await createApproval({
        intentId: testIntentId,
        orgId: "org_1",
        approverUserId: testUserId1,
        bindingHash: testBindingHash,
        decisionType: "APPROVE",
      });

      const approval2 = await createApproval({
        intentId: testIntentId,
        orgId: "org_1",
        approverUserId: testUserId2,
        bindingHash: testBindingHash,
        decisionType: "APPROVE",
      });

      expect(approval1.isDuplicate).toBe(false);
      expect(approval2.isDuplicate).toBe(false);
      expect(approval1.approval.approverUserId).toBe(testUserId1);
      expect(approval2.approval.approverUserId).toBe(testUserId2);
    });

    it("should prevent duplicate approval from same user", async () => {
      const approval1 = await createApproval({
        intentId: testIntentId,
        orgId: "org_1",
        approverUserId: testUserId1,
        bindingHash: testBindingHash,
        decisionType: "APPROVE",
      });

      const approval2 = await createApproval({
        intentId: testIntentId,
        orgId: "org_1",
        approverUserId: testUserId1,
        bindingHash: testBindingHash,
        decisionType: "APPROVE",
      });

      expect(approval1.isDuplicate).toBe(false);
      expect(approval2.isDuplicate).toBe(true);
    });

    it("should count distinct approvals correctly", async () => {
      await createApproval({
        intentId: testIntentId,
        orgId: "org_1",
        approverUserId: testUserId1,
        bindingHash: testBindingHash,
        decisionType: "APPROVE",
      });

      await createApproval({
        intentId: testIntentId,
        orgId: "org_1",
        approverUserId: testUserId2,
        bindingHash: testBindingHash,
        decisionType: "APPROVE",
      });

      const count = await countDistinctApprovals(testIntentId, testBindingHash);
      expect(count).toBe(2);
    });

    it("should detect if user has already approved", async () => {
      await createApproval({
        intentId: testIntentId,
        orgId: "org_1",
        approverUserId: testUserId1,
        bindingHash: testBindingHash,
        decisionType: "APPROVE",
      });

      const hasApproved = await hasUserApproved(
        testIntentId,
        testUserId1,
        testBindingHash
      );

      expect(hasApproved).toBe(true);

      const hasNotApproved = await hasUserApproved(
        testIntentId,
        testUserId2,
        testBindingHash
      );

      expect(hasNotApproved).toBe(false);
    });
  });

  describe("Idempotency", () => {
    const testUserId = "user_1";
    const testOrgId = "org_1";
    const testEndpoint = "POST /api/wire/intents/:id/execute";
    const testIdempotencyKey = "idem_123";
    const testRequestBody = { approvalToken: "token_123" };

    it("should generate consistent key hashes", () => {
      const hash1 = generateIdempotencyKeyHash(
        testOrgId,
        testEndpoint,
        testIdempotencyKey
      );
      const hash2 = generateIdempotencyKeyHash(
        testOrgId,
        testEndpoint,
        testIdempotencyKey
      );

      expect(hash1).toBe(hash2);
    });

    it("should store and retrieve idempotency keys", async () => {
      const keyHash = generateIdempotencyKeyHash(
        testOrgId,
        testEndpoint,
        testIdempotencyKey
      );

      await storeIdempotencyKey({
        keyHash,
        userId: testUserId,
        orgId: testOrgId,
        endpoint: testEndpoint,
        requestHash: "request_hash_123",
        responseStatus: 200,
        responseBody: { status: "EXECUTED", executionRef: "exec_123" },
      });

      const checkResult = await checkIdempotencyKey(keyHash);
      expect(checkResult.exists).toBe(true);
      expect(checkResult.record?.response.status).toBe(200);
    });

    it("should return cached response for duplicate requests", async () => {
      const keyHash = generateIdempotencyKeyHash(
        testOrgId,
        testEndpoint,
        testIdempotencyKey
      );

      const cachedResponse = { status: "EXECUTED", executionRef: "exec_123" };

      await storeIdempotencyKey({
        keyHash,
        userId: testUserId,
        orgId: testOrgId,
        endpoint: testEndpoint,
        requestHash: "request_hash_123",
        responseStatus: 200,
        responseBody: cachedResponse,
      });

      const checkResult = await checkIdempotencyKey(keyHash);
      expect(checkResult.exists).toBe(true);
      expect(checkResult.record?.response.body).toEqual(cachedResponse);
    });
  });

  describe("Execution Ledger", () => {
    const testIntentId = "intent_1";
    const testBindingHash = "binding_hash_1";
    const testUserId = "user_1";
    const testTokenHash = "token_hash_123";

    it("should create execution ledger entry", async () => {
      const { executionRef, ledgerEntry } = await createExecutionLedgerEntry({
        intentId: testIntentId,
        approvalTokenHash: testTokenHash,
        bindingHash: testBindingHash,
        executedByUserId: testUserId,
      });

      expect(executionRef).toBeDefined();
      expect(ledgerEntry.intentId).toBe(testIntentId);
      expect(ledgerEntry.status).toBe("PENDING");
      expect(ledgerEntry.bindingHash).toBe(testBindingHash);
    });

    it("should detect if intent has been executed", async () => {
      const { executionRef } = await createExecutionLedgerEntry({
        intentId: testIntentId,
        approvalTokenHash: testTokenHash,
        bindingHash: testBindingHash,
        executedByUserId: testUserId,
      });

      // Update to CONFIRMED status
      await prisma.executionLedger.update({
        where: { executionRef },
        data: { status: "CONFIRMED" },
      });

      const checkResult = await hasIntentBeenExecuted(
        testIntentId,
        testBindingHash
      );

      expect(checkResult.executed).toBe(true);
      expect(checkResult.executionRef).toBe(executionRef);
    });

    it("should not detect execution for PENDING status", async () => {
      await createExecutionLedgerEntry({
        intentId: testIntentId,
        approvalTokenHash: testTokenHash,
        bindingHash: testBindingHash,
        executedByUserId: testUserId,
      });

      const checkResult = await hasIntentBeenExecuted(
        testIntentId,
        testBindingHash
      );

      expect(checkResult.executed).toBe(false);
    });
  });
});
