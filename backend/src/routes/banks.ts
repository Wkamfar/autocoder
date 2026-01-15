/**
 * Agent 7: Bank connectivity routes (scaffold)
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePermission } from "../modules/security/auth.js";
import { emitOrgAuditEvent } from "../modules/audit/auditEvents.js";
import {
  createMockBankConnection,
  listBankAccounts,
  listBankConnections,
} from "../modules/banks/bankService.js";
import { createPlaidLinkToken, exchangePlaidPublicToken, refreshPlaidConnection, revokePlaidConnection } from "../modules/banks/plaidConnectivity.js";

export const bankRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/bank/connections",
    { preHandler: requirePermission("bank:view") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      return await listBankConnections(req.user.orgId);
    }
  );

  // Plaid Link: create link_token
  app.post(
    "/banks/plaid/link_token/create",
    { preHandler: requirePermission("bank:connect") },
    async (req, reply) => {
      if (!req.user) return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      const bodySchema = z.object({
        clientUserId: z.string().min(1).max(200),
        redirectUri: z.string().url().optional(),
      });
      const body = bodySchema.parse(req.body ?? {});
      const res = await createPlaidLinkToken({
        orgId: req.user.orgId,
        userId: req.user.id,
        clientUserId: body.clientUserId,
        redirectUri: body.redirectUri ?? null,
      });
      await emitOrgAuditEvent({
        req,
        eventType: "bank.plaid.link_token.created",
        subject: null,
        payload: { clientUserId: body.clientUserId, redirectUri: body.redirectUri ?? null },
      }).catch(() => null);
      return reply.code(200).send(res);
    }
  );

  // Plaid Link: exchange public_token → store access_token (encrypted) + ingest accounts/auth/identity snapshots.
  app.post(
    "/banks/plaid/public_token/exchange",
    { preHandler: requirePermission("bank:connect") },
    async (req, reply) => {
      if (!req.user) return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      const bodySchema = z.object({ publicToken: z.string().min(1) });
      const body = bodySchema.parse(req.body ?? {});
      const res = await exchangePlaidPublicToken({ orgId: req.user.orgId, userId: req.user.id, publicToken: body.publicToken });
      await emitOrgAuditEvent({
        req,
        eventType: "bank.connection.created",
        subject: { type: "bank_connection", id: res.connection.id },
        payload: { provider: "plaid", institutionName: res.connection.institutionName, encryptedAtRest: res.connection.encryptedAtRest },
      }).catch(() => null);
      return reply.code(201).send(res);
    }
  );

  // Ops: force refresh a connection (health + account snapshot).
  app.post(
    "/bank/connections/:id/refresh",
    { preHandler: requirePermission("bank:admin") },
    async (req, reply) => {
      if (!req.user) return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      const connectionId = (req.params as any).id as string;
      const res = await refreshPlaidConnection({ orgId: req.user.orgId, connectionId });
      await emitOrgAuditEvent({
        req,
        eventType: "bank.connection.refreshed",
        subject: { type: "bank_connection", id: connectionId },
        payload: { provider: "plaid", status: res.status, lastError: res.lastError ?? null },
        outcome: { success: res.ok, ...(res.ok ? {} : { error: res.lastError ?? "refresh_failed" }) },
      }).catch(() => null);
      return reply.code(200).send(res);
    }
  );

  // Ops: revoke a connection (remove item + wipe tokens).
  app.post(
    "/bank/connections/:id/revoke",
    { preHandler: requirePermission("bank:admin") },
    async (req, reply) => {
      if (!req.user) return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      const connectionId = (req.params as any).id as string;
      const res = await revokePlaidConnection({ orgId: req.user.orgId, connectionId });
      await emitOrgAuditEvent({
        req,
        eventType: "bank.connection.revoked",
        subject: { type: "bank_connection", id: connectionId },
        payload: { provider: "plaid" },
      }).catch(() => null);
      return reply.code(200).send(res);
    }
  );

  // Mock connector: create a connection + accounts without external provider calls.
  app.post(
    "/bank/connections/mock-link",
    { preHandler: requirePermission("bank:connect") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }

      const bodySchema = z.object({
        institutionName: z.string().min(1).max(200),
        accounts: z
          .array(
            z.object({
              name: z.string().min(1).max(200),
              mask: z.string().min(0).max(20).optional(),
              type: z.string().min(0).max(50).optional(),
              currency: z.string().length(3).optional(),
              railsEligible: z.array(z.enum(["ACH", "WIRE"])).min(1),
            })
          )
          .min(1),
      });
      const body = bodySchema.parse(req.body);

      const res = await createMockBankConnection({
        orgId: req.user.orgId,
        userId: req.user.id,
        institutionName: body.institutionName,
        accounts: body.accounts.map((a) => ({
          name: a.name,
          mask: a.mask ?? null,
          type: a.type ?? null,
          currency: a.currency ?? "USD",
          railsEligible: a.railsEligible,
        })),
      });

      reply.code(201);
      return res;
    }
  );

  app.get(
    "/bank/connections/:id/accounts",
    { preHandler: requirePermission("bank:view") },
    async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }
      const connectionId = (req.params as any).id as string;
      const accounts = await listBankAccounts({ orgId: req.user.orgId, connectionId });
      if (!accounts) return reply.code(404).send({ error: "Connection not found" });
      return accounts;
    }
  );
};

