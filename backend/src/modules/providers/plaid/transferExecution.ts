import axios from "axios";
import { prisma } from "../../../db/prisma.js";
import { decryptSecretFromBase64url, getSecretsEncryptionKey } from "../../../lib/secretBox.js";

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

async function plaidPost<T>(path: string, body: any): Promise<{ data: T; request_id?: string }> {
  const { clientId, secret, env } = requirePlaidCreds();
  const url = `${plaidBaseUrl(env)}${path}`;
  const res = await axios.post(url, body, {
    headers: { "Content-Type": "application/json", "PLAID-CLIENT-ID": clientId, "PLAID-SECRET": secret },
    timeout: 20_000,
  });
  return { data: res.data as T, request_id: (res.data as any)?.request_id };
}

function decryptIfNeeded(packed: string): string {
  const key = getSecretsEncryptionKey();
  if (!key) return packed;
  try {
    return decryptSecretFromBase64url(key, packed);
  } catch {
    return packed;
  }
}

function extractPlaidAccountIdFromOwnershipJson(ownershipJson: string | null | undefined): string | null {
  if (!ownershipJson) return null;
  try {
    const o = JSON.parse(ownershipJson);
    const v = o?.plaid_account_id;
    return v ? String(v) : null;
  } catch {
    return null;
  }
}

export type PlaidRecipientDetails = {
  name: string;
  // Sandbox-only / integrator-provided bank details. Do NOT log these.
  routingNumber: string;
  accountNumber: string;
};

export async function plaidTransferExecute(params: {
  orgId: string;
  executionRef: string;
  idempotencyKey: string; // pass through to Plaid as idempotency key
  amountMinor: string;
  currency: string;
  recipient: PlaidRecipientDetails;
}): Promise<{
  transfer_id: string;
  status: string;
  request_id?: string;
}> {
  // Pick an ACTIVE Plaid connection + ACH-eligible account.
  const conn = await prisma.bankConnection.findFirst({
    where: { orgId: params.orgId, provider: "plaid", status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (!conn?.accessTokenEncrypted) throw new Error("No ACTIVE Plaid bank connection available for execution");

  const account = await prisma.bankAccount.findFirst({
    where: { orgId: params.orgId, connectionId: conn.id },
    orderBy: { createdAt: "desc" },
  });
  if (!account) throw new Error("No Plaid bank account available for execution");

  const accessToken = decryptIfNeeded(conn.accessTokenEncrypted);
  const plaidAccountId = extractPlaidAccountIdFromOwnershipJson(account.ownershipJson);
  if (!plaidAccountId) throw new Error("Missing plaid_account_id for selected bank account (re-link or refresh)");

  // 1) Create recipient
  const { data: recip, request_id: recipReqId } = await plaidPost<{ recipient_id: string }>(
    "/transfer/recipient/create",
    {
      name: params.recipient.name,
      // Bank account details
      iban: null,
      address: null,
      email: null,
      phone_number: null,
      // US account details
      routing_number: params.recipient.routingNumber,
      account_number: params.recipient.accountNumber,
    }
  );

  // 2) Authorization (bank-grade: explicit risk check step)
  const { data: authz, request_id: authReqId } = await plaidPost<{ authorization: { id: string; decision: string } }>(
    "/transfer/authorization/create",
    {
      access_token: accessToken,
      account_id: plaidAccountId,
      type: "credit",
      network: "ach",
      amount: (Number(params.amountMinor) / 100).toFixed(2), // Plaid expects decimal string dollars
      ach_class: "ppd",
      user: { legal_name: "POSE Wire2" },
      device: { ip_address: "127.0.0.1" },
    }
  );

  const authorizationId = (authz as any)?.authorization?.id;
  const decision = (authz as any)?.authorization?.decision;
  if (!authorizationId) throw new Error("Plaid authorization missing id");
  if (decision && String(decision).toLowerCase() === "declined") {
    throw new Error("Plaid authorization declined");
  }

  // 3) Create transfer (idempotent)
  const { data: created, request_id: createReqId } = await plaidPost<{ transfer: { id: string; status: string } }>(
    "/transfer/create",
    {
      access_token: accessToken,
      account_id: plaidAccountId,
      authorization_id: authorizationId,
      description: `POSE execution ${params.executionRef}`,
      amount: (Number(params.amountMinor) / 100).toFixed(2),
      currency: params.currency,
      ach_class: "ppd",
      type: "credit",
      network: "ach",
      // Plaid idempotency (string)
      idempotency_key: params.idempotencyKey,
      recipient_id: (recip as any)?.recipient_id,
    }
  );

  const transferId = (created as any)?.transfer?.id;
  const status = (created as any)?.transfer?.status;
  if (!transferId) throw new Error("Plaid transfer create missing transfer_id");

  return { transfer_id: String(transferId), status: String(status || "unknown"), request_id: createReqId || authReqId || recipReqId };
}

export function isPlaidTransferEnabled(): boolean {
  return process.env.PLAID_TRANSFER_ENABLED === "true";
}

export function requireIdempotencyKeyForExecution(rawIdempotencyKey: string | undefined): string {
  if (process.env.NODE_ENV === "production" && !rawIdempotencyKey) {
    throw new Error("X-Idempotency-Key is required for production execution routes");
  }
  return rawIdempotencyKey || `dev_${Date.now()}`;
}

