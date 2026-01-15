import crypto from "crypto";

export function isValidTraceparent(tp: string | undefined | null): boolean {
  if (!tp) return false;
  // Very small validation: `00-<32hex>-<16hex>-<2hex>`
  return /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i.test(tp);
}

export function newTraceId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function newSpanId(): string {
  return crypto.randomBytes(8).toString("hex");
}

export function makeTraceparent(traceId: string, spanId: string = newSpanId(), flags = "01"): string {
  return `00-${traceId}-${spanId}-${flags}`;
}

export function traceIdFromTraceparent(tp: string): string | null {
  if (!isValidTraceparent(tp)) return null;
  return tp.split("-")[1] ?? null;
}

