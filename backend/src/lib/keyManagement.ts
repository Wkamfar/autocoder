import { SigningKey, signEd25519 } from "./signing.js";

/**
 * Key management abstraction.
 *
 * - Signing: requires a private key (dev) or KMS/HSM integration (prod).
 * - Verification: requires only public keys; supports key rotation.
 *
 * Environment variables (dev):
 * - SIGNING_KEY_ID=dev_key_1
 * - SIGNING_PRIVATE_KEY=<base64url 32 or 64 bytes>
 * - SIGNING_PUBLIC_KEY=<base64url 32 bytes>
 *
 * Rotation support:
 * - SIGNING_PUBLIC_KEYS_JSON='{"dev_key_1":"...","prod_key_2026q1":"..."}' (base64url 32 bytes)
 * - SIGNING_REVOKED_KEY_IDS='compromised_key_1,compromised_key_2'
 */

const DEV_KEY_ID = "dev_key_1";

function parsePublicKeysJson(): Record<string, string> | null {
  const raw = process.env.SIGNING_PUBLIC_KEYS_JSON;
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return obj as Record<string, string>;
  } catch {
    return null;
  }
}

export function isKeyRevoked(keyId: string): boolean {
  const list = (process.env.SIGNING_REVOKED_KEY_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(keyId);
}

export function getActiveSigningKeyId(): string {
  return process.env.SIGNING_KEY_ID || DEV_KEY_ID;
}

export function listConfiguredSigningKeyIds(): string[] {
  const map = parsePublicKeysJson();
  const ids = map ? Object.keys(map) : [];
  const active = getActiveSigningKeyId();
  if (!ids.includes(active)) ids.unshift(active);
  return Array.from(new Set(ids));
}

/**
 * Get signing key material.
 *
 * - For verification: publicKey is always returned when configured.
 * - For signing: privateKey is only present when SIGNING_PRIVATE_KEY is set (dev) or KMS/HSM is integrated (future).
 */
export async function getSigningKey(keyId: string = DEV_KEY_ID): Promise<SigningKey> {
  if (process.env.NODE_ENV === "production" && process.env.SIGNING_KEY_ID?.startsWith("kms:")) {
    // TODO: Integrate with KMS (private key never leaves KMS).
    throw new Error("KMS integration not yet implemented. Use env keys for now.");
  }

  // Public key lookup (supports rotation): prefer SIGNING_PUBLIC_KEYS_JSON[keyId], else SIGNING_PUBLIC_KEY.
  const map = parsePublicKeysJson();
  const publicKeyBase64url = (map && map[keyId]) || process.env.SIGNING_PUBLIC_KEY;
  if (!publicKeyBase64url) {
    throw new Error(
      "No public key configured. Set SIGNING_PUBLIC_KEY or SIGNING_PUBLIC_KEYS_JSON (keyId->publicKey base64url)."
    );
  }
  const publicKeyRaw = Buffer.from(publicKeyBase64url, "base64url");
  if (publicKeyRaw.length !== 32) {
    throw new Error(`Invalid public key length: expected 32 bytes, got ${publicKeyRaw.length}`);
  }

  // Private key is only required for signing.
  const privateKeyBase64url = process.env.SIGNING_PRIVATE_KEY;
  let privateKey: Buffer | undefined = undefined;
  if (privateKeyBase64url) {
    privateKey = Buffer.from(privateKeyBase64url, "base64url");
    if (privateKey.length !== 32 && privateKey.length !== 64) {
      throw new Error(`Invalid private key length: expected 32 or 64 bytes, got ${privateKey.length}`);
    }
  }

  return { keyId, publicKey: publicKeyRaw, privateKey };
}

export async function signWithDefaultKey(message: string): Promise<{ signature: string; keyId: string }> {
  const keyId = getActiveSigningKeyId();
  const key = await getSigningKey(keyId);
  if (!key.privateKey) {
    throw new Error(
      "Private key not available. Set SIGNING_PRIVATE_KEY (dev) or integrate KMS/HSM for production signing."
    );
  }
  return { signature: signEd25519(message, key.privateKey), keyId: key.keyId };
}
