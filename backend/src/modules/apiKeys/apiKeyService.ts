/**
 * API Key Management Service
 * 
 * Handles generation, validation, and management of API keys for programmatic access
 */

import { prisma } from "../../db/prisma.js";
import { sha256Hex } from "../../lib/sha256.js";
import crypto from "crypto";

export type ApiKeyPermissions = string[];

export interface ApiKey {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  permissions: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * Generate a new API key pair
 * Returns: { key: "wire_live_abc123...", secret: "wkey_secret_xyz789..." }
 */
export function generateApiKeyPair(): { key: string; secret: string } {
  const randomKey = crypto.randomBytes(32).toString("hex");
  const randomSecret = crypto.randomBytes(32).toString("hex");
  
  const key = `wire_live_${randomKey}`;
  const secret = `wkey_secret_${randomSecret}`;
  
  return { key, secret };
}

/**
 * Create a new API key
 */
export async function createApiKey(params: {
  orgId: string;
  userId: string;
  name: string;
  permissions?: string[];
  expiresInDays?: number;
}): Promise<{ apiKey: ApiKey; secret: string }> {
  const { key, secret } = generateApiKeyPair();
  const keyHash = sha256Hex(key);
  const secretHash = sha256Hex(secret);
  const keyPrefix = key.slice(0, 12); // "wire_live_ab"
  
  const expiresAt = params.expiresInDays
    ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  
  const defaultPermissions = [
    "intent:create",
    "intent:read",
    "intent:approve",
    "beneficiary:create",
    "beneficiary:read",
  ];
  
  const apiKey = await prisma.apiKey.create({
    data: {
      id: `apikey_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
      orgId: params.orgId,
      userId: params.userId,
      name: params.name,
      keyPrefix,
      keyHash,
      secretHash,
      permissions: params.permissions || defaultPermissions,
      expiresAt,
      createdAt: new Date(),
    },
  });
  
  return {
    apiKey: {
      id: apiKey.id,
      orgId: apiKey.orgId,
      userId: apiKey.userId,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      keyHash: apiKey.keyHash,
      permissions: apiKey.permissions,
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
      revokedAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    },
    secret, // Only returned once on creation
  };
}

/**
 * Validate API key and return associated org/user
 */
export async function validateApiKey(
  key: string,
  secret?: string
): Promise<{
  valid: boolean;
  orgId?: string;
  userId?: string;
  permissions?: string[];
  error?: string;
}> {
  const requireSecret = process.env.WIRE2_REQUIRE_API_KEY_SECRET === "true";
  if (requireSecret && !secret) {
    return { valid: false, error: "API secret required (use Basic auth)" };
  }

  const keyHash = sha256Hex(key);
  
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
  });
  
  if (!apiKey) {
    return { valid: false, error: "Invalid API key" };
  }
  
  if (apiKey.revokedAt) {
    return { valid: false, error: "API key has been revoked" };
  }
  
  if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
    return { valid: false, error: "API key has expired" };
  }
  
  // If secret provided, validate it
  if (secret) {
    const secretHash = sha256Hex(secret);
    if (secretHash !== apiKey.secretHash) {
      return { valid: false, error: "Invalid API secret" };
    }
  }
  
  // Update last used timestamp
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });
  
  return {
    valid: true,
    orgId: apiKey.orgId,
    userId: apiKey.userId,
    permissions: apiKey.permissions,
  };
}

/**
 * List API keys for an organization
 */
export async function listApiKeys(orgId: string): Promise<ApiKey[]> {
  const keys = await prisma.apiKey.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  
  return keys.map((k) => ({
    id: k.id,
    orgId: k.orgId,
    userId: k.userId,
    name: k.name,
    keyPrefix: k.keyPrefix,
    keyHash: k.keyHash,
    permissions: k.permissions,
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
    revokedAt: k.revokedAt,
    createdAt: k.createdAt,
  }));
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(
  orgId: string,
  apiKeyId: string
): Promise<boolean> {
  const apiKey = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, orgId },
  });
  if (!apiKey) {
    return false;
  }
  
  await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: { revokedAt: new Date() },
  });
  
  return true;
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(
  orgId: string,
  apiKeyId: string
): Promise<boolean> {
  const apiKey = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, orgId },
  });
  if (!apiKey) {
    return false;
  }
  
  await prisma.apiKey.delete({
    where: { id: apiKeyId },
  });
  
  return true;
}
