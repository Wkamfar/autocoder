import { canonicalJsonStringify } from "./canonicalJson.js";
import { signEd25519, verifyEd25519 } from "./signing.js";

export type JwsHeader = {
  alg: "EdDSA";
  kid: string;
  typ?: string;
};

export function base64urlEncodeJson(value: unknown): string {
  // JWS payload/header should be canonicalized to avoid accidental signature drift.
  const json = canonicalJsonStringify(value);
  return Buffer.from(json, "utf8").toString("base64url");
}

export function base64urlDecodeJson<T = any>(b64url: string): T {
  const json = Buffer.from(b64url, "base64url").toString("utf8");
  return JSON.parse(json) as T;
}

export function makeCompactJws(params: {
  header: JwsHeader;
  payload: unknown;
  privateKey: Buffer | string;
}): { jws: string; signingInput: string; signature: string; payloadCanonicalJson: string } {
  const payloadCanonicalJson = canonicalJsonStringify(params.payload);
  const headerB64 = base64urlEncodeJson(params.header);
  const payloadB64 = Buffer.from(payloadCanonicalJson, "utf8").toString("base64url");
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = signEd25519(signingInput, params.privateKey);
  return { jws: `${signingInput}.${signature}`, signingInput, signature, payloadCanonicalJson };
}

export function parseCompactJws(jws: string): { headerB64: string; payloadB64: string; signatureB64: string } | null {
  const parts = String(jws || "").split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) return null;
  return { headerB64, payloadB64, signatureB64 };
}

export function verifyCompactJws(params: {
  jws: string;
  publicKey: Buffer | string;
}): { valid: boolean; signingInput?: string; header?: JwsHeader; payload?: unknown; error?: string } {
  const parsed = parseCompactJws(params.jws);
  if (!parsed) return { valid: false, error: "invalid_format" };
  const signingInput = `${parsed.headerB64}.${parsed.payloadB64}`;
  let header: JwsHeader;
  let payload: unknown;
  try {
    header = base64urlDecodeJson<JwsHeader>(parsed.headerB64);
  } catch {
    return { valid: false, error: "invalid_header_json" };
  }
  try {
    payload = base64urlDecodeJson(parsed.payloadB64);
  } catch {
    return { valid: false, error: "invalid_payload_json" };
  }
  if (header.alg !== "EdDSA") return { valid: false, error: "unsupported_alg", header, payload };
  const ok = verifyEd25519(signingInput, parsed.signatureB64, params.publicKey);
  return ok ? { valid: true, signingInput, header, payload } : { valid: false, error: "bad_signature", header, payload };
}

