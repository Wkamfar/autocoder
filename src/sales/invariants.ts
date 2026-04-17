/**
 * NightShift sales mode — system invariants (v7).
 * Enforce these in code paths; do not bypass for convenience.
 */
export const SALES_INVARIANTS = {
  /** Source adapters never INSERT/UPDATE canonical CRM tables directly. */
  ADAPTERS_NO_DIRECT_CANONICAL: 'sales.inv.adapters_no_direct_canonical',
  /** Builder persists proposals as CRMMutation rows only; entity writes go through apply. */
  BUILDER_EMITS_MUTATIONS: 'sales.inv.builder_emits_mutations',
  /** Runtime planning reads only canonical CRM (via CustomerContextBuilder / repos). */
  RUNTIME_READS_CANONICAL_ONLY: 'sales.inv.runtime_reads_canonical_only',
  /** Every outbound email send is tied to a SalesAction row. */
  OUTBOUND_REQUIRES_SALES_ACTION: 'sales.inv.outbound_requires_sales_action',
  /** Canonical rows mutated by builder path must trace to an applied CRMMutation. */
  CANONICAL_UPDATES_TRACE_TO_MUTATION: 'sales.inv.canonical_traces_mutation',
  /** RelationshipEdge rows require non-empty source_evidence. */
  EDGES_REQUIRE_EVIDENCE: 'sales.inv.edges_require_evidence',
  /** Activity is append-only; corrections are new Activity rows, never UPDATE body. */
  ACTIVITY_APPEND_ONLY: 'sales.inv.activity_append_only',
} as const;
