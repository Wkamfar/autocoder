# Marketry Chicago / Midwest target dataset (CRM)

## Purpose

Canonical **company-level** lead sheet for the sales CRM Builder: logistics, construction, energy, ag, and Chicago commodity-adjacent targets with **tier**, **warmth / ICP scores**, **buyer roles**, and long-form **`opportunity_hypothesis`** / **`why_now`** narratives.

This file exists so **agents and humans** merging `integration/sales-v7` know where real prospect data lives and how it is imported.

## Files

| Path | Description |
|------|-------------|
| [`examples/marketry_chicago_targets.csv`](../../examples/marketry_chicago_targets.csv) | **Canonical import file** (44 unique domains). May be **edited directly** (e.g. quoted `opportunity_hypothesis` / `why_now`). |
| [`datasets/marketry/chunk-01.mjs`](../../datasets/marketry/chunk-01.mjs) … [`chunk-05.mjs`](../../datasets/marketry/chunk-05.mjs) | Alternate source for regeneration; **out of sync** with the CSV is OK until you run `dataset:marketry` (which **overwrites** the CSV from chunks). If the CSV is the master, update chunks before regenerating, or skip `dataset:marketry`. |
| [`scripts/publish-marketry-dataset.mjs`](../../scripts/publish-marketry-dataset.mjs) | Merges chunks, dedupes by domain, writes `unknown@<domain>` emails, emits `examples/marketry_chicago_targets.csv`. |

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

Importer details: [`docs/companies-pipeline-format.md`](../companies-pipeline-format.md).

## Column contract (v5)

Core importer columns: `company`, `email` (or derive from `domain`), `domain`, optional `name`.

Enrichment columns in the current file (all land in `score_json.pipeline.raw` unless consumed by scoring):

`tier`, `segment`, `warmth_score`, `icp_fit_score`, `buyer_roles`, `opportunity_hypothesis`, `why_now`, `notes`, `employee_band`, `revenue_band`, `regions`, `regulated`, `parametric_maturity`, `innovation_partner_fit`, `captive_or_alt_risk`, `hq_city`, `hq_state`, `hq_country`, `ownership`, `linkedin_company_url`, `evidence_url`, `evidence_note`, `evidence_date`, `intro_path`, `hq_verified`, `domain_verified`, `primary_risk_vector` (pipe-delimited tags, e.g. `weather|fuel`), `contact_confidence`, `email_verified`, `outreach_eligible`, `record_type`

`hq_verified` uses `verified` vs `heuristic` (manual / strong signal vs inferred). Seed rows use `contact_confidence=low`, `email_verified=false`, `outreach_eligible=false`, `record_type=company_seed` until enriched.

## Notes

- **44 accounts** in this snapshot (deduped domain list from the founder sheet). The **CSV in `examples/` is the master**; `datasets/marketry/chunk-*.mjs` may be stale unless you regenerate.
- Contacts use **`unknown@domain`** until real emails are known; outreach stays review-gated per policy.
- Possessive **Marketry’s** in source chunks uses `\u2019` in `.mjs` files to avoid escaping issues.
