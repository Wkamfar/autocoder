/**
 * API Key Authentication Middleware
 * 
 * Validates API keys for programmatic access
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { validateApiKey } from "../modules/apiKeys/apiKeyService.js";
import { prisma } from "../db/prisma.js";

export async function apiKeyAuthMiddleware(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip if user already authenticated (session auth takes precedence)
  if (req.user) {
    return;
  }
  
  // API keys must NOT conflict with session Bearer tokens.
  // Supported formats:
  // - Authorization: ApiKey <key>
  // - Authorization: Basic base64(<key>:<secret>)
  // - X-API-KEY: <key>
  const authHeader = req.headers.authorization;
  const xApiKeyHeader = req.headers["x-api-key"];
  const xApiKey = typeof xApiKeyHeader === "string" ? xApiKeyHeader : undefined;

  let apiKey: string | undefined = xApiKey;
  let apiSecret: string | undefined;

  if (authHeader?.startsWith("ApiKey ")) {
    apiKey = authHeader.slice(6).trim();
  } else if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
    const [key, secret] = decoded.split(":");
    apiKey = key;
    apiSecret = secret;
  } else if (!apiKey) {
    // No API key present, let other auth handle it (e.g. Bearer session token)
    return;
  }
  
  if (!apiKey) {
    return; // No API key found, let other auth handle it
  }
  
  // Validate API key
  const validation = await validateApiKey(apiKey, apiSecret);
  
  if (!validation.valid) {
    reply.code(401).send({
      error: validation.error || "Invalid API key",
      code: "INVALID_API_KEY",
    });
    return;
  }
  
  if (!validation.orgId || !validation.userId) {
    reply.code(401).send({
      error: "API key validation failed",
      code: "API_KEY_ERROR",
    });
    return;
  }
  
  // Get user and org details
  const user = await prisma.user.findUnique({
    where: { id: validation.userId },
  });
  
  if (!user || user.orgId !== validation.orgId) {
    reply.code(401).send({
      error: "User not found",
      code: "USER_NOT_FOUND",
    });
    return;
  }
  
  // Set user on request (same format as session auth)
  (req as any).user = {
    id: user.id,
    orgId: user.orgId,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: validation.permissions || user.permissions,
  };
}
