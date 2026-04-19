/**
 * Phase 3 — optional post-apply CRM → world snapshot refresh (explicit opt-in via env).
 * @see docs/CRM_SALES_OS_UNIFICATION.md §5.3
 */
import path from 'node:path';
import type { SalesRepository } from '../storage/salesRepository.js';
import { writeCrmWorldExport } from './crmWorldExport.js';

export type PostApplySnapshotOutcome =
  | { status: 'disabled' }
  | { status: 'skipped'; reason: 'noop' }
  | { status: 'wrote'; outPath: string }
  | { status: 'error'; message: string };

/** When set, successful CRM writes can refresh a snapshot file (see `maybeRefreshCrmSnapshotAfterApply`). */
export function getPostApplyExportConfig(): {
  outPath: string;
  bridgePath?: string;
} | null {
  const raw = process.env.SALES_POST_APPLY_EXPORT_PATH?.trim();
  if (!raw) return null;
  const outPath = path.resolve(raw);
  const bridgeRaw = process.env.SALES_POST_APPLY_BRIDGE_PATH?.trim();
  const bridgePath = bridgeRaw ? path.resolve(bridgeRaw) : undefined;
  return { outPath, bridgePath };
}

/**
 * After `apply-pending` or `first-ship`, optionally re-export CRM to the configured path.
 * Disabled unless `SALES_POST_APPLY_EXPORT_PATH` is set (no silent disk writes).
 */
export function maybeRefreshCrmSnapshotAfterApply(
  repo: SalesRepository,
  input:
    | {
        kind: 'apply_pipeline';
        pipeline: { mutationsApplied: number; linkMutations: number; dealMutations: number };
      }
    | { kind: 'first_ship_complete' }
): PostApplySnapshotOutcome {
  const cfg = getPostApplyExportConfig();
  if (!cfg) return { status: 'disabled' };

  if (input.kind === 'apply_pipeline') {
    const t =
      input.pipeline.mutationsApplied +
      input.pipeline.linkMutations +
      input.pipeline.dealMutations;
    if (t === 0) return { status: 'skipped', reason: 'noop' };
  }

  try {
    writeCrmWorldExport({ repo, outPath: cfg.outPath, bridgePath: cfg.bridgePath });
    return { status: 'wrote', outPath: cfg.outPath };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: 'error', message };
  }
}
