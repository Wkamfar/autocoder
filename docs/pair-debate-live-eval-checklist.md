# Pair Debate — 10 live deal evaluation checklist

Use this for the first **real-opportunity** proof, not fixture JSON alone.

## Goal

After **10 debates** on live deals, you should be able to say with evidence:

- Humans **preferred** Pair Debate over single-model baseline when it mattered.
- **Outcomes** and **adoption** were logged (not only “the model sounded smart”).
- **Disagreement quality** was scored honestly (see [pair-debate-eval-rubric.md](./pair-debate-eval-rubric.md)).

## Per run — capture

| Field | Notes |
|-------|--------|
| Date | |
| Deal / account id | From your world JSON |
| `run_id` | From `pair-debate` stdout or export |
| Scope | `--deal` / `--account` / `--contact` |
| **Exports** | `pair-debate --export ./out` and/or `compare-decisions` |
| **Single baseline** | `single-decision` JSON saved, or embedded in `compare-decisions` online |
| **Human rubric** | Tension, disagreement preserved, next step, draft, grounded + **disagreement-quality rows** |
| **Preference** | Single vs Pair vs neither — fill verdict in `comparison.md` |
| **Outcome log** | `pair-debate-outcome` with `--recommended-used`, `--override-reason` if applicable |
| **Buyer outcome** | Reply, stage change, time-to-reply (when known) |
| **Heuristic triage** (optional) | `pair-debate-eval score-run <full.json>` — remember `heuristic_signal_only` |

## Row template (copy 10 times)

```
### Run __ / 10
- Date:
- Deal id:
- run_id:
- Human: Pair better? [ ]  Single better? [ ]  Tie / neither? [ ]
- Rubric notes (1–2 lines):
- Outcome logged? [ ]  Adoption fields complete? [ ]
```

## Commands reference

```bash
# Phase 3 — pick which live deals to include in the 10 (advisory ranking)
nightshift sales top-decisions --limit 15

# Debate + artifacts
nightshift sales pair-debate --deal <id> --export ./out

# A/B markdown (offline — no extra LLM cost)
nightshift sales compare-decisions --single-json ./single.json --pair-json ./out/pair-debate-*-synthesis.json -o comparison.md

# A/B markdown (online — TWO pipelines; read stderr warning)
nightshift sales compare-decisions --deal <id> -o comparison.md

# Log what happened after the human acted
nightshift sales pair-debate-outcome --run <run_id> --deal <id> \
  --recommended-used true --helpfulness 4 --tags your_tag

# If they did not use the recommendation
nightshift sales pair-debate-outcome --run <run_id> --recommended-used false --override-reason timing_changed
```

## Success criterion (product)

**Majority of the 10 runs:** reviewers judge that Pair Debate produced a **sharper, more honest next move** than the single-model baseline for that situation—not higher automated scores alone.
