/**
 * Agent 7: Bank connectivity service (connector scaffolding)
 *
 * This is provider-agnostic plumbing:
 * - Stores connection + account metadata
 * - Encrypts tokens at rest (AES-256-GCM via secretBox)
 *
 * Real provider integrations (Plaid/Teller/MX/etc.) will plug into this later.
 */

import crypto from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { randomToken, sha256Hex } from "../../lib/sha256.js";
import {
  encryptSecretToBase64url,
  getSecretsEncryptionKey,
} from "../../lib/secretBox.js";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";

export type CreateMockBankConnectionParams = {
  orgId: string;
  userId: string;
  institutionName: string;
  accounts: Array<{
    name: string;
    mask?: string | null;
    type?: string | null;
    currency?: string | null;
    railsEligible: Array<"ACH" | "WIRE">;
  }>;
};

export async function createMockBankConnection(params: CreateMockBankConnectionParams) {
  const key = getSecretsEncryptionKey();
  const accessToken = `mock_access_${randomToken()}`;
  const refreshToken = `mock_refresh_${randomToken()}`;

  const accessTokenEncrypted = key ? encryptSecretToBase64url(key, accessToken) : null;
  const refreshTokenEncrypted = key ? encryptSecretToBase64url(key, refreshToken) : null;

  const connectionId = `bankconn_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

  const connection = await prisma.bankConnection.create({
    data: {
      id: connectionId,
      orgId: params.orgId,
      createdByUserId: params.userId,
      provider: "mock",
      institutionName: params.institutionName,
      status: "ACTIVE",
      consentExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      accessTokenEncrypted: accessTokenEncrypted ?? undefined,
      refreshTokenEncrypted: refreshTokenEncrypted ?? undefined,
      lastSyncAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const accounts = [];
  for (const a of params.accounts) {
    const accountId = `bankacct_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
    const row = await prisma.bankAccount.create({
      data: {
        id: accountId,
        orgId: params.orgId,
        connectionId: connection.id,
        name: a.name,
        mask: a.mask ?? null,
        type: a.type ?? null,
        currency: a.currency ?? "USD",
        railsEligible: a.railsEligible,
        ownershipJson: canonicalJsonStringify({
          provider: "mock",
          signal: "not_provided",
        }),
        verificationJson: canonicalJsonStringify({
          provider: "mock",
          status: "unverified",
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    accounts.push(row);
  }

  // For mock, return only redacted identifiers.
  return {
    connection: {
      id: connection.id,
      orgId: connection.orgId,
      provider: connection.provider,
      institutionName: connection.institutionName,
      status: connection.status,
      consentExpiresAt: connection.consentExpiresAt?.toISOString() ?? null,
      lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
      lastError: connection.lastError ?? null,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
      // deterministic token fingerprint for debugging without exposing secrets
      tokenFingerprint: sha256Hex(String(connection.accessTokenEncrypted ?? "")).slice(0, 16),
      encryptedAtRest: Boolean(key),
    },
    accounts: accounts.map((r) => ({
      id: r.id,
      connectionId: r.connectionId,
      name: r.name,
      mask: r.mask ?? null,
      type: r.type ?? null,
      currency: r.currency,
      railsEligible: r.railsEligible as Array<"ACH" | "WIRE">,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

export async function listBankConnections(orgId: string) {
  const rows = await prisma.bankConnection.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((c) => ({
    id: c.id,
    provider: c.provider,
    institutionName: c.institutionName,
    status: c.status,
    consentExpiresAt: c.consentExpiresAt?.toISOString() ?? null,
    lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
    lastError: c.lastError ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
}

export async function listBankAccounts(params: { orgId: string; connectionId: string }) {
  const connection = await prisma.bankConnection.findFirst({
    where: { id: params.connectionId, orgId: params.orgId },
  });
  if (!connection) return null;

  const rows = await prisma.bankAccount.findMany({
    where: { orgId: params.orgId, connectionId: params.connectionId },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    connectionId: r.connectionId,
    name: r.name,
    mask: r.mask ?? null,
    type: r.type ?? null,
    currency: r.currency,
    railsEligible: r.railsEligible as Array<"ACH" | "WIRE">,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

