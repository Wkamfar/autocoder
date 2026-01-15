import { prisma } from "../../db/prisma.js";
import { canonicalJsonStringify } from "../../lib/canonicalJson.js";
import { sha256Hex } from "../../lib/sha256.js";
import { getActivePolicy } from "../policies/policyService.js";
import { verifyEventChain } from "../evidence/eventChain.js";
import { getActiveSigningKeyId, getSigningKey, isKeyRevoked, listConfiguredSigningKeyIds } from "../../lib/keyManagement.js";
import { makeCompactJws, parseCompactJws, verifyCompactJws } from "../../lib/jws.js";

export type PoseReceiptType = "execution.completed" | "settlement.reported";

export type PoseReceiptPayloadV1 = {
  schema_version: 1;
  orgId: string;
  intentId: string;
  executionRef: string;
  bindingHash: string;
  rail: string;
  amount: { currency: string; minor: string };
  beneficiaryHash: string;
  policyVersion: number | null;
  occurredAt: string; // ISO
  evidence_chain_head: string | null;
  bundleId?: string | null;
  bundleHash?: string | null;
  provider_correlation?: { provider: string; externalRef?: string | null; externalStatus?: string | null } | null;
  request_id?: string | null;
  trace_id?: string | null;
  receiptType: PoseReceiptType;
};

function parseLedgerMetadata(metadataJson: string | null | undefined): any {
  if (!metadataJson) return {};
  try {
    return JSON.parse(metadataJson);
  } catch {
    return {};
  }
}

function stringifyLedgerMetadata(obj: any): string {
  return canonicalJsonStringify(obj ?? {});
}

export async function getPoseJwks(): Promise<{ keys: any[] }> {
  const ids = listConfiguredSigningKeyIds().filter((kid) => !isKeyRevoked(kid));
  const keys = [];
  for (const kid of ids) {
    const k = await getSigningKey(kid);
    keys.push({
      kty: "OKP",
      crv: "Ed25519",
      x: Buffer.from(k.publicKey).toString("base64url"),
      kid,
      use: "sig",
      alg: "EdDSA",
    });
  }
  return { keys };
}

export async function issuePoseVerificationToken(params: {
  orgId: string;
  intentId: string;
  executionRef: string;
  receiptType: PoseReceiptType;
  requestId?: string | null;
  traceId?: string | null;
}): Promise<{ jws: string; kid: string; payload: PoseReceiptPayloadV1 }> {
  const ledger = await prisma.executionLedger.findFirst({
    where: { orgId: params.orgId, executionRef: params.executionRef },
  });
  if (!ledger) throw new Error("Execution not found");

  const intent = await prisma.intent.findFirst({ where: { id: params.intentId, orgId: params.orgId } });
  if (!intent) throw new Error("Intent not found");

  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: intent.beneficiaryId, orgId: params.orgId },
  });
  if (!beneficiary) throw new Error("Beneficiary not found");

  const occurredAt =
    params.receiptType === "settlement.reported"
      ? ledger.reconciliationAt?.toISOString() ?? ledger.executedAt.toISOString()
      : ledger.executedAt.toISOString();

  // Evidence chain head at issuance time (bank-grade linkage).
  const chain = await verifyEventChain(intent.id, intent.orgId);

  const bundle = await prisma.auditBundle.findFirst({
    where: { intentId: intent.id, orgId: intent.orgId },
    orderBy: { createdAt: "desc" },
  });

  const policyPack = await getActivePolicy(intent.orgId);
  const policyVersion = policyPack?.version?.version ?? null;

  const payload: PoseReceiptPayloadV1 = {
    schema_version: 1,
    orgId: intent.orgId,
    intentId: intent.id,
    executionRef: ledger.executionRef,
    bindingHash: intent.bindingHash,
    rail: String(intent.railsType),
    amount: { currency: intent.currency, minor: intent.amountMinor },
    beneficiaryHash: beneficiary.bankTokenHash,
    policyVersion,
    occurredAt,
    evidence_chain_head: chain.chainHash ?? null,
    bundleId: bundle?.id ?? null,
    bundleHash: (bundle as any)?.bundleHash ?? null,
    provider_correlation: ledger.provider
      ? { provider: ledger.provider, externalRef: ledger.externalRef ?? null, externalStatus: ledger.externalStatus ?? null }
      : null,
    request_id: params.requestId ?? null,
    trace_id: params.traceId ?? null,
    receiptType: params.receiptType,
  };

  // Idempotency: persist the first issued JWS per (executionRef, receiptType) in metadataJson.
  const meta = parseLedgerMetadata(ledger.metadataJson);
  const poseReceipts = meta.poseReceipts && typeof meta.poseReceipts === "object" ? meta.poseReceipts : {};
  const existing = poseReceipts[params.receiptType];
  if (existing?.jws && existing?.kid && existing?.payloadCanonicalJson) {
    try {
      const parsed = parseCompactJws(existing.jws);
      if (parsed) {
        const payloadObj = JSON.parse(String(existing.payloadCanonicalJson));
        return { jws: String(existing.jws), kid: String(existing.kid), payload: payloadObj as PoseReceiptPayloadV1 };
      }
    } catch {
      // fallthrough: re-issue and overwrite
    }
  }

  const kid = getActiveSigningKeyId();
  const key = await getSigningKey(kid);
  if (!key.privateKey) throw new Error("SIGNING_PRIVATE_KEY not configured for receipt issuance");

  const { jws, payloadCanonicalJson } = makeCompactJws({
    header: { alg: "EdDSA", kid, typ: "POSE-RECEIPT+JWS" },
    payload,
    privateKey: key.privateKey,
  });

  const updatedMeta = {
    ...meta,
    poseReceipts: {
      ...poseReceipts,
      [params.receiptType]: {
        jws,
        kid,
        payloadCanonicalJson,
        issuedAt: new Date().toISOString(),
        // Stable binding for offline verifiers that want an explicit hash without DB.
        bindingHash: payload.bindingHash,
        receiptId: sha256Hex(payloadCanonicalJson).slice(0, 32),
      },
    },
  };

  await prisma.executionLedger.update({
    where: { executionRef: ledger.executionRef },
    data: { metadataJson: stringifyLedgerMetadata(updatedMeta), updatedAt: new Date() },
  });

  return { jws, kid, payload };
}

