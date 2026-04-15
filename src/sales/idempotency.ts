import { createHash, randomUUID } from 'node:crypto';

/** Idempotency for CRMEntitySource: adapter_scope + source_id must be unique. */
export function entitySourceKey(adapterScope: string, sourceId: string): string {
  return `${adapterScope}::${sourceId}`;
}

/** Deterministic mutation idempotency from type + target + payload hash. */
export function mutationIdempotencyKey(
  mutationType: string,
  targetEntityId: string | undefined,
  payload: Record<string, unknown>
): string {
  const h = createHash('sha256')
    .update(mutationType)
    .update('\0')
    .update(targetEntityId ?? '')
    .update('\0')
    .update(JSON.stringify(sortKeys(payload)))
    .digest('hex')
    .slice(0, 32);
  return `${mutationType}:${h}`;
}

function sortKeys(obj: Record<string, unknown>): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((x) => (typeof x === 'object' && x !== null ? sortKeys(x as Record<string, unknown>) : x));
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    out[k] =
      typeof v === 'object' && v !== null && !Array.isArray(v)
        ? sortKeys(v as Record<string, unknown>)
        : v;
  }
  return out;
}

/** New apply attempt id (store on Activity / mutation apply log). */
export function newApplyAttemptId(): string {
  return `apply_${randomUUID()}`;
}

/** Outbound send idempotency: tie to SalesAction. */
export function salesActionSendKey(salesActionId: string): string {
  return `send:${salesActionId}`;
}
