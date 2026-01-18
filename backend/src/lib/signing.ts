import { createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";

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
  const payload = Buffer.from(message, "utf8");

  // If Buffer, convert to PEM format for Node.js crypto
  let keyToUse: string | Buffer = privateKey;
  if (Buffer.isBuffer(privateKey)) {
    // Convert raw 32-byte seed into PKCS#8 for Ed25519.
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

  const signature = cryptoSign(null, payload, keyToUse);
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
    const payload = Buffer.from(message, "utf8");
    const sigBuffer = Buffer.from(signature, "base64url");
    
    // If Buffer, convert to PEM format for Node.js crypto
    let keyToUse: string | Buffer = publicKey;
    if (Buffer.isBuffer(publicKey)) {
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

    return cryptoVerify(null, payload, keyToUse, sigBuffer);
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
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicJwk = publicKey.export({ format: "jwk" }) as JsonWebKey;
  const privateJwk = privateKey.export({ format: "jwk" }) as JsonWebKey;

  if (!publicJwk.x || !privateJwk.d) {
    throw new Error("Failed to generate Ed25519 key material");
  }

  const publicKeyRaw = Buffer.from(publicJwk.x, "base64url");
  const privateKeyRaw = Buffer.from(privateJwk.d, "base64url");

  return {
    publicKey: publicKeyRaw,
    privateKey: privateKeyRaw,
    publicKeyBase64url: publicKeyRaw.toString("base64url"),
    privateKeyBase64url: privateKeyRaw.toString("base64url"),
  };
}
