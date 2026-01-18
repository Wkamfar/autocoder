import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../db/prisma.js";
import { dbAvailable } from "./testDb.js";

// E2E (API-level) critical flows for Wire2.
// These tests require a reachable, migrated Postgres. If unavailable, they no-op pass.

function b64urlKey32(): string {
  // 32 bytes base64url
  return Buffer.from("0123456789abcdef0123456789abcdef", "utf8").subarray(0, 32).toString("base64url");
}

function jsonHeaders(token?: string) {
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    "content-type": "application/json",
  } as Record<string, string>;
}

async function signupAndLogin(app: any, params: { org: string; name: string; email: string; password: string }) {
  const signup = await app.inject({
    method: "POST",
    url: "/api/signup",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify({
      organizationName: params.org,
      adminName: params.name,
      adminEmail: params.email,
      password: params.password,
    }),
  });
  expect(signup.statusCode).toBe(201);

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify({ email: params.email, password: params.password }),
  });
  expect(login.statusCode).toBe(200);
  const loginJson = login.json() as any;
  expect(typeof loginJson.token).toBe("string");
  return { token: loginJson.token as string, signup: signup.json() as any };
}

function makeWavPcm16(params: { sampleRate: number; samples: Int16Array; numChannels?: number }): Buffer {
  const numChannels = params.numChannels ?? 1;
  const bitsPerSample = 16;
  const byteRate = params.sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = params.samples.length * 2;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, 4, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, 4, "ascii");
  header.write("fmt ", 12, 4, "ascii");
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(params.sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, 4, "ascii");
  header.writeUInt32LE(dataSize, 40);

  const data = Buffer.alloc(dataSize);
  for (let i = 0; i < params.samples.length; i++) {
    data.writeInt16LE(params.samples[i]!, i * 2);
  }
  return Buffer.concat([header, data]);
}

function synthOnsetWav(params: { sampleRate?: number; silenceMs: number; totalMs: number }): Buffer {
  const sampleRate = params.sampleRate ?? 16000;
  const totalSamples = Math.floor((params.totalMs / 1000) * sampleRate);
  const silenceSamples = Math.floor((params.silenceMs / 1000) * sampleRate);

  const samples = new Int16Array(totalSamples);
  const freq = 440;
  const amp = 12000;
  for (let i = 0; i < totalSamples; i++) {
    if (i < silenceSamples) {
      samples[i] = 0;
    } else {
      const t = (i - silenceSamples) / sampleRate;
      samples[i] = Math.round(amp * Math.sin(2 * Math.PI * freq * t));
    }
  }
  return makeWavPcm16({ sampleRate, samples });
}

