/**
 * Canonical entity merge policy (v7).
 * Used by merge_contact apply — survivor selection and field precedence.
 */
export const MERGE_POLICY = {
  /** Prefer contact with higher trust evidence / human_verified source. */
  primaryContact: 'prefer_higher_trust_then_newer' as const,
  /** Field precedence: non-null over null; then more recent last_verified_at. */
  fieldPrecedence: 'verified_non_null_recency' as const,
  /** All edges from merged-away contact → survivor; set superseded_by_edge_id on old. */
  edgeReassignment: 'repoint_to_survivor' as const,
  /** Append Activity contact_merged linking old_id → new_id. */
  activityContinuity: 'append_merge_event' as const,
  /** Union suppression: if either contact email suppressed, survivor carries suppression. */
  suppressionInheritance: 'union_emails' as const,
};
