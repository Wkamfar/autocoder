# Company pipeline CSV — parametric / prediction-market ICP

## What the importer does

`nightshift sales import-csv <file.csv>` reads **core** columns plus **any extra headers** you add. The file is parsed with **RFC 4180** rules (quoted fields, commas inside quotes) via `csv-parse`.

**Minimum columns:** `company` and **`email` *or* `domain`**. If `email` is omitted but `domain` is present, the importer uses `unknown@<domain>` as a placeholder contact until you attach a real address.

**Duplicate domains** in a single import: only the **first** row per normalized domain is turned into mutations (later rows are skipped) so pasted sheets with duplicate companies do not create junk accounts.

Extra columns are stored in SQLite on the **account** as:

- **`segment`** — if you include a `segment` column, it maps to `accounts.segment` (and is removed from the metrics blob so it is not duplicated in JSON).
- **`score_json.pipeline`** — structured as:
  - `source`: `csv_import`
  - `vertical`: `parametric_risk_markets`
  - `imported_at`: ISO timestamp
  - `raw`: key/value map of **every non-core column** except `segment` (strings), including firmographics (`employee_band`, `revenue_band`, `regions`, …), evidence (`evidence_url`, `hq_verified`, …), intro path, risk tags (`primary_risk_vector`), and outreach / record metadata (`contact_confidence`, `email_verified`, `outreach_eligible`, `record_type`).

If you include **`opportunity_hypothesis`**, **`why_now`**, **`icp_fit_score`**, **`warmth_score`**, **`buyer_roles`**, **`tier`**, those values are folded into **`score_json.opportunity_hypothesis`** and **`icp_snapshot`** (sheet scores are treated as 0–10 → normalized 0–1), not only into `pipeline.raw`.

On import, the Builder also merges **frozen v1 blocks** (see TypeScript types in `src/sales/types/scoreJsonContracts.ts` and `import { … } from './sales/contracts.js'`):

| Key | Purpose |
|-----|---------|
| `opportunity_hypothesis` | `OpportunityHypothesisV1` — risk thesis, use case, buying center, `why_now`, `fit_score`, evidence refs |
| `icp_snapshot` | `ICPScoreSnapshotV1` — aggregate fit score, component scores, explain lines |
| `outreach` | `OutreachReadinessV1` — eligible vs not (distinct from suppression) |
| `candidate_routing` | `CandidateRoutingMetaV1` — promote / watchlist / discard |

Canonical **freshness** on accounts (and contacts when set) uses `last_verified_at`, `freshness_score`, `stale_reason` on the entity row; CSV import sets initial freshness from trust tier.

Core columns (fixed names, case-insensitive header row):

| Column   | Required | Notes                          |
|----------|----------|--------------------------------|
| `company`| yes      | Account name                   |
| `email`  | yes      | Primary contact email          |
| `domain` | no       | Corporate domain               |
| `name`   | no       | Contact full name              |

All other headers become **pipeline metrics** in `score_json.pipeline.raw`. You can add new columns anytime without code changes.

## Suggested fields for “mid-tier co-creation” (parametric insurance / alt risk)

Use whatever you actually collect; names are yours. Examples that map well to **mid-market partners** (not giant captives, not tiny SMB):

- **`segment`** — e.g. `mid_market_parametric_partner` to tag ICP in SQL and filters.
- **`employee_band`**, **`revenue_usd_band`** — rough size (avoid precise numbers if privacy-sensitive).
- **`industry`**, **`regulated`** — sector and regulatory load (0/1).
- **`regions`** — geographies for peril / basis risk (semicolon-separated is fine).
- **`captive_or_alt_risk`** — already use alternative risk financing (0/1).
- **`parametric_maturity`** — none | exploring | pilot | scaling.
- **`innovation_partner_fit`** — 0–1 score if you model it.
- **`mid_market_focus`** — 1 if this account is explicitly in your target band.
- **`notes`** — free text; stays in `raw` for search / LLM / later ETL.

## Limitations

- Simple comma-splitting: **do not put unescaped commas inside a field** unless you switch to TSV or a real CSV writer.
- For very wide or nested data, prefer a future **JSON import** that writes the same `segment` + `score_json` shape.

## Example file

See `examples/companies_parametric_icp.sample.csv`.

## Milestone scale (~100 companies)

Generate a 100-row test CSV: `node scripts/gen-milestone-csv.mjs > /tmp/milestone100.csv`, then `nightshift sales import-csv /tmp/milestone100.csv` and `nightshift sales apply-pending <approver>`.
