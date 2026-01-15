/**
 * Plaid webhook verification (bank-grade)
 *
 * Per Plaid docs:
 * - Webhook includes `Plaid-Verification` header whose value is a JWT.
 * - JWT header must use alg=ES256 and contains kid.
 * - Use /webhook_verification_key/get with key_id=kid to fetch JWK.
 * - Verify JWT signature using JWK.
 * - Validate `iat` and `request_body_sha256` claim against the *raw* request body.
 */

import crypto from "node:crypto";
import axios from "axios";
import { canonicalJsonStringify } from "../../../lib/canonicalJson.js";
import { sha256Hex, constantTimeEqual } from "../../../lib/sha256.js";

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

function base64urlToBuffer(b64url: string): Buffer {
  return Buffer.from(b64url, "base64url");
}

function parseJwtParts(jwt: string): { headerB64: string; payloadB64: string; sigB64: string } {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  return { headerB64: parts[0], payloadB64: parts[1], sigB64: parts[2] };
}

function decodeJsonPart<T>(b64url: string): T {
  const buf = base64urlToBuffer(b64url);
  const str = buf.toString("utf8");
  return JSON.parse(str) as T;
}

type JwtHeader = { alg?: string; kid?: string; typ?: string };
type PlaidWebhookJwtPayload = {
  iat?: number;
  request_body_sha256?: string;
  [k: string]: unknown;
};

type PlaidJwk = {
  kty: "EC";
  crv: string;
  alg: string;
  use: string;
  kid: string;
  x: string;
  y: string;
  created_at?: number;
  expired_at?: number | null;
};

const jwkCache = new Map<string, { key: crypto.KeyObject; expiresAtMs: number }>();

async function fetchPlaidJwk(params: { env: PlaidEnv; kid: string }): Promise<PlaidJwk> {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) {
    throw new Error("PLAID_CLIENT_ID/PLAID_SECRET not configured");
  }

  const url = `${plaidBaseUrl(params.env)}/webhook_verification_key/get`;
  const res = await axios.post(
    url,
    { client_id: clientId, secret, key_id: params.kid },
    { headers: { "Content-Type": "application/json" }, timeout: 10_000 }
  );

  const key = (res.data as any)?.key as PlaidJwk | undefined;
  if (!key?.kid || !key?.x || !key?.y) {
    throw new Error("Invalid response from /webhook_verification_key/get");
  }
  return key;
}

async function getPlaidWebhookPublicKey(params: { env: PlaidEnv; kid: string }): Promise<crypto.KeyObject> {
  const cached = jwkCache.get(`${params.env}:${params.kid}`);
  const now = Date.now();
  if (cached && cached.expiresAtMs > now) return cached.key;

  const jwk = await fetchPlaidJwk(params);
  const keyObj = crypto.createPublicKey({ key: jwk as any, format: "jwk" });

  // Use expired_at if present; otherwise cache for 6 hours.
  const expiresAtMs =
    typeof jwk.expired_at === "number" ? jwk.expired_at * 1000 : now + 6 * 60 * 60 * 1000;

  jwkCache.set(`${params.env}:${params.kid}`, { key: keyObj, expiresAtMs });
  return keyObj;
}

export async function verifyPlaidWebhookOrThrow(params: {
  env: PlaidEnv;
  plaidVerificationJwt: string;
  rawBody: string;
}): Promise<{
  kid: string;
  iat: number;
  requestBodySha256: string;
  jwtPayload: PlaidWebhookJwtPayload;
}> {
  const { headerB64, payloadB64, sigB64 } = parseJwtParts(params.plaidVerificationJwt);
  const header = decodeJsonPart<JwtHeader>(headerB64);

  if (header.alg !== "ES256") {
    throw new Error("Invalid JWT alg (expected ES256)");
  }
  const kid = header.kid;
  if (!kid) {
    throw new Error("Missing JWT kid");
  }

  const publicKey = await getPlaidWebhookPublicKey({ env: params.env, kid });
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = base64urlToBuffer(sigB64);

  const ok = crypto.verify(
    "sha256",
    Buffer.from(signingInput, "utf8"),
    { key: publicKey, dsaEncoding: "ieee-p1363" },
    sig
  );
  if (!ok) {
    throw new Error("Invalid Plaid webhook signature");
  }

  const payload = decodeJsonPart<PlaidWebhookJwtPayload>(payloadB64);
  const iat = payload.iat;
  const claimed = payload.request_body_sha256;
  if (!iat || !Number.isFinite(iat)) {
    throw new Error("Missing/invalid iat in JWT payload");
  }
  if (!claimed || typeof claimed !== "string") {
    throw new Error("Missing request_body_sha256 in JWT payload");
  }

  const toleranceSeconds = Number(process.env.PLAID_WEBHOOK_IAT_TOLERANCE_SECONDS || "300");
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - iat) > toleranceSeconds) {
    throw new Error("JWT iat outside tolerance window");
  }

  const computed = sha256Hex(params.rawBody);
  // Plaid sends hex; reject if not full-length.
  if (claimed.length !== computed.length) {
    throw new Error("request_body_sha256 length mismatch");
  }
  if (!constantTimeEqual(computed, claimed)) {
    throw new Error("request_body_sha256 mismatch");
  }

  return {
    kid,
    iat,
    requestBodySha256: computed,
    jwtPayload: payload,
  };
}

export function redactPlaidVerificationHeader(jwt: string): string {
  // Keep just the header+payload hashes for logs (never log full JWT).
  try {
    const { headerB64, payloadB64 } = parseJwtParts(jwt);
    return canonicalJsonStringify({
      headerHash: sha256Hex(headerB64).slice(0, 16),
      payloadHash: sha256Hex(payloadB64).slice(0, 16),
    });
  } catch {
    return canonicalJsonStringify({ invalid: true });
  }
}

