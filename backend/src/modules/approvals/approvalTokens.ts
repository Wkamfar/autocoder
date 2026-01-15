import { prisma } from "../../db/prisma.js";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";
import { randomToken, sha256Hex } from "../../lib/sha256.js";

const APPROVAL_TOKEN_TTL_MINUTES = 15;

export async function mintApprovalToken(params: {
  intentId: string;
  orgId: string;
  bindingHash: string;
}): Promise<{
  token: string | null;
  tokenHash: string;
  expiresAt: Date;
  alreadyExists: boolean;
}> {
  // Agent C: Check for existing active token (uniqueness guard)
  const existing = await prisma.approvalToken.findFirst({
    where: {
      intentId: params.intentId,
      bindingHash: params.bindingHash,
      invalidatedAt: null,
      consumedAt: null,
    },
  });

  if (existing) {
    // Return existing token hash (never return plaintext token twice)
    return {
      token: null, // Never return plaintext token again
      tokenHash: existing.tokenHash,
      expiresAt: existing.expiresAt,
      alreadyExists: true,
    };
  }

  // Mint new token
  const token = randomToken();
  const tokenHash = sha256Hex(canonicalJsonStringify({ token }));
  const expiresAt = new Date(Date.now() + APPROVAL_TOKEN_TTL_MINUTES * 60_000);

  await prisma.approvalToken.create({
    data: {
      id: `appr_${params.intentId}_${Date.now()}`,
      intentId: params.intentId,
      orgId: params.orgId,
      tokenHash,
      bindingHash: params.bindingHash,
      expiresAt,
    },
  });

  return { token, tokenHash, expiresAt, alreadyExists: false };
}

export async function invalidateApprovalTokens(intentId: string) {
  await prisma.approvalToken.updateMany({
    where: { intentId, invalidatedAt: null },
    data: { invalidatedAt: new Date() },
  });
}

export async function consumeApprovalToken(params: {
  token: string;
  intentId: string;
  bindingHash: string;
}) {
  const tokenHash = sha256Hex(canonicalJsonStringify({ token: params.token }));
  const now = new Date();

  const row = await prisma.approvalToken.findUnique({ where: { tokenHash } });
  if (!row) return { ok: false as const, reason: "not_found" as const };
  if (row.intentId !== params.intentId) return { ok: false as const, reason: "wrong_intent" as const };
  if (row.bindingHash !== params.bindingHash) return { ok: false as const, reason: "binding_mismatch" as const };
  if (row.invalidatedAt) return { ok: false as const, reason: "invalidated" as const };
  if (row.consumedAt) return { ok: false as const, reason: "consumed" as const };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false as const, reason: "expired" as const };

  await prisma.approvalToken.update({
    where: { id: row.id },
    data: { consumedAt: now },
  });

  return { ok: true as const };
}

