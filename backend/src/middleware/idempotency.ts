/**
 * Agent D: Idempotency Middleware for Fastify
 * 
 * Handles idempotency keys on mutating endpoints.
 * Reads X-Idempotency-Key header and returns cached response if found.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { checkIdempotencyKey, storeIdempotencyKey, generateIdempotencyKeyHash } from "../modules/intents/idempotency.js";
import { sha256Hex } from "../lib/sha256.js";
import { canonicalJsonStringify } from "../lib/canonicalJson.js";

export interface IdempotencyRequest extends FastifyRequest {
  idempotencyKey?: string;
}

/**
 * Idempotency middleware factory
 * Uses Fastify hooks: onRequest for checking, onResponse for storing
 */
export function idempotencyMiddleware() {
  return async (
    app: any // FastifyInstance
  ): Promise<void> => {
    // Check idempotency key on request
    app.addHook("onRequest", async (
      request: IdempotencyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      // Only apply to mutating methods
      const mutatingMethods = ["POST", "PATCH", "PUT", "DELETE"];
      if (!mutatingMethods.includes(request.method)) {
        return;
      }

      // Extract idempotency key from header
      const idempotencyKeyHeader =
        request.headers["x-idempotency-key"] ||
        request.headers["idempotency-key"];
      
      if (!idempotencyKeyHeader || typeof idempotencyKeyHeader !== "string") {
        // No idempotency key provided - continue normally
        return;
      }

      const userId = (request.user as any)?.id;
      const orgId = (request.user as any)?.orgId;
      
      if (!userId || !orgId) {
        // User not authenticated - skip idempotency (auth happens later)
        return;
      }

      const endpoint = `${request.method} ${(request as any).routerPath || request.url}`;
      const requestBody = request.body || {};
      const requestHash = sha256Hex(canonicalJsonStringify(requestBody));

      // Generate key hash
      const keyHash = generateIdempotencyKeyHash(
        orgId,
        endpoint,
        idempotencyKeyHeader
      );

      // Check for existing idempotency key
      const checkResult = await checkIdempotencyKey(keyHash);

      if (checkResult.exists && checkResult.record) {
        // Bank-grade guardrail: same idempotency key must not be reused with different request bodies.
        if (checkResult.record.requestHash !== requestHash) {
          reply.code(409);
          return reply.send({
            error: "Idempotency key reused with different request body",
            code: "IDEMPOTENCY_KEY_REUSE",
          });
        }
        // Return cached response
        reply.code(checkResult.record.response.status);
        return reply.send(checkResult.record.response.body);
      }

      // Store key hash for later use
      request.idempotencyKey = keyHash;
      (request as any).idempotencyContext = {
        keyHash,
        userId,
        orgId,
        endpoint,
        requestHash,
      };
    });

    // Store idempotency key on successful response
    // Use onSend hook to capture payload before serialization
    app.addHook("onSend", async (
      request: IdempotencyRequest,
      reply: FastifyReply,
      payload: unknown
    ): Promise<unknown> => {
      const context = (request as any).idempotencyContext;
      if (!context) {
        return payload; // No idempotency key was set
      }

      // Only store for successful responses (2xx, 3xx)
      if (reply.statusCode >= 200 && reply.statusCode < 400) {
        // Store asynchronously - don't block response
        storeIdempotencyKey({
          keyHash: context.keyHash,
          userId: context.userId,
          orgId: context.orgId,
          endpoint: context.endpoint,
          requestHash: context.requestHash,
          responseStatus: reply.statusCode,
          responseBody: payload,
        }).catch((err) => {
          // Log error but don't fail the request
          console.error("Failed to store idempotency key:", err);
        });
      }
      
      return payload;
    });
  };
}
