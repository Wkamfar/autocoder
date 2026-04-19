/**
 * Canonical entity merge policy (v7) — plan §4.
 * Used by merge_contact apply: survivor selection, field precedence, edges, activities, suppression.
 */
export const MERGE_POLICY = {
  /** Prefer contact with higher trust evidence / human_verified source. */
  primaryContact: 'prefer_higher_trust_then_newer' as const,
  /** Field precedence: non-null over null; then more recent last_verified_at. */
  fieldPrecedence: 'verified_non_null_recency' as const,
  /** Ordered precedence for conflicting scalar fields: manual attestation > authoritative source > newest verified > oldest. */
  fieldPrecedenceOrder: [
    'manual_attestation',
    'authoritative_source',
    'newest_verified',
    'oldest',
  ] as const,
  /** All edges from merged-away contact → survivor; set superseded_by_edge_id on old. */
  edgeReassignment: 'repoint_to_survivor' as const,
  /** Append Activity contact_merged linking old_id → new_id; rewrite prior activities' entity_id to survivor. */
  activityContinuity: 'rewrite_entity_id_plus_merge_event' as const,
  /** Union suppression: suppressed emails remain on suppression_list; survivor is the operational record. */
  suppressionInheritance: 'union_emails_on_list' as const,
};
