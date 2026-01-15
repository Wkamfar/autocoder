import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Small-secret encryption helper (AES-256-GCM).
 *
 * Format: base64url(iv(12) | tag(16) | ciphertext)
 *
 * This is intended for *application secrets at rest* (e.g. webhook signing secrets),
 * not large blobs.
 */

export function getSecretsEncryptionKey(): Buffer | null {
  const raw = process.env.WIRE2_SECRETS_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64url");
  if (key.length !== 32) {
    throw new Error("WIRE2_SECRETS_ENCRYPTION_KEY must be 32 bytes base64url");
  }
  return key;
}

export function encryptSecretToBase64url(key: Buffer, plaintextUtf8: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintextUtf8, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function decryptSecretFromBase64url(key: Buffer, packed: string): string {
  const buf = Buffer.from(packed, "base64url");
  if (buf.length < 12 + 16 + 1) throw new Error("Invalid encrypted secret");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