export async function verifyPoseReceiptServerSide(params: {
  jws: string;
  expected?: Partial<Pick<PoseReceiptPayloadV1, "orgId" | "intentId" | "executionRef" | "bindingHash" | "receiptType">>;
}): Promise<{
  valid: boolean;
  reasons: string[];
  header?: any;
  payload?: any;
  signerKeyId?: string;
  revoked?: boolean;
}> {
  const reasons: string[] = [];
  const parsed = parseCompactJws(params.jws);
  if (!parsed) return { valid: false, reasons: ["invalid_format"] };

  let header: any;
  try {
    header = JSON.parse(Buffer.from(parsed.headerB64, "base64url").toString("utf8"));
  } catch {
    return { valid: false, reasons: ["invalid_header_json"] };
  }

  const kid = String(header?.kid || "");
  if (!kid) return { valid: false, reasons: ["missing_kid"], header };
  const revoked = isKeyRevoked(kid);
  if (revoked) reasons.push("key_revoked");

  let publicKey: Buffer;
  try {
    const k = await getSigningKey(kid);
    publicKey = k.publicKey;
  } catch {
    return { valid: false, reasons: ["unknown_kid"], header, signerKeyId: kid, revoked };
  }

  const res = verifyCompactJws({ jws: params.jws, publicKey });
  if (!res.valid) reasons.push(res.error || "bad_signature");

  const payload = res.payload as any;
  if (res.valid) {
    // Schema checks (lightweight, bank-grade minimal).
    if (payload?.schema_version !== 1) reasons.push("bad_schema_version");
    if (!payload?.orgId || !payload?.intentId || !payload?.executionRef) reasons.push("missing_required_fields");
    if (!payload?.bindingHash) reasons.push("missing_bindingHash");
    if (!payload?.receiptType) reasons.push("missing_receiptType");
  }

  const expected = params.expected || {};
  for (const k of Object.keys(expected) as Array<keyof typeof expected>) {
    if (expected[k] != null && payload?.[k] !== expected[k]) {
      reasons.push(`expected_mismatch:${String(k)}`);
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
    header,
    payload,
    signerKeyId: kid,
    revoked,
  };
}

