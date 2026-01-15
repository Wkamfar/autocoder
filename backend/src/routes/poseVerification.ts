import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPoseJwks, verifyPoseReceiptServerSide } from "../modules/verification/poseReceipt.js";

/**
 * Public verification materials for POSE signed receipts.
 *
 * These routes are intentionally unauthenticated; auth is enforced by cryptographic verification.
 * The auth hook must explicitly skip these paths.
 */
export const poseVerificationRoutes: FastifyPluginAsync = async (app) => {
  // Standard well-known JWKS endpoint (offline verifiers fetch this).
  app.get("/.well-known/pose-jwks.json", async (_req, reply) => {
    reply.header("Content-Type", "application/json; charset=utf-8");
    return await getPoseJwks();
  });

  // Alternate (API) JWKS location for integrators already using /api/wire.
  app.get("/api/wire/keys/jwks", async (_req, reply) => {
    reply.header("Content-Type", "application/json; charset=utf-8");
    return await getPoseJwks();
  });

  // Optional server-side verifier: helpful for debugging and support without reimplementing JOSE in every client.
  app.post("/api/wire/verify/pose-receipt", async (req, reply) => {
    const bodySchema = z.object({
      jws: z.string().min(10),
      expected: z
        .object({
          orgId: z.string().optional(),
          intentId: z.string().optional(),
          executionRef: z.string().optional(),
          bindingHash: z.string().optional(),
          receiptType: z.enum(["execution.completed", "settlement.reported"]).optional(),
        })
        .optional(),
    });
    const body = bodySchema.parse(req.body ?? {});
    const result = await verifyPoseReceiptServerSide({ jws: body.jws, expected: body.expected });
    // Do not return 4xx for invalid receipts; this is a verifier endpoint.
    return reply.code(200).send(result);
  });
};

