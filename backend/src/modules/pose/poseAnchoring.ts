import axios from "axios";
import { prisma } from "../../db/prisma.js";
import { sha256Hex } from "../../lib/sha256.js";
import { logger } from "../../lib/observability.js";

function envBool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v == null) return fallback;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

function bytes32FromSha256Hex(hexNo0x: string): string {
  // hexNo0x: 64 hex chars
  if (!/^[0-9a-f]{64}$/i.test(hexNo0x)) throw new Error("invalid_sha256_hex");
  return `0x${hexNo0x.toLowerCase()}`;
}

function normalizeBytes32(input: string): string {
  const raw = String(input || "").trim().toLowerCase();

  // Wire2 stores sha256 hashes as 64-hex *without* 0x (internal).
  // POSE Core expects bytes32 with 0x prefix (external).
  if (/^[0-9a-f]{64}$/.test(raw)) {
    return `0x${raw}`;
  }

  const s = raw.startsWith("0x") ? raw : raw;
  if (!s.startsWith("0x")) throw new Error("bad_bytes32_format");
  if (s.length !== 66) throw new Error("bad_bytes32_length");
  if (!/^0x[0-9a-f]{64}$/.test(s)) throw new Error("bad_bytes32_hex");
  return s;
}

export function deriveOrgRef(orgId: string): string {
  return bytes32FromSha256Hex(sha256Hex(`org:${orgId}`));
}

export function deriveIntentRef(orgId: string, intentId: string): string {
  return bytes32FromSha256Hex(sha256Hex(`intent:${orgId}:${intentId}`));
}

export async function poseCoreReady(): Promise<boolean> {
  const url = process.env.POSE_CORE_HEALTH_URL || "https://api.testnet.pose.xyz/health";
  try {
    const res = await axios.get(url, { timeout: 2000, validateStatus: () => true });
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
}

export async function anchorIntentEventViaPoseCore(params: {
  orgId: string;
  intentId: string;
  seq: number;
  eventHash: string;
  prevEventHash: string | null;
  eventType?: string;
  requestId?: string | null;
  traceId?: string | null;
}): Promise<{ ok: true; txHash: string } | { ok: false; error: string }> {
  const enabled = envBool("POSE_ANCHORING_ENABLED", false);
  if (!enabled) {
    return { ok: false, error: "POSE_ANCHORING_DISABLED" };
  }

  const apiUrl = process.env.POSE_ANCHOR_API_URL || "https://api.testnet.pose.xyz/api/pose/anchors/intent-event";

  // Derived privacy-safe identifiers
  const orgRef = deriveOrgRef(params.orgId);
  const intentRef = deriveIntentRef(params.orgId, params.intentId);

  const eventHash = normalizeBytes32(params.eventHash);
  const prevEventHash =
    params.seq === 1
      ? "0x" + "0".repeat(64)
      : params.prevEventHash
        ? normalizeBytes32(params.prevEventHash)
        : "0x" + "0".repeat(64);

  // Quick readiness dependency check (avoid hammering POSE Core during incidents)
  const ready = await poseCoreReady();
  if (!ready) return { ok: false, error: "POSE_CORE_NOT_READY" };

  try {
    const res = await axios.post(
      apiUrl,
      {
        orgRef,
        intentRef,
        sequence: params.seq,
        eventHash,
        prevEventHash,
        source: "wire2",
        eventType: params.eventType || null,
        requestId: params.requestId || null,
        traceId: params.traceId || null,
      },
      { timeout: 10_000, validateStatus: () => true }
    );

    const txHash = (res.data as any)?.txHash;
    if (res.status >= 200 && res.status < 300 && typeof txHash === "string") {
      return { ok: true, txHash: String(txHash) };
    }
    return { ok: false, error: `POSE_CORE_ERROR status=${res.status} body=${JSON.stringify(res.data).slice(0, 800)}` };
  } catch (e: any) {
    return { ok: false, error: e?.message ? String(e.message) : "POSE_CORE_ERROR" };
  }
}

export async function processPoseAnchorIntentEventJob(params: {
  jobId: string;
  payload: {
    orgId?: string;
    intentId?: string;
    seq?: number;
    eventType?: string;
    eventHash?: string;
    prevEventHash?: string | null;
    requestId?: string | null;
    traceId?: string | null;
  };
}): Promise<void> {
  const { jobId, payload } = params;
  const orgId = payload.orgId;
  const intentId = payload.intentId;
  const seq = payload.seq;
  const eventHash = payload.eventHash;
  const prevEventHash = payload.prevEventHash ?? null;

  if (!orgId || !intentId || !seq || !eventHash) {
    // Let worker mark DEAD with a clear message.
    throw new Error("missing_payload_fields");
  }

  // Skip when disabled (dev convenience). We still write a traceable "skipped" error on the event row.
  if (!envBool("POSE_ANCHORING_ENABLED", false)) {
    await prisma.intentEvent
      .update({
        where: { intentId_seq: { intentId, seq } },
        data: { poseAnchorLastError: "skipped:POSE_ANCHORING_DISABLED" },
      })
      .catch(() => null);
    logger.info("pose anchoring skipped (disabled)", { jobId, orgId, intentId, seq });
    return;
  }

  const res = await anchorIntentEventViaPoseCore({
    orgId,
    intentId,
    seq,
    eventType: payload.eventType,
    eventHash,
    prevEventHash,
    requestId: payload.requestId ?? null,
    traceId: payload.traceId ?? null,
  });

  if (!res.ok) {
    await prisma.intentEvent
      .update({
        where: { intentId_seq: { intentId, seq } },
        data: { poseAnchorLastError: res.error },
      })
      .catch(() => null);
    throw new Error(res.error);
  }

  await prisma.intentEvent.update({
    where: { intentId_seq: { intentId, seq } },
    data: {
      poseAnchorTxHash: res.txHash,
      poseAnchoredAt: new Date(),
      poseAnchorLastError: null,
    },
  });

  logger.info("pose anchoring succeeded", { jobId, orgId, intentId, seq, txHash: res.txHash });
}

