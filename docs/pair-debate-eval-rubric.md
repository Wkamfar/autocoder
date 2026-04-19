# Pair Debate — eval suite and scoring rubric

## Purpose

Move Pair Debate from “interesting” to **dependable** by measuring:

1. Whether the debate **surfaces the real tension** (not generic advice).
2. Whether **disagreement is preserved** in the artifact (not fake consensus).
3. Whether the **next step is sharper** than a single-model baseline.
4. Whether the **draft email is usable** with minor edits.

## Suite layout

- **Fixtures:** `evals/pair-debate/scenarios/*.json` — each file is a `SalesWorldFile` + scope + structural expectations.
- **Validate (no API):** `nightshift sales pair-debate-eval validate` — builds dossiers; checks substrings and length.
- **Heuristic score:** `nightshift sales pair-debate-eval score-synthesis <file.json>` — scores exported `*-synthesis.json` or raw synthesis JSON.

## Automated heuristic (9 points)

See `evals/pair-debate/rubric.json`. Implemented in `src/sales/pairDebate/eval/scoreSynthesis.ts`:

| Signal | Points | Meaning |
|--------|--------|---------|
| `has_next_step` | 2 | Non-empty `recommended_single_next_step` |
| `has_why_now` | 1 | Non-empty `why_now` |
| `has_risks` | 1 | At least one `what_could_go_wrong` |
| `has_draft` | 2 | Non-empty `draft_artifact.content` |
| `acknowledges_disagreement` | 2 | Some `remaining_disagreements` OR `what_would_change_the_recommendation` |
| `not_empty_agreement` | 1 | Non-empty `agreement` |

This does **not** replace human judgment; it catches empty or collapsed outputs.

## Human rubric (0–2 each)

For each real run on a live opportunity, score:

| Criterion | 0 | 1 | 2 |
|-----------|---|---|---|
| **Tension surface** | Missed the main tradeoff | Partial | Named the real conflict (e.g. push vs wait) |
| **Disagreement preserved** | Fake consensus | Some nuance | Honest remaining disagreement in output |
| **Next step actionable** | Vague | OK | One concrete move a rep can execute today |
| **Draft usable** | Not sendable | Needs edits | Sendable with light edits |
| **Grounded in dossier** | Invented facts | Minor drift | Respects truth layer; uses `missing_evidence` well |

### Disagreement quality (required — core product claim)

Pair Debate is not only “sharper text.” Evaluate whether the **debate mechanism** delivered:

| Criterion | 0 | 1 | 2 |
|-----------|---|---|---|
| **Real tension preserved** | Output collapses to one-sided advice | Some nuance | Clear tradeoff remains visible in synthesis (not fake consensus) |
| **Closer updates after challenge** | Round 3 ignores BuyerMind | Weak response | Material revise / defend / concede visible in transcript vs round 1 |
| **Honest synthesis** | Washes away disagreement | Partial | `remaining_disagreements` / `what_would_change` reflects real uncertainty |

If these three score low, the run failed the feature’s purpose even if the draft looks polished.

**Comparison protocol:** run `nightshift sales single-decision --deal …` and `nightshift sales pair-debate --deal …` on the same scope; compare human rubric scores. Prefer `nightshift sales compare-decisions` for a single markdown artifact.

### Automated `score-run` helper

`nightshift sales pair-debate-eval score-run <full.json>` emits **heuristic flags only** (triage). The JSON output includes `"heuristic_signal_only": true`. It is **not** a substitute for the human rubric above.

## Outcome logging (learning loop)

After acting on a recommendation:

`nightshift sales pair-debate-outcome --run <run_id> --deal … --outcome replied_positive --tags stalled_proposal --helpful true`

Feeds `state/pair-debate-outcomes.jsonl` and optional **pattern recall** in future dossiers (`PAIR_DEBATE_NO_PATTERNS=1` disables injection).

## Success metric (product)

Target: **10 real debates** on live opportunities where humans judge Pair Debate produced a **better next move** than they would have made alone — not higher heuristic scores alone.
