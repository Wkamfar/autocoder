import "dotenv/config";
import { buildApp } from "./app.js";

// Validate required environment variables
function validateEnv() {
  const required = ["DATABASE_URL"];
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Signing keys are required for bundle generation
  if (!process.env.SIGNING_PRIVATE_KEY || !process.env.SIGNING_PUBLIC_KEY) {
    console.warn(
      "⚠️  WARNING: SIGNING_PRIVATE_KEY and SIGNING_PUBLIC_KEY not set. " +
      "Bundle generation will fail. Set these in production."
    );
  }

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }

  // Validate signing key format if set
  if (process.env.SIGNING_PRIVATE_KEY) {
    try {
      const privateKey = Buffer.from(process.env.SIGNING_PRIVATE_KEY, "base64url");
      // Ed25519 private key can be 32 bytes (seed) or 64 bytes (seed + public key)
      if (privateKey.length !== 32 && privateKey.length !== 64) {
        console.error(
          `❌ Invalid SIGNING_PRIVATE_KEY length: expected 32 or 64 bytes, got ${privateKey.length}`
        );
        process.exit(1);
      }
    } catch (error) {
      console.error("❌ Invalid SIGNING_PRIVATE_KEY format (must be base64url):", error);
      process.exit(1);
    }
  }

  if (process.env.SIGNING_PUBLIC_KEY) {
    try {
      const publicKey = Buffer.from(process.env.SIGNING_PUBLIC_KEY, "base64url");
      if (publicKey.length !== 32) {
        console.error(
          `❌ Invalid SIGNING_PUBLIC_KEY length: expected 32 bytes, got ${publicKey.length}`
        );
        process.exit(1);
      }
    } catch (error) {
      console.error("❌ Invalid SIGNING_PUBLIC_KEY format (must be base64url):", error);
      process.exit(1);
    }
  }
}

validateEnv();

const port = process.env.PORT ? Number(process.env.PORT) : 8000;
const host = process.env.HOST ?? "0.0.0.0";

const app = await buildApp();

await app.listen({ port, host });

