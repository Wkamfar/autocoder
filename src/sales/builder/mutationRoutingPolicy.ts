/**
 * Default auto_apply_allowed by mutation type (plan §5).
 * Callers still set final flag using confidence + source tier + this baseline.
 */
import { CRMMutationType } from '../types/enums.js';
import type { CRMMutationType as MutationType } from '../types/enums.js';

export interface MutationRoutingContext {
  /** create_account: hypothesis present or explicitly waived for watchlist */
  hypothesisPresentOrWaivedForWatchlist?: boolean;
  /** update_account: destructive name/domain change */
  isDestructiveAccountUpdate?: boolean;
  /** create_contact: manual / network attestation */
  isManualAttestedContact?: boolean;
  /** attach_relationship */
  edgeConfidence?: number;
  edgeConfidenceThreshold?: number;
  /** update_deal_stage */
  dealStageRequiresReview?: boolean;
}

const EDGE_THRESHOLD = 0.72;

/**
 * Baseline auto-apply eligibility. Returns false unless policy explicitly allows.
 * Mining / Builder should pass conservative flags so most contact/merge paths stay false.
 */
export function defaultAutoApplyAllowed(
  mutationType: MutationType,
  ctx: MutationRoutingContext = {}
): boolean {
  switch (mutationType) {
    case CRMMutationType.create_account:
      return ctx.hypothesisPresentOrWaivedForWatchlist === true;
    case CRMMutationType.update_account:
      return ctx.isDestructiveAccountUpdate !== true;
    case CRMMutationType.create_contact:
      return ctx.isManualAttestedContact === true;
    case CRMMutationType.update_contact:
      return false;
    case CRMMutationType.merge_contact:
      return false;
    case CRMMutationType.create_deal:
      return false;
    case CRMMutationType.update_deal_stage:
      return ctx.dealStageRequiresReview !== true;
    case CRMMutationType.attach_relationship: {
      const th = ctx.edgeConfidenceThreshold ?? EDGE_THRESHOLD;
      const c = ctx.edgeConfidence ?? 0;
      return c >= th;
    }
    case CRMMutationType.mark_suppressed:
      return false;
    case CRMMutationType.mark_stale:
      return true;
    case CRMMutationType.assign_owner:
      return false;
    default:
      return false;
  }
}
