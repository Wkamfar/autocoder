# Sales — Phase 3 decision engine

Phase 3 turns Pair Debate from a **command you run** into a **prioritization
surface**: which open deals deserve a structured debate *right now*. Everything
here is **advisory** — no CRM mutations, no auto-send, no background LLM runs.

## `DecisionScore` schema (v1)

Each ranked row is a `DecisionScore`:

| Field | Type | Meaning |
|-------|------|---------|
| `deal_id` | string | Deal key in `sales-world.json` |
| `account_id` | string | Owning account |
| `account_name`, `deal_name` | string? | Display |
| `deal_value` | number | Nominal USD (`value_cents / 100` when present) |
| `staleness` | number | Days since last touch (`last_touch_days_ago` or 0) |
| `stage_risk` | string | CRM stage label (same as `deal.stage`) |
| `uncertainty` | 0..1 | Pre-debate model: staleness, objections, timing, stage |
| `expected_impact` | 0..1 | Where a quality debate is likely to move the needle |
| `priority_index` | 0..100 | Sort key (higher = more urgent) |
| `trigger_reasons` | string[] | Which heuristic gates fired (for transparency) |
| `debate_recommended` | boolean | `priority_index` + trigger count thresholds |

JSON exports from the CLI include `schema_version: "1"`.

## Trigger rules (labels)

Triggers explain **why** a deal surfaced — they are not independent ML
predictions. Defaults are tuned via env (below).

1. **deal value** — `deal_value ≥ DECISION_TRIGGER_MIN_DEAL_USD` (0 disables this label).
2. **Stall** — `staleness ≥ DECISION_TRIGGER_STALL_DAYS`.
3. **High-touch stage** — `deal.stage` contains a substring from
   `DECISION_TRIGGER_STAGES` (e.g. proposal, pricing).
4. **Uncertainty** — modeled `uncertainty ≥ DECISION_TRIGGER_MIN_UNCERTAINTY`.
5. **Conflicting signals** — `objections_raised.length ≥ DECISION_TRIGGER_CONFLICTING_OBJ`.
6. **Override pattern** — recent `pair-debate-outcomes.jsonl` rows for this
   **account** with a non-empty `human_override_reason` (count ≥
   `DECISION_OVERRIDE_PATTERN_MIN` within `DECISION_OVERRIDE_LOOKBACK_DAYS`).

`debate_recommended` is true when:

- `priority_index ≥ DECISION_MIN_PRIORITY_INDEX`, and
- at least `DECISION_DEBATE_MIN_TRIGGERS` trigger labels matched.

## Suppression

In `sales-world.json`, `suppression_flags` may include:

- `debate:all` — exclude every deal from ranking.
- `deal:<deal_id>` — skip one deal.
- `account:<account_id>` — skip all deals for that account.

## CLI — top decisions today

```bash
nightshift sales top-decisions [--world path/to/sales-world.json] [--limit 10] [--json] [--all]
```

- **`--json`** — machine-readable bundle with `decisions[]` and a small config snapshot.
- **`--all`** — list scored deals even when `debate_recommended` is false (debug / tuning).

Human output ends with a copy-paste `nightshift sales pair-debate --deal …` line per row.

## Environment variables

| Variable | Role |
|----------|------|
| `SALES_WORLD_JSON` | Path to world file (default `STATE_DIR/sales-world.json`) |
| `DECISION_TRIGGER_MIN_DEAL_USD` | Value trigger floor (default `25000`; `0` disables) |
| `DECISION_TRIGGER_STALL_DAYS` | Stall trigger (default `7`) |
| `DECISION_TRIGGER_STAGES` | Comma list of stage substrings (default proposal, pricing, negotiat, contract) |
| `DECISION_TRIGGER_MIN_UNCERTAINTY` | Uncertainty trigger (default `0.55`) |
| `DECISION_TRIGGER_CONFLICTING_OBJ` | Objections count for conflicting-signals label (default `2`) |
| `DECISION_MIN_PRIORITY_INDEX` | Minimum score for `debate_recommended` (default `35`) |
| `DECISION_DEBATE_MIN_TRIGGERS` | Minimum trigger labels (default `1`) |
| `DECISION_OVERRIDE_PATTERN_MIN` | Override reasons in lookback (default `2`) |
| `DECISION_OVERRIDE_LOOKBACK_DAYS` | Lookback for overrides (default `90`) |
| `DECISION_IMPACT_REFERENCE_USD` | Normalizes deal size in scoring (default `200000`) |

## Relationship to Pair Debate

1. Run `top-decisions` to pick a deal.
2. Run `pair-debate` (or `compare-decisions`) on that deal.
3. Log outcomes with `pair-debate-outcome` so Phase 2 learning and override
   patterns stay grounded.

This document replaces informal “when should I debate?” guesswork with an
explicit, tunable policy — still **human-controlled** execution.

**Next:** when a debate produces a draft you intend to send, Phase 4 wraps it in
[`SalesAction`](./sales-execution.md) + policy + audit — still no default auto-send.
