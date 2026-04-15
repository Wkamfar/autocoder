# Marketry Chicago / Midwest target dataset (CRM)

## Purpose

Canonical **company-level** lead sheet for the sales CRM Builder: logistics, construction, energy, ag, and Chicago commodity-adjacent targets with **tier**, **warmth / ICP scores**, **buyer roles**, and long-form **`opportunity_hypothesis`** / **`why_now`** narratives.

This file exists so **agents and humans** merging `integration/sales-v7` know where real prospect data lives and how it is imported.

## Product boundary: CRM vs Sales OS

**One-line internal description:** The CRM is **SQLite-backed** and **seeded from imports**; the **Sales OS** (slash commands) is currently **world-file-backed** and **decision-centric**; **unification** (CRM ↔ world deals) is a **future integration step**, not today’s default.


| Surface            | Data                                    | How you use it                                                                                                                                                                            |
| ------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SQLite CRM**     | `SALES_DB_PATH`                         | CLI: `nightshift sales import-csv` → `apply-pending`. Discord **prefix**: `!ns sales import-csv`, `apply-pending`, `status`, … — same pipeline (sources → mutations → accounts/contacts). |
| **Slash Sales OS** | `SALES_WORLD_JSON` / `loadSalesWorld()` | `/sales`, `/debate`, `/top-decisions`, `/compare` — deal-centric JSON, **not** the SQLite CRM unless you wire them together later.                                                        |


So: **`marketry_chicago_targets.csv` → import-csv / apply-pending → SQLite CRM** is the real seeded account/contact system. Slash decision UX does **not** automatically consume this CSV; see [`docs/sales-os-rollout.md`](../sales-os-rollout.md).

## Files


| Path                                                                                                                              | Description                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[examples/marketry_chicago_targets.csv](../../examples/marketry_chicago_targets.csv)`                                            | **Canonical import file** (44 unique domains). May be **edited directly** (e.g. quoted `opportunity_hypothesis` / `why_now`).                                                                                                               |
| `[datasets/marketry/chunk-01.mjs](../../datasets/marketry/chunk-01.mjs)` … `[chunk-05.mjs](../../datasets/marketry/chunk-05.mjs)` | Alternate source for regeneration; **out of sync** with the CSV is OK until you run `dataset:marketry` (which **overwrites** the CSV from chunks). If the CSV is the master, update chunks before regenerating, or skip `dataset:marketry`. |
| `[scripts/publish-marketry-dataset.mjs](../../scripts/publish-marketry-dataset.mjs)`                                              | Merges chunks, dedupes by domain, writes `unknown@<domain>` emails, emits `examples/marketry_chicago_targets.csv`.                                                                                                                          |


## Regenerate CSV after editing narratives

```bash
npm run dataset:marketry
```

## Import into SQLite CRM

```bash
npm run build
export SALES_DB_PATH="$PWD/state/sales.db"
node dist/index.js sales import-csv examples/marketry_chicago_targets.csv
node dist/index.js sales apply-pending <approver>
```

Importer details: `[docs/companies-pipeline-format.md](../companies-pipeline-format.md)`.

## Column contract (v6)

Core importer columns: `company`, `email` (or derive from `domain`), `domain`, optional `name`.

Enrichment columns in the current file (all land in `score_json.pipeline.raw` unless consumed by scoring):

`tier`, `segment`, `warmth_score`, `icp_fit_score`, `buyer_roles`, `opportunity_hypothesis`, `why_now`, `notes`, `employee_band`, `revenue_band`, `regions`, `regulated`, `parametric_maturity`, `innovation_partner_fit`, `captive_or_alt_risk`, `hq_city`, `hq_state`, `hq_country`, `ownership`, `linkedin_company_url`, `evidence_url`, `evidence_note`, `evidence_date`, `intro_path`, `intro_path_confidence`, `hq_verified`, `hq_verification_status`, `domain_verified`, `domain_verification_status`, `primary_risk_vector` (pipe-delimited tags, e.g. `weather|fuel`), `contact_confidence`, `email_verified`, `outreach_eligible`, `record_type`, `contact_source_note`

**Provenance split (v6):** `intro_path_confidence` is `heuristic` vs `unverified` (e.g. non-Chicago intro path). **`hq_verified`** is the **location claim**: `yes` | `approx` | `unverified` (not the same as the old `verified`/`heuristic` single column). **`hq_verification_status`** is *how* the HQ was assessed: default seed rows use `heuristic`; well-known Chicago HQs with strong public footprint (e.g. major commodity desks) may use **`verified_signal`**. **`domain_verification_status`** parallels domain checks (`verified` when the corporate domain was confirmed offline). **`contact_source_note`** records synthetic contacts (e.g. `placeholder_domain_email` for `unknown@domain`).

Seed rows use `contact_confidence=low`, `email_verified=false`, `outreach_eligible=false`, `record_type=company_seed` until enriched.

### Enum appendix (v6)

Values observed in the canonical sheet. Extend only with intent (update `scripts/validate-marketry-csv.mjs` if you add required columns).

| Column | Values | Meaning |
|--------|--------|---------|
| `intro_path_confidence` | `heuristic` | Intro path is a normal network/sheet inference (default for UChicago/Chicago network rows). |
| `intro_path_confidence` | `unverified` | Intro path is weak or non-local (e.g. `none (non-Chicago)`); do not treat as warm intro evidence. |
| `hq_verified` | `yes` | HQ city/state claim is treated as standard seed confidence (aligned with sheet + public profile). |
| `hq_verified` | `approx` | HQ is approximate or suburb-level (e.g. Buffalo Grove vs Chicago). |
| `hq_verified` | `unverified` | HQ claim not relied on for outreach routing (e.g. non-Chicago anchor with weak tie). |
| `hq_verification_status` | `heuristic` | HQ not independently verified; inferred from LinkedIn/site/notes. |
| `hq_verification_status` | `verified_signal` | Strong public footprint for Chicago HQ (e.g. major listed commodity desks in this file). |
| `domain_verification_status` | `verified` | Corporate domain treated as confirmed for seed purposes (offline/spot check). |

CI drift check: `npm run validate:marketry-csv` (exact header order + **44** data rows).

## Notes

- **44 accounts** in this snapshot (deduped domain list from the founder sheet). The **CSV in `examples/` is the master**; `datasets/marketry/chunk-*.mjs` may be stale unless you regenerate.
- Contacts use **`unknown@domain`** until real emails are known; outreach stays review-gated per policy.
- Possessive **Marketry’s** in source chunks uses `\u2019` in `.mjs` files to avoid escaping issues.

