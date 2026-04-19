# Sales — Phase 5 intelligence (`SalesStrategyProfile`)

Phase 5 adds **interpretable learning** from your own `pair-debate-outcomes`
log: tagged segments, stage/value buckets, override reasons, and transparent
**priority boosts** for the Phase 3 decision engine. No black-box model — only
counts, rates, and explicit small-`n` warnings.

## `SalesStrategyProfile` schema (v1)


| Section                      | Purpose                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `tone`, `best_followup_type` | Heuristic labels from edit patterns + winning motion labels                               |
| `avoid`                      | Top `human_override_reason` strings when reps did not use the AI recommendation           |
| `strong_patterns`            | Per-`scenario_tags` aggregates with `interpretation` + strength (`strong` vs `anecdotal`) |
| `pattern_summaries`          | `HistoricalPattern[]` compatible with dossier injection                                   |
| `segment_hints`              | Stage + deal-size bucket bullets for adaptive prompting                                   |
| `segment_priority_tunings`   | Suggested `priority_index` boosts with `basis` citing `n`                                 |
| `extraction`                 | Row counts, `min_sample_floor`, honesty **warnings**                                      |


See `src/sales/intelligence/types.ts` and `examples/strategy-profile.sample.json`.

## Pattern extraction

`extractStrategyProfile({ outcomes, world?, company_id? })`:

1. Joins `**deal_id` → deal** from `sales-world.json` when `--world` is passed (stage + nominal USD → bucket).
2. Aggregates by `**scenario_tags`** (rows without tags roll into `__untagged__`).
3. Aggregates by `**stage|value_bucket**` for segment hints and priority tunings.
4. Emits **warnings** when data is thin or tags are missing.

Strength uses the same floor as patterns: `PAIR_DEBATE_PATTERN_MIN_N` (default 3).

## CLI — build profile JSON

```bash
nightshift sales strategy-extract [--world path/to/sales-world.json] [--out path] [--company id] [--json]
```

Writes `state/sales-strategy-profile.json` by default (`SALES_STRATEGY_PROFILE_PATH` overrides).

## Runtime behavior

- **Pair Debate:** if a profile file exists, a short **adaptive block** is appended to the **Closer** system prompt (segment match + top pattern + warnings).
- **Top decisions:** `priority_index` may gain `**learned_priority_boost`** when the deal’s `stage|bucket` matches a tuning row.

## Environment


| Variable                      | Role                                   |
| ----------------------------- | -------------------------------------- |
| `SALES_STRATEGY_PROFILE_PATH` | Profile JSON path                      |
| `SALES_COMPANY_ID`            | Optional `company_id` field in profile |


## What not to do

- Do not treat `anecdotal` rows as statistical proof — the UI and prompts say so.
- Do not ship cross-company aggregation here — stays local to your logs + world file.

