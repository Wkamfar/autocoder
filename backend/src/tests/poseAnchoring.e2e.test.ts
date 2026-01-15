import { describe, expect, it, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { prisma } from "../db/prisma.js";
import { dbAvailable } from "./testDb.js";
import { appendIntentEvent } from "../modules/evidence/eventChain.js";
import { enqueueJob, claimDueJobs, markJobSucceeded } from "../jobs/jobQueue.js";
import { JOB_TYPES } from "../jobs/jobTypes.js";
import { processPoseAnchorIntentEventJob } from "../modules/pose/poseAnchoring.js";

// End-to-end-ish test for Agent 11 anchoring pipeline:
// IntentEvent -> enqueue job -> worker handler calls POSE Core -> txHash persisted on IntentEvent.
// Requires reachable Postgres (same convention as other e2e tests).

function makeStubPoseCore() {
  const calls: any[] = [];
  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    if (req.method === "GET" && url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "POST" && url === "/api/pose/anchors/intent-event") {
      let body = "";
      req.on("data", (c) => (body += String(c)));
      req.on("end", () => {
        const parsed = body ? JSON.parse(body) : {};
        calls.push(parsed);
        // Deterministic fake tx hash for tests.
        const hex = Buffer.from(JSON.stringify(parsed)).toString("hex").slice(0, 64).padEnd(64, "0");
        const txHash = `0x${hex}`;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, txHash, contract: "0x" + "1".repeat(40) }));
      });
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  return { server, calls };
}

describe("Agent 11: POSE anchoring job", () => {
  let server: http.Server | null = null;
  let port = 0;
  const stub = makeStubPoseCore();

  beforeAll(async () => {
    if (!(await dbAvailable())) return;

    server = stub.server;
    await new Promise<void>((resolve) => {
      server!.listen(0, "127.0.0.1", () => {
        const addr = server!.address() as any;
        port = Number(addr.port);
        resolve();
      });
    });

    process.env.POSE_ANCHORING_ENABLED = "true";
    process.env.POSE_CORE_HEALTH_URL = `http://127.0.0.1:${port}/health`;
    process.env.POSE_ANCHOR_API_URL = `http://127.0.0.1:${port}/api/pose/anchors/intent-event`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    delete process.env.POSE_ANCHORING_ENABLED;
    delete process.env.POSE_CORE_HEALTH_URL;
    delete process.env.POSE_ANCHOR_API_URL;
  });

  it("anchors an intent event and persists poseAnchorTxHash", async () => {
    if (!(await dbAvailable())) {
      expect(true).toBe(true);
      return;
    }

    const ts = Date.now();
    const orgId = `org_${ts}`;
    const userId = `user_${ts}`;
    const beneficiaryId = `ben_${ts}`;
    const intentId = `intent_${ts}`;

    // Minimal fixtures (satisfy composite FKs)
    await prisma.organization.create({ data: { id: orgId, name: "Test Org", createdAt: new Date() } });
    await prisma.user.create({
      data: {
        id: userId,
        orgId,
        email: `a${ts}@example.com`,
        name: "Test",
        role: "ADMIN",
        permissions: [],
        voiceEnrolled: false,
        createdAt: new Date(),
      } as any,
    });
    await prisma.beneficiary.create({
      data: {
        id: beneficiaryId,
        orgId,
        displayName: "Test Beneficiary",
        country: "US",
        railsAllowed: ["WIRE"],
        bankLast4: "1234",
        bankTokenHash: "hash_" + ts,
        version: 1,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastChangedAt: new Date(),
        lastChangedBy: userId,
      } as any,
    });
    await prisma.intent.create({
      data: {
        id: intentId,
        orgId,
        createdByUserId: userId,
        railsType: "WIRE",
        amountMinor: "1000",
        currency: "USD",
        beneficiaryId,
        beneficiaryVersion: 1,
        purpose: "Test",
        status: "DRAFT",
        riskScore: 0,
        riskRationaleJson: "{}",
        requiredApprovals: 1,
        requiredChallengeLevel: "L1",
        bindingHash: "binding_" + ts,
        cooldownUntil: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    });

    const ev = await appendIntentEvent({
      orgId,
      intentId,
      eventType: "intent.created",
      payload: { intentId },
      createdByUserId: userId,
      createdAt: new Date(),
    });

    await enqueueJob({
      type: JOB_TYPES.POSE_ANCHOR_INTENT_EVENT,
      payload: {
        orgId,
        intentId,
        seq: ev.seq,
        eventType: ev.eventType,
        eventHash: `0x${ev.eventHash}`,
        prevEventHash: ev.prevHash ? `0x${ev.prevHash}` : null,
      },
      uniqueKey: `pose_anchor:${orgId}:${intentId}:${ev.seq}:${ev.eventHash}`,
      maxAttempts: 2,
    });

    const jobs = await claimDueJobs({ limit: 10, workerId: "test_worker" });
    expect(jobs.length).toBeGreaterThan(0);

    for (const j of jobs) {
      const payload = JSON.parse(j.payloadJson || "{}");
      await processPoseAnchorIntentEventJob({ jobId: j.id, payload });
      await markJobSucceeded(j.id);
    }

    expect(stub.calls.length).toBeGreaterThan(0);

    const updated = await prisma.intentEvent.findFirst({ where: { intentId, orgId, seq: ev.seq } });
    expect(updated?.poseAnchorTxHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(updated?.poseAnchoredAt).toBeTruthy();
    expect(updated?.poseAnchorLastError).toBeNull();
  });
});

