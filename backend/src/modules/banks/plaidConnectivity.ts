import axios from "axios";
import crypto from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";
import { getSecretsEncryptionKey, encryptSecretToBase64url, decryptSecretFromBase64url } from "../../lib/secretBox.js";
import { sha256Hex } from "../../lib/sha256.js";

type PlaidEnv = "sandbox" | "development" | "production";

function plaidBaseUrl(env: PlaidEnv): string {
  switch (env) {
    case "sandbox":
      return "https://sandbox.plaid.com";
    case "development":
      return "https://development.plaid.com";
    case "production":
      return "https://production.plaid.com";
  }
}

function requirePlaidCreds(): { clientId: string; secret: string; env: PlaidEnv } {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = (process.env.PLAID_ENV as PlaidEnv | undefined) ?? "sandbox";
  if (!clientId || !secret) throw new Error("PLAID_CLIENT_ID/PLAID_SECRET not configured");
  return { clientId, secret, env };
}

async function plaidPost<T>(path: string, body: any): Promise<T> {
  const { clientId, secret, env } = requirePlaidCreds();
  const url = `${plaidBaseUrl(env)}${path}`;
  const res = await axios.post(url, body, {
    headers: { "Content-Type": "application/json", "PLAID-CLIENT-ID": clientId, "PLAID-SECRET": secret },
    timeout: 20_000,
  });
  return res.data as T;
}

function mustEncryptTokensInThisEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

function encryptTokenOrThrow(token: string): { encrypted: string; encryptedAtRest: boolean } {
  const key = getSecretsEncryptionKey();
  if (!key) {
    if (mustEncryptTokensInThisEnv()) {
      throw new Error("WIRE2_SECRETS_ENCRYPTION_KEY required for token encryption in production");
    }
    // Dev fallback: store plaintext in the encrypted field but clearly mark it.
    return { encrypted: token, encryptedAtRest: false };
  }
  return { encrypted: encryptSecretToBase64url(key, token), encryptedAtRest: true };
}

function decryptTokenIfNeeded(packed: string): string {
  const key = getSecretsEncryptionKey();
  if (!key) return packed;
  try {
    return decryptSecretFromBase64url(key, packed);
  } catch {
    // If key is set but record is plaintext from prior dev runs, keep fallback.
    return packed;
  }
}

export async function createPlaidLinkToken(params: {
  orgId: string;
  userId: string;
  clientUserId: string; // stable per user in the integrator system
  redirectUri?: string | null;
}): Promise<{ link_token: string; expiration: string; request_id?: string }> {
  // Minimal Link token config suitable for Auth/Identity.
  const data = await plaidPost<{ link_token: string; expiration: string; request_id?: string }>(
    "/link/token/create",
    {
      client_name: "POSE Wire2",
      language: "en",
      country_codes: ["US"],
      user: { client_user_id: params.clientUserId },
      products: ["auth", "identity"],
      ...(params.redirectUri ? { redirect_uri: params.redirectUri } : {}),
    }
  );
  return data;
}

