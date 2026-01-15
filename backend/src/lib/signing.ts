import { createSign, createVerify } from "node:crypto";

/**
 * Ed25519 signing and verification utilities.
 * 
 * Signatures are base64url-encoded (64 bytes → 86 characters).
 * Compatible with Node.js 12+ crypto module.
 */

export interface SigningKey {
  keyId: string;
  publicKey: Buffer; // Ed25519 public key (32 bytes)
  privateKey?: Buffer; // Ed25519 private key (64 bytes) - only in dev
}

/**
 * Sign a message using Ed25519.
 * @param message - The message to sign (string)
 * @param privateKey - Ed25519 private key (64 bytes Buffer or PEM string)
 * @returns Base64url-encoded signature (64 bytes → 86 characters)
 */
export function signEd25519(message: string, privateKey: Buffer | string): string {
  const sign = createSign("Ed25519");
  sign.update(message, "utf8");
  
  // If Buffer, convert to PEM format for Node.js crypto
  let keyToUse: string | Buffer = privateKey;
  if (Buffer.isBuffer(privateKey)) {
    // For Ed25519, Node.js expects PKCS#8 format
    // We'll use the raw buffer directly - Node.js 12+ supports this
    // Actually, we need to create a proper key object
    const { createPrivateKey } = require("node:crypto");
    // Convert raw 64-byte key to PEM format
    // Ed25519 private key in PKCS#8 DER format
    const pkcs8Header = Buffer.from([
      0x30, 0x2e, // SEQUENCE
      0x02, 0x01, 0x00, // version
      0x30, 0x05, // AlgorithmIdentifier
      0x06, 0x03, 0x2b, 0x65, 0x70, // OID for Ed25519
      0x04, 0x22, // OCTET STRING
      0x04, 0x20, // length of key material
    ]);
    const keyDer = Buffer.concat([pkcs8Header, privateKey.slice(0, 32)]);
    const keyPem = `-----BEGIN PRIVATE KEY-----\n${keyDer.toString("base64")}\n-----END PRIVATE KEY-----`;
    keyToUse = createPrivateKey(keyPem);
  }
  
  const signature = sign.sign(keyToUse);
  // Convert to base64url (RFC 4648 §5)
  return signature.toString("base64url");
}

/**
 * Verify an Ed25519 signature.
 * @param message - The original message (string)
 * @param signature - Base64url-encoded signature
 * @param publicKey - Ed25519 public key (32 bytes Buffer or PEM string)
 * @returns true if signature is valid
 */
export function verifyEd25519(
  message: string,
  signature: string,
  publicKey: Buffer | string
): boolean {
  try {
    const verify = createVerify("Ed25519");
    verify.update(message, "utf8");
    const sigBuffer = Buffer.from(signature, "base64url");
    
    // If Buffer, convert to PEM format for Node.js crypto
    let keyToUse: string | Buffer = publicKey;
    if (Buffer.isBuffer(publicKey)) {
      const { createPublicKey } = require("node:crypto");
      // Convert raw 32-byte key to PEM format
      // Ed25519 public key in SPKI format
      const spkiHeader = Buffer.from([
        0x30, 0x2a, // SEQUENCE
        0x30, 0x05, // AlgorithmIdentifier
        0x06, 0x03, 0x2b, 0x65, 0x70, // OID for Ed25519
        0x03, 0x21, // BIT STRING
        0x00, // unused bits
        0x04, 0x20, // length of key material
      ]);
      const keyDer = Buffer.concat([spkiHeader, publicKey]);
      const keyPem = `-----BEGIN PUBLIC KEY-----\n${keyDer.toString("base64")}\n-----END PUBLIC KEY-----`;
      keyToUse = createPublicKey(keyPem);
    }
    
    return verify.verify(keyToUse, sigBuffer);
  } catch (error) {
    // Invalid signature format or verification failure
    return false;
  }
}

/**
 * Generate a new Ed25519 key pair (development only).
 * In production, keys should come from KMS/HSM.
 */
export function generateEd25519KeyPair(): {
  publicKey: Buffer;
  privateKey: Buffer;
  publicKeyBase64url: string;
  privateKeyBase64url: string;
} {
  const { generateKeyPairSync } = require("node:crypto");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  // Extract raw key material (32 bytes public, 64 bytes private)
  // Note: PEM format includes headers, we need raw bytes
  // For Ed25519, we'll use the PEM format directly with crypto module
  // But for storage, we'll extract the raw bytes
  
  // Convert PEM to raw bytes (simplified - in practice use proper parsing)
  const publicKeyRaw = Buffer.from(
    publicKey.replace(/-----BEGIN PUBLIC KEY-----/, "").replace(/-----END PUBLIC KEY-----/, "").replace(/\s/g, ""),
    "base64"
  ).slice(-32); // Last 32 bytes are the Ed25519 public key
  
  const privateKeyRaw = Buffer.from(
    privateKey.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, ""),
    "base64"
  ).slice(-64); // Last 64 bytes are the Ed25519 private key

  return {
    publicKey: publicKeyRaw,
    privateKey: privateKeyRaw,
    publicKeyBase64url: publicKeyRaw.toString("base64url"),
    privateKeyBase64url: privateKeyRaw.toString("base64url"),
  };
}
