import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";

// Mock axios used by webhookVerification.ts to fetch JWKs from Plaid.
vi.mock("axios", () => {
  return {
    default: {
      post: vi.fn(),
    },
  };
});

import axios from "axios";

function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function signJwtEs256(params: { header: Record<string, unknown>; payload: Record<string, unknown>; privateKey: crypto.KeyObject }) {
  const headerB64 = b64urlJson(params.header);
  const payloadB64 = b64urlJson(params.payload);
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = crypto.sign("sha256", Buffer.from(signingInput, "utf8"), {
    key: params.privateKey,
    dsaEncoding: "ieee-p1363",
  });
  const sigB64 = Buffer.from(sig).toString("base64url");
  return `${signingInput}.${sigB64}`;
}

describe("Plaid webhook verification (Plaid-Verification JWT)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.PLAID_CLIENT_ID = "test_client";
    process.env.PLAID_SECRET = "test_secret";
    process.env.PLAID_ENV = "sandbox";
    delete process.env.PLAID_WEBHOOK_IAT_TOLERANCE_SECONDS;
  });

  it("verifies a valid ES256 JWT and request_body_sha256 over the raw body", async () => {
    vi.resetModules();
    const { verifyPlaidWebhookOrThrow } = await import("../webhookVerification.js");

    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    const kid = `kid_${Date.now()}`;
    const pubJwk = publicKey.export({ format: "jwk" }) as any;

    (axios as any).post.mockResolvedValue({
      data: {
        key: {
          ...pubJwk,
          alg: "ES256",
          use: "sig",
          kid,
          created_at: Math.floor(Date.now() / 1000),
          expired_at: null,
        },
      },
    });

    const rawBody = JSON.stringify(
      { webhook_type: "TRANSFER", webhook_code: "TRANSFER_EVENTS_UPDATE", environment: "sandbox" },
      null,
      2
    );
    const nowSec = Math.floor(Date.now() / 1000);

    const jwt = signJwtEs256({
      header: { alg: "ES256", typ: "JWT", kid },
      payload: { iat: nowSec, request_body_sha256: sha256Hex(rawBody) },
      privateKey,
    });

    const res = await verifyPlaidWebhookOrThrow({
      env: "sandbox",
      plaidVerificationJwt: jwt,
      rawBody,
    });

    expect(res.kid).toBe(kid);
    expect(res.iat).toBe(nowSec);
    expect(res.requestBodySha256).toBe(sha256Hex(rawBody));
  });

  it("rejects when request_body_sha256 does not match the raw body", async () => {
    vi.resetModules();
    const { verifyPlaidWebhookOrThrow } = await import("../webhookVerification.js");

    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    const kid = `kid_${Date.now()}`;
    const pubJwk = publicKey.export({ format: "jwk" }) as any;

    (axios as any).post.mockResolvedValue({
      data: { key: { ...pubJwk, alg: "ES256", use: "sig", kid, created_at: Math.floor(Date.now() / 1000), expired_at: null } },
    });

    const rawBody = JSON.stringify(
      { webhook_type: "TRANSFER", webhook_code: "TRANSFER_EVENTS_UPDATE", environment: "sandbox" },
      null,
      2
    );
    const nowSec = Math.floor(Date.now() / 1000);

    const jwt = signJwtEs256({
      header: { alg: "ES256", typ: "JWT", kid },
      payload: { iat: nowSec, request_body_sha256: sha256Hex(rawBody + "\n") }, // mismatch
      privateKey,
    });

    await expect(
      verifyPlaidWebhookOrThrow({
        env: "sandbox",
        plaidVerificationJwt: jwt,
        rawBody,
      })
    ).rejects.toThrow(/request_body_sha256 mismatch/i);
  });

  it("rejects when alg is not ES256", async () => {
    vi.resetModules();
    const { verifyPlaidWebhookOrThrow } = await import("../webhookVerification.js");

    // Still provide a JWK response to ensure we fail on alg before any signature work.
    (axios as any).post.mockResolvedValue({ data: { key: {} } });

    await expect(
      verifyPlaidWebhookOrThrow({
        env: "sandbox",
        plaidVerificationJwt: "eyJhbGciOiJIUzI1NiIsImtpZCI6ImFiYyJ9.eyJpYXQiOjEsInJlcXVlc3RfYm9keV9zaGEyNTYiOiJ4In0.x",
        rawBody: "{}",
      })
    ).rejects.toThrow(/Invalid JWT alg/i);
  });

  it("enforces iat tolerance window", async () => {
    vi.resetModules();
    process.env.PLAID_WEBHOOK_IAT_TOLERANCE_SECONDS = "1";
    const { verifyPlaidWebhookOrThrow } = await import("../webhookVerification.js");

    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    const kid = `kid_${Date.now()}`;
    const pubJwk = publicKey.export({ format: "jwk" }) as any;
    (axios as any).post.mockResolvedValue({
      data: { key: { ...pubJwk, alg: "ES256", use: "sig", kid, created_at: Math.floor(Date.now() / 1000), expired_at: null } },
    });

    const rawBody = JSON.stringify({ webhook_type: "TRANSFER", webhook_code: "TRANSFER_EVENTS_UPDATE" });
    const past = Math.floor(Date.now() / 1000) - 100;
    const jwt = signJwtEs256({
      header: { alg: "ES256", typ: "JWT", kid },
      payload: { iat: past, request_body_sha256: sha256Hex(rawBody) },
      privateKey,
    });

    await expect(
      verifyPlaidWebhookOrThrow({
        env: "sandbox",
        plaidVerificationJwt: jwt,
        rawBody,
      })
    ).rejects.toThrow(/iat outside tolerance/i);
  });

  it("caches JWKs by env+kid (does not refetch for repeated webhooks)", async () => {
    vi.resetModules();
    const { verifyPlaidWebhookOrThrow } = await import("../webhookVerification.js");

    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    const kid = `kid_${Date.now()}`;
    const pubJwk = publicKey.export({ format: "jwk" }) as any;

    (axios as any).post.mockResolvedValue({
      data: { key: { ...pubJwk, alg: "ES256", use: "sig", kid, created_at: Math.floor(Date.now() / 1000), expired_at: null } },
    });

    const rawBody = JSON.stringify({ webhook_type: "TRANSFER", webhook_code: "TRANSFER_EVENTS_UPDATE", environment: "sandbox" }, null, 2);
    const nowSec = Math.floor(Date.now() / 1000);
    const jwt = signJwtEs256({
      header: { alg: "ES256", typ: "JWT", kid },
      payload: { iat: nowSec, request_body_sha256: sha256Hex(rawBody) },
      privateKey,
    });

    await verifyPlaidWebhookOrThrow({ env: "sandbox", plaidVerificationJwt: jwt, rawBody });
    await verifyPlaidWebhookOrThrow({ env: "sandbox", plaidVerificationJwt: jwt, rawBody });

    expect((axios as any).post).toHaveBeenCalledTimes(1);
  });
});