export async function exchangePlaidPublicToken(params: {
  orgId: string;
  userId: string;
  publicToken: string;
}): Promise<{
  connection: {
    id: string;
    provider: "plaid";
    institutionName: string;
    status: "ACTIVE" | "DEGRADED" | "REVOKED";
    consentExpiresAt: string | null;
    lastSyncAt: string | null;
    encryptedAtRest: boolean;
    tokenFingerprint: string;
  };
  accounts: Array<{
    id: string;
    connectionId: string;
    name: string;
    mask: string | null;
    type: string | null;
    currency: string;
    railsEligible: Array<"ACH" | "WIRE">;
    createdAt: string;
    updatedAt: string;
  }>;
}> {
  const exchange = await plaidPost<{ access_token: string; item_id: string; request_id?: string }>(
    "/item/public_token/exchange",
    { public_token: params.publicToken }
  );

  const accessTokenEnc = encryptTokenOrThrow(exchange.access_token);

  // Fetch item + institution (best-effort) to name connection.
  const item = await plaidPost<any>("/item/get", { access_token: exchange.access_token }).catch(() => null);
  const institutionId = item?.item?.institution_id ?? null;
  let institutionName = "Plaid (unknown institution)";
  if (institutionId) {
    const inst = await plaidPost<any>("/institutions/get_by_id", {
      institution_id: institutionId,
      country_codes: ["US"],
      options: { include_optional_metadata: true },
    }).catch(() => null);
    if (inst?.institution?.name) institutionName = String(inst.institution.name);
  }

  // Accounts + Auth + Identity signals (minimized snapshots).
  const accounts = await plaidPost<any>("/accounts/get", { access_token: exchange.access_token }).catch(() => null);
  const auth = await plaidPost<any>("/auth/get", { access_token: exchange.access_token }).catch(() => null);
  const identity = await plaidPost<any>("/identity/get", { access_token: exchange.access_token }).catch(() => null);

  const connectionId = `bankconn_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
  const now = new Date();

  const conn = await prisma.bankConnection.create({
    data: {
      id: connectionId,
      orgId: params.orgId,
      createdByUserId: params.userId,
      provider: "plaid",
      institutionName,
      status: "ACTIVE",
      consentExpiresAt: null,
      accessTokenEncrypted: accessTokenEnc.encrypted,
      refreshTokenEncrypted: null,
      lastSyncAt: now,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    },
  });

  const outAccounts: any[] = [];
  const acctList: any[] = Array.isArray(accounts?.accounts) ? accounts.accounts : [];
  for (const a of acctList) {
    const accountId = `bankacct_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
    const plaidAccountId = a?.account_id ? String(a.account_id) : null;
    const type = a?.type ? String(a.type) : null;
    const mask = a?.mask ? String(a.mask) : null;
    const name = a?.name ? String(a.name) : "Account";
    const currency = a?.balances?.iso_currency_code ? String(a.balances.iso_currency_code) : "USD";

    // Plaid signals are optional; store minimized snapshots to support audits without leaking sensitive details.
    const ownershipJson = canonicalJsonStringify({
      provider: "plaid",
      item_id: exchange.item_id,
      institution_id: institutionId,
      plaid_account_id: plaidAccountId,
      identity_summary_present: Boolean(identity),
    });
    const verificationJson = canonicalJsonStringify({
      provider: "plaid",
      fetchedAt: now.toISOString(),
      auth_present: Boolean(auth),
      identity_present: Boolean(identity),
      // Store raw payloads only if explicitly allowed by a future policy; for now keep minimized signal flags.
    });

    const railsEligible: Array<"ACH" | "WIRE"> = [];
    // Heuristic: if Auth is present and account is depository => ACH eligible.
    if (type === "depository") railsEligible.push("ACH");
    // Wire eligibility is not implied by Plaid Link; leave empty unless a later provider supports wire rails.

    const row = await prisma.bankAccount.create({
      data: {
        id: accountId,
        orgId: params.orgId,
        connectionId: conn.id,
        name,
        mask,
        type,
        currency,
        railsEligible,
        ownershipJson,
        verificationJson,
        createdAt: now,
        updatedAt: now,
      },
    });
    outAccounts.push(row);
  }

  return {
    connection: {
      id: conn.id,
      provider: "plaid",
      institutionName: conn.institutionName,
      status: conn.status,
      consentExpiresAt: conn.consentExpiresAt?.toISOString() ?? null,
      lastSyncAt: conn.lastSyncAt?.toISOString() ?? null,
      encryptedAtRest: accessTokenEnc.encryptedAtRest,
      tokenFingerprint: sha256Hex(String(conn.accessTokenEncrypted ?? "")).slice(0, 16),
    },
    accounts: outAccounts.map((r) => ({
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

export async function refreshPlaidConnection(params: {
  orgId: string;
  connectionId: string;
}): Promise<{ ok: boolean; status: "ACTIVE" | "DEGRADED" | "REVOKED"; lastSyncAt: string | null; lastError: string | null }> {
  const conn = await prisma.bankConnection.findFirst({ where: { id: params.connectionId, orgId: params.orgId } });
  if (!conn) throw new Error("Connection not found");
  if (conn.status === "REVOKED") return { ok: false, status: "REVOKED", lastSyncAt: conn.lastSyncAt?.toISOString() ?? null, lastError: conn.lastError ?? null };
  if (!conn.accessTokenEncrypted) throw new Error("Missing access token");

  const accessToken = decryptTokenIfNeeded(conn.accessTokenEncrypted);

  try {
    // Light-touch: item/get (health) + accounts/get (snapshot)
    await plaidPost<any>("/item/get", { access_token: accessToken });
    const accounts = await plaidPost<any>("/accounts/get", { access_token: accessToken });
    const now = new Date();

    // Replace account snapshots (minimized) for this connection.
    await prisma.bankAccount.deleteMany({ where: { orgId: params.orgId, connectionId: conn.id } });
    const acctList: any[] = Array.isArray(accounts?.accounts) ? accounts.accounts : [];
    for (const a of acctList) {
      const accountId = `bankacct_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
      const plaidAccountId = a?.account_id ? String(a.account_id) : null;
      const type = a?.type ? String(a.type) : null;
      const mask = a?.mask ? String(a.mask) : null;
      const name = a?.name ? String(a.name) : "Account";
      const currency = a?.balances?.iso_currency_code ? String(a.balances.iso_currency_code) : "USD";
      const railsEligible: Array<"ACH" | "WIRE"> = type === "depository" ? ["ACH"] : [];
      await prisma.bankAccount.create({
        data: {
          id: accountId,
          orgId: params.orgId,
          connectionId: conn.id,
          name,
          mask,
          type,
          currency,
          railsEligible,
          ownershipJson: canonicalJsonStringify({ provider: "plaid", refreshedAt: now.toISOString(), plaid_account_id: plaidAccountId }),
          verificationJson: canonicalJsonStringify({ provider: "plaid", refreshedAt: now.toISOString() }),
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    await prisma.bankConnection.update({
      where: { id: conn.id },
      data: { status: "ACTIVE", lastSyncAt: now, lastError: null, updatedAt: now },
    });

    return { ok: true, status: "ACTIVE", lastSyncAt: now.toISOString(), lastError: null };
  } catch (err: any) {
    const now = new Date();
    const msg = err?.message || "Plaid refresh failed";
    await prisma.bankConnection.update({
      where: { id: conn.id },
      data: { status: "DEGRADED", lastError: msg, updatedAt: now },
    });
    return { ok: false, status: "DEGRADED", lastSyncAt: conn.lastSyncAt?.toISOString() ?? null, lastError: msg };
  }
}

export async function revokePlaidConnection(params: { orgId: string; connectionId: string }): Promise<{ ok: boolean }> {
  const conn = await prisma.bankConnection.findFirst({ where: { id: params.connectionId, orgId: params.orgId } });
  if (!conn) throw new Error("Connection not found");

  // Best-effort revoke at Plaid (we still revoke locally even if Plaid call fails).
  if (conn.accessTokenEncrypted) {
    try {
      const accessToken = decryptTokenIfNeeded(conn.accessTokenEncrypted);
      await plaidPost<any>("/item/remove", { access_token: accessToken });
    } catch {
      // ignore
    }
  }

  await prisma.bankConnection.update({
    where: { id: conn.id },
    data: { status: "REVOKED", accessTokenEncrypted: null, refreshTokenEncrypted: null, updatedAt: new Date() },
  });
  await prisma.bankAccount.deleteMany({ where: { orgId: params.orgId, connectionId: conn.id } });
  return { ok: true };
}