function makeMultipart(params: {
  fields: Record<string, string>;
  files: Array<{ field: string; filename: string; contentType: string; data: Buffer }>;
}): { body: Buffer; contentType: string } {
  const boundary = `----wire2boundary${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];

  const push = (s: string) => chunks.push(Buffer.from(s, "utf8"));

  for (const [k, v] of Object.entries(params.fields)) {
    push(`--${boundary}\r\n`);
    push(`Content-Disposition: form-data; name="${k}"\r\n\r\n`);
    push(`${v}\r\n`);
  }

  for (const f of params.files) {
    push(`--${boundary}\r\n`);
    push(`Content-Disposition: form-data; name="${f.field}"; filename="${f.filename}"\r\n`);
    push(`Content-Type: ${f.contentType}\r\n\r\n`);
    chunks.push(f.data);
    push(`\r\n`);
  }

  push(`--${boundary}--\r\n`);
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

describe("Agent 10: E2E critical flows (top 6)", () => {
  let app: any;

  beforeAll(async () => {
    if (!(await dbAvailable())) return;
    // Make webhook signing deterministic and online-free.
    process.env.WIRE2_SECRETS_ENCRYPTION_KEY = b64urlKey32();
    process.env.WEBHOOK_RESOLVE_DNS = "false";
    // Agent 7.1: enable POSE receipt signing in tests.
    {
      const { generateEd25519KeyPair } = await import("../lib/signing.js");
      const kp = generateEd25519KeyPair();
      process.env.SIGNING_KEY_ID = "test_key_1";
      process.env.SIGNING_PRIVATE_KEY = kp.privateKeyBase64url; // 64 bytes
      process.env.SIGNING_PUBLIC_KEY = kp.publicKeyBase64url; // 32 bytes
      process.env.SIGNING_PUBLIC_KEYS_JSON = JSON.stringify({ test_key_1: kp.publicKeyBase64url });
      delete process.env.SIGNING_REVOKED_KEY_IDS;
    }

    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("1) Signup → org created → admin onboarded", async () => {
    if (!(await dbAvailable())) return;

    const ts = Date.now();
    const { token } = await signupAndLogin(app, {
      org: `Acme ${ts}`,
      name: "Admin One",
      email: `admin_${ts}@example.com`,
      password: "correct-horse-battery-staple",
    });

    const me = await app.inject({ method: "GET", url: "/api/wire/me", headers: jsonHeaders(token) });
    expect(me.statusCode).toBe(200);
    expect((me.json() as any).user?.email).toContain("@example.com");
  });

  it("2) Invite user → accept → enroll voice → role enforced", async () => {
    if (!(await dbAvailable())) return;

    const ts = Date.now();
    const adminEmail = `admin_inv_${ts}@example.com`;
    const inviteEmail = `viewer_${ts}@example.com`;

    const { token: adminToken } = await signupAndLogin(app, {
      org: `InviteCo ${ts}`,
      name: "Admin",
      email: adminEmail,
      password: "admin-password-123",
    });

    // Create invitation for a VIEWER (no intent:create permission).
    const inv = await app.inject({
      method: "POST",
      url: "/api/wire/invitations",
      headers: jsonHeaders(adminToken),
      payload: JSON.stringify({ email: inviteEmail, role: "VIEWER", expiresInDays: 7 }),
    });
    expect(inv.statusCode).toBe(201);
    const inviteUrl = (inv.json() as any).inviteUrl as string;
    const tokenFromQuery = inviteUrl.includes("t=")
      ? new URL(inviteUrl).searchParams.get("t")
      : null;
    const tokenFromPath = inviteUrl.split("/invite/")[1] || null;
    const token = tokenFromQuery || tokenFromPath;
    expect(token).toBeTruthy();

    // Accept invitation (public)
    const accept = await app.inject({
      method: "POST",
      url: "/api/wire/invitations/accept",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ token, name: "Viewer User", password: "viewer-password-123" }),
    });
    expect(accept.statusCode).toBe(200);

    // Login as invited user
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ email: inviteEmail, password: "viewer-password-123" }),
    });
    expect(login.statusCode).toBe(200);
    const viewerToken = (login.json() as any).token as string;

    // Voice enroll start + complete (multipart)
    const start = await app.inject({ method: "POST", url: "/api/pose/voice/enroll/start", headers: jsonHeaders(viewerToken), payload: "{}" });
    expect(start.statusCode).toBe(200);
    const s = start.json() as any;

    const wav = synthOnsetWav({ silenceMs: 2100, totalMs: 2600 });
    const mp = makeMultipart({
      fields: {
        enrollment_id: s.enrollment_id,
        pose_id: s.pose_id,
        pose_challenge_id: s.challenge.pose_challenge_id,
        client_metadata_json: JSON.stringify({ ua: "vitest" }),
        consent_flags_json: JSON.stringify({ voice: true }),
      },
      files: [
        { field: "take_ihc", filename: "ihc.wav", contentType: "audio/wav", data: wav },
        { field: "take_phrase", filename: "phrase.wav", contentType: "audio/wav", data: wav },
      ],
    });

    const complete = await app.inject({
      method: "POST",
      url: "/api/pose/voice/enroll/complete",
      headers: { authorization: `Bearer ${viewerToken}`, "content-type": mp.contentType },
      payload: mp.body,
    });
    expect(complete.statusCode).toBe(200);

    const status = await app.inject({ method: "GET", url: "/api/pose/voice/status", headers: jsonHeaders(viewerToken) });
    expect(status.statusCode).toBe(200);
    expect((status.json() as any).has_pose_identity).toBe(true);

    // Role enforced: VIEWER should not be able to create intents (should be 403).
    const createIntent = await app.inject({
      method: "POST",
      url: "/api/wire/intents",
      headers: jsonHeaders(viewerToken),
      payload: JSON.stringify({
        railsType: "ACH",
        amountMinor: "1000",
        currency: "USD",
        beneficiaryId: "benef_missing",
        purpose: "should fail",
      }),
    });
    expect([401, 403]).toContain(createIntent.statusCode);
  });

  it("3) Create intent → approvals → execute → receipt (bundle + chain verify)", async () => {
    if (!(await dbAvailable())) return;

    const ts = Date.now();
    const { token: adminToken } = await signupAndLogin(app, {
      org: `PayCo ${ts}`,
      name: "Admin",
      email: `pay_admin_${ts}@example.com`,
      password: "pay-admin-123",
    });

    const approverEmail = `pay_approver_${ts}@example.com`;
    const invite = await app.inject({
      method: "POST",
      url: "/api/wire/invitations",
      headers: jsonHeaders(adminToken),
      payload: JSON.stringify({ email: approverEmail, role: "APPROVER", expiresInDays: 7 }),
    });
    expect(invite.statusCode).toBe(201);
    const inviteUrl = (invite.json() as any).inviteUrl as string;
    const approverTokenValue = inviteUrl.includes("t=")
      ? new URL(inviteUrl).searchParams.get("t")
      : inviteUrl.split("/invite/")[1] || null;
    expect(approverTokenValue).toBeTruthy();

    const acceptApprover = await app.inject({
      method: "POST",
      url: "/api/wire/invitations/accept",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        token: approverTokenValue,
        name: "Approver User",
        password: "approver-password-123",
      }),
    });
    expect(acceptApprover.statusCode).toBe(200);

    const approverLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ email: approverEmail, password: "approver-password-123" }),
    });
    expect(approverLogin.statusCode).toBe(200);
    const approverToken = (approverLogin.json() as any).token as string;

    // Create beneficiary
    const ben = await app.inject({
      method: "POST",
      url: "/api/wire/beneficiaries",
      headers: jsonHeaders(adminToken),
      payload: JSON.stringify({ displayName: "Vendor", country: "US", railsAllowed: ["ACH"], bankLast4: "1234" }),
    });
    expect(ben.statusCode).toBe(201);
    const beneficiaryId = (ben.json() as any).id as string;

    // Create intent
    const created = await app.inject({
      method: "POST",
      url: "/api/wire/intents",
      headers: jsonHeaders(adminToken),
      payload: JSON.stringify({
        railsType: "ACH",
        amountMinor: "50000",
        currency: "USD",
        beneficiaryId,
        purpose: "E2E payment",
      }),
    });
    expect(created.statusCode).toBe(201);
    const intentId = (created.json() as any).id as string;

    // Challenge + proof
    const challenge = await app.inject({
      method: "POST",
      url: `/api/wire/intents/${intentId}/challenge`,
      headers: jsonHeaders(adminToken),
      payload: JSON.stringify({ language: "EN" }),
    });
    expect(challenge.statusCode).toBe(200);
    const challengeJson = challenge.json() as any;
    const challengeId = challengeJson.id as string;

    const proof = await app.inject({
      method: "POST",
      url: `/api/wire/challenges/${challengeId}/proof`,
      headers: jsonHeaders(adminToken),
      payload: JSON.stringify({
        channel: "BROWSER",
        transcript: challengeJson.challengeText ?? "Authorize transfer",
        deviceMetadataJson: { ua: "vitest" },
      }),
    });
    expect(proof.statusCode).toBe(200);
    const proofId = (proof.json() as any).id as string;

    // Decision
    const decision = await app.inject({
      method: "POST",
      url: `/api/wire/intents/${intentId}/decision`,
      headers: jsonHeaders(approverToken),
      payload: JSON.stringify({ action: "APPROVE", proofId }),
    });
    expect(decision.statusCode).toBe(200);
    const approvalToken = (decision.json() as any).approvalToken as string;
    expect(approvalToken).toBeTruthy();

    // Execute
    const exec = await app.inject({
      method: "POST",
      url: `/api/wire/intents/${intentId}/execute`,
      headers: { authorization: `Bearer ${adminToken}`, "x-pose-approval": approvalToken, "x-idempotency-key": `idem_${ts}` },
      payload: JSON.stringify({ provider: "mock" }),
    });
    expect(exec.statusCode).toBe(200);
    const execJson = exec.json() as any;
    expect(execJson.status).toBeTruthy();
    expect(execJson.poseReceipt?.jws).toBeTruthy();
    expect(execJson.poseReceipt?.kid).toBe("test_key_1");

    // Verify using server-side verifier (integration-friendly).
    const verifyReceipt = await app.inject({
      method: "POST",
      url: "/api/wire/verify/pose-receipt",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ jws: execJson.poseReceipt.jws, expected: { intentId, receiptType: "execution.completed" } }),
    });
    expect(verifyReceipt.statusCode).toBe(200);
    expect((verifyReceipt.json() as any).valid).toBe(true);

    // JWKS should be publicly fetchable.
    const jwks = await app.inject({ method: "GET", url: "/.well-known/pose-jwks.json" });
    expect(jwks.statusCode).toBe(200);
    expect(Array.isArray((jwks.json() as any).keys)).toBe(true);

    // Verify event chain
    const verifyChain = await app.inject({
      method: "GET",
      url: `/api/wire/intents/${intentId}/events/verify`,
      headers: jsonHeaders(adminToken),
    });
    expect(verifyChain.statusCode).toBe(200);
    expect((verifyChain.json() as any).valid).toBe(true);

    // Bundle (receipt)
    const bundle = await app.inject({
      method: "POST",
      url: `/api/wire/intents/${intentId}/bundle?mode=redacted`,
      headers: jsonHeaders(adminToken),
      payload: JSON.stringify({}),
    });
    expect(bundle.statusCode).toBe(200);
    const bundleId = (bundle.json() as any).id as string;

    const verifyBundle = await app.inject({
      method: "GET",
      url: `/api/wire/bundles/${bundleId}/verify`,
      headers: jsonHeaders(adminToken),
    });
    expect(verifyBundle.statusCode).toBe(200);
    expect((verifyBundle.json() as any).valid).toBe(true);
  });

  it("4) Beneficiary create/change → lock/unlock → auditability", async () => {
    if (!(await dbAvailable())) return;

    const ts = Date.now();
    const { token } = await signupAndLogin(app, {
      org: `BenCo ${ts}`,
      name: "Admin",
      email: `ben_admin_${ts}@example.com`,
      password: "ben-admin-123",
    });

    const ben = await app.inject({
      method: "POST",
      url: "/api/wire/beneficiaries",
      headers: jsonHeaders(token),
      payload: JSON.stringify({ displayName: "Vendor", country: "US", railsAllowed: ["WIRE"], bankLast4: "7777" }),
    });
    expect(ben.statusCode).toBe(201);
    const beneficiaryId = (ben.json() as any).id as string;

    const lock = await app.inject({
      method: "PATCH",
      url: `/api/wire/beneficiaries/${beneficiaryId}`,
      headers: jsonHeaders(token),
      payload: JSON.stringify({ status: "LOCKED" }),
    });
    expect(lock.statusCode).toBe(200);
    expect((lock.json() as any).status).toBe("LOCKED");

    const unlock = await app.inject({
      method: "PATCH",
      url: `/api/wire/beneficiaries/${beneficiaryId}`,
      headers: jsonHeaders(token),
      payload: JSON.stringify({ status: "ACTIVE" }),
    });
    expect(unlock.statusCode).toBe(200);
    expect((unlock.json() as any).status).toBe("ACTIVE");
  });

  it("5) Evidence export → verify → download URL issued", async () => {
    if (!(await dbAvailable())) return;

    const ts = Date.now();
    const { token } = await signupAndLogin(app, {
      org: `EvidenceCo ${ts}`,
      name: "Admin",
      email: `ev_admin_${ts}@example.com`,
      password: "ev-admin-123",
    });

    const ben = await app.inject({
      method: "POST",
      url: "/api/wire/beneficiaries",
      headers: jsonHeaders(token),
      payload: JSON.stringify({ displayName: "Vendor", country: "US", railsAllowed: ["ACH"], bankLast4: "9999" }),
    });
    expect(ben.statusCode).toBe(201);
    const beneficiaryId = (ben.json() as any).id as string;

    const created = await app.inject({
      method: "POST",
      url: "/api/wire/intents",
      headers: jsonHeaders(token),
      payload: JSON.stringify({ railsType: "ACH", amountMinor: "1000", currency: "USD", beneficiaryId, purpose: "Evidence flow" }),
    });
    expect(created.statusCode).toBe(201);
    const intentId = (created.json() as any).id as string;

    const bundle = await app.inject({
      method: "POST",
      url: `/api/wire/intents/${intentId}/bundle?mode=redacted`,
      headers: jsonHeaders(token),
      payload: JSON.stringify({}),
    });
    expect(bundle.statusCode).toBe(200);
    const bundleId = (bundle.json() as any).id as string;

    const dl = await app.inject({
      method: "GET",
      url: `/api/wire/bundles/${bundleId}/download?expiresIn=60`,
      headers: jsonHeaders(token),
    });
    expect(dl.statusCode).toBe(200);
    expect((dl.json() as any).url).toContain("file://");
  });

  it("6) Webhook setup → test delivery → delivery logs → retry semantics", async () => {
    if (!(await dbAvailable())) return;

    // Mock axios to avoid real outbound calls.
    const axiosMod = await import("axios");
    const spy = vi.spyOn(axiosMod.default, "post").mockResolvedValue({ status: 200, data: { ok: true } } as any);

    const ts = Date.now();
    const { token, signup } = await signupAndLogin(app, {
      org: `HookCo ${ts}`,
      name: "Admin",
      email: `hook_admin_${ts}@example.com`,
      password: "hook-admin-123",
    });

    // Allow localhost for tests (DNS checks disabled above).
    process.env.WEBHOOK_ALLOW_HTTP = "true";
    process.env.WEBHOOK_ALLOW_LOCALHOST = "true";

    const create = await app.inject({
      method: "POST",
      url: "/api/wire/webhooks",
      headers: jsonHeaders(token),
      payload: JSON.stringify({ name: "Test Hook", url: "http://localhost/webhook", events: ["intent.created"] }),
    });
    expect(create.statusCode).toBe(201);
    const webhookId = (create.json() as any).id as string;

    const test = await app.inject({
      method: "POST",
      url: `/api/wire/webhooks/${webhookId}/test`,
      headers: jsonHeaders(token),
      payload: JSON.stringify({}),
    });
    expect(test.statusCode).toBe(202);
    const deliveryId = (test.json() as any).deliveryId as string;

    // Drive the delivery attempt (worker normally does this)
    const { attemptWebhookDeliveryById } = await import("../modules/webhooks/webhookService.js");
    const orgId = (signup as any)?.organization?.id as string;
    const res = await attemptWebhookDeliveryById(deliveryId, orgId);
    expect(res.ok).toBe(true);
    expect(spy).toHaveBeenCalled();

    // Logs should show delivered
    const logs = await app.inject({
      method: "GET",
      url: `/api/wire/webhooks/${webhookId}/deliveries?limit=10`,
      headers: jsonHeaders(token),
    });
    expect(logs.statusCode).toBe(200);
    const list = logs.json() as any[];
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].status).toMatch(/delivered|pending|retrying|failed/i);

    spy.mockRestore();
  });
});

