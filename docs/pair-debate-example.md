# Pair Debate — example (Acme)

This is the condensed reference arc from the product spec: procurement framing → BuyerMind challenge → Closer concession → honest synthesis.

## Setup

1. Copy `examples/sales-world.sample.json` to `state/sales-world.json` (or set `SALES_WORLD_JSON`).
2. Run:

```bash
nightshift sales pair-debate --deal acme-expansion-2026
```

## Expected debate shape

- **R1 — Closer:** Proposes a follow-up; may name procurement; seeds `disagreement_register` (e.g. `send_now_vs_wait`).
- **R2 — BuyerMind:** Attacks premature internal framing; expands `missing_evidence`; prefers softer or delayed motion.
- **R3 — Closer:** Revises draft to remove invented blockers; narrows CTA.

## Output

- JSONL audit under `state/pair-debate-runs/<runId>.jsonl`
- Final **synthesis** JSON: agreement, remaining disagreements, single recommended step, draft email, `human_decision_required: true`

Pair Debate is **advisory-only** in v1: it does not write CRM state.

## Export (workflow)

```bash
nightshift sales pair-debate --deal acme-expansion-2026 --export ./out
```

Writes `pair-debate-<run_id>-synthesis.json`, `-memo.md`, `-draft-email.txt`, and `-full.json`.

## Phase 3 — Top decisions today (prioritization)

Rank which deals deserve a debate **before** you pick one manually:

```bash
nightshift sales top-decisions --limit 10
# machine-readable:
nightshift sales top-decisions --json
```

Uses `DecisionScore` + trigger rules on your `sales-world.json` (see
[sales-decision-engine.md](./sales-decision-engine.md)). Advisory only — it does
not run Pair Debate or change CRM state.

## Phase 4 — SalesAction + policy (execution shell)

After you have synthesis, represent the send as a **`SalesAction`**, run policy,
then record audit (assisted-first; no default auto-send in this repo):

```bash
nightshift sales sales-action policy-eval examples/sales-action.sample.json \
  examples/sales-action-context.sample.json
nightshift sales sales-action audit-append path/to/approved-action.json
```

See [sales-execution.md](./sales-execution.md).

## Phase 5 — Strategy profile (compounding intelligence)

Rebuild your company-specific profile from logged outcomes (tag rows with
`--tags` on `pair-debate-outcome` for best results):

```bash
nightshift sales strategy-extract --world examples/sales-world.sample.json
```

Produces `state/sales-strategy-profile.json` (or `SALES_STRATEGY_PROFILE_PATH`).
Pair Debate then **biases the Closer** with interpretable bullets; `top-decisions`
may add a small **learned priority boost** by stage/deal-size segment. See
[sales-intelligence.md](./sales-intelligence.md).

## Outcome logging (learning loop)

Appends to `state/pair-debate-outcomes.jsonl` (or `PAIR_DEBATE_OUTCOMES_PATH`). Future dossiers can include **historical patterns** (optional seed: `examples/pair-debate-patterns.seed.json` → `state/pair-debate-patterns.seed.json`, or set `PAIR_DEBATE_PATTERNS_SEED`).

**Revenue outcome + adoption (recommended):**

```bash
nightshift sales pair-debate-outcome --run <run_id> --deal acme-expansion-2026 \
  --outcome replied_positive --tags stalled_proposal --helpful true \
  --recommended-used true --draft-as-is false --human-modified light \
  --helpfulness 4
```

**If the rep did not use the recommendation**, log why:

```bash
nightshift sales pair-debate-outcome --run <run_id> --deal acme-expansion-2026 \
  --recommended-used false --override-reason timing_changed
```

`--override-reason` can be free text or a short token (e.g. `preferred_relationship_tone`, `knew_private_context`, `buyer_replied_before_send`, `output_not_sharp_enough`, `disagreed_with_strategy`, `other`). Adoption fields are for **trust and learning**; they do not replace human rubric scoring on live deals.

## Single-model baseline (A/B)

```bash
nightshift sales single-decision --deal acme-expansion-2026
```

## Compare decisions (markdown A/B)

**Offline** (reuse saved JSON; no extra LLM calls):

```bash
nightshift sales compare-decisions \
  --single-json ./single-synthesis.json \
  --pair-json ./out/pair-debate-<run_id>-synthesis.json \
  -o comparison.md
```

**Online** (runs **two** full pipelines — read the cost/latency warning on stderr):

```bash
nightshift sales compare-decisions --deal acme-expansion-2026 -o comparison.md
```

Fill the **Verdict** section at the bottom of `comparison.md` after review.

## Eval suite

```bash
nightshift sales pair-debate-eval validate
nightshift sales pair-debate-eval score-synthesis ./out/pair-debate-<run_id>-synthesis.json
nightshift sales pair-debate-eval score-run ./out/pair-debate-<run_id>-full.json
```

`score-run` is **heuristic triage only** (`heuristic_signal_only` in JSON). Rubric: [pair-debate-eval-rubric.md](./pair-debate-eval-rubric.md).

## 10 live deals checklist

[pair-debate-live-eval-checklist.md](./pair-debate-live-eval-checklist.md)
