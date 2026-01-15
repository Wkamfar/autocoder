/**
 * Email Verification Code Storage (Redis)
 * 
 * Stores and verifies email verification codes for Fast Wire requests
 */

import { getRedisClient } from "../../lib/redis.js";
import { logger } from "../../lib/observability.js";

const CODE_EXPIRY_SECONDS = 5 * 60; // 5 minutes
const CODE_KEY_PREFIX = "fastwire:email-verify:";

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Store verification code in Redis
 */
export async function storeVerificationCode(email: string, code: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    logger.warn("Redis not available, email verification codes will not be persisted");
    return false;
  }

  try {
    const key = `${CODE_KEY_PREFIX}${email}`;
    await redis.setex(key, CODE_EXPIRY_SECONDS, code);
    logger.info("Email verification code stored", { email, expirySeconds: CODE_EXPIRY_SECONDS });
    return true;
  } catch (error: any) {
    logger.error("Failed to store verification code", { error: error.message, email });
    return false;
  }
}

/**
 * Verify email verification code
 */
export async function verifyEmailCode(email: string, code: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    // In development, allow any code if Redis is not available
    if (process.env.NODE_ENV === "development") {
      logger.warn("Redis not available, accepting verification code in development mode", { email });
      return true;
    }
    return false;
  }

  try {
    const key = `${CODE_KEY_PREFIX}${email}`;
    const storedCode = await redis.get(key);
    
    if (!storedCode) {
      logger.warn("Verification code not found or expired", { email });
      return false;
    }

    const isValid = storedCode === code;
    
    if (isValid) {
      // Delete code after successful verification (one-time use)
      await redis.del(key);
      logger.info("Email verification code verified", { email });
    } else {
      logger.warn("Invalid verification code", { email });
    }

    return isValid;
  } catch (error: any) {
    logger.error("Failed to verify email code", { error: error.message, email });
    return false;
  }
}

/**
 * Check if email verification is required/enabled
 */
export function isEmailVerificationEnabled(): boolean {
  const redis = getRedisClient();
  const enabled = process.env.FAST_WIRE_EMAIL_VERIFICATION_ENABLED !== "false";
  return enabled && redis !== null;
}
