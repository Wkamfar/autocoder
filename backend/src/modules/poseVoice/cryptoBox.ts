import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM envelope for small blobs.
 * Key is expected as base64url 32 bytes in env POSE_VOICE_EMBEDDING_KEY.
 */
export function getEmbeddingKey(): Buffer | null {
  const raw = process.env.POSE_VOICE_EMBEDDING_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64url");
  if (key.length !== 32) throw new Error("POSE_VOICE_EMBEDDING_KEY must be 32 bytes base64url");
  return key;
}

export function encryptToBase64url(key: Buffer, plaintext: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(12) | tag(16) | ciphertext
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function decryptFromBase64url(key: Buffer, packed: string): Buffer {
  const buf = Buffer.from(packed, "base64url");
  if (buf.length < 12 + 16 + 1) throw new Error("Invalid encrypted blob");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

