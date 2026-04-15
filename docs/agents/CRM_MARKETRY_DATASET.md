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

## Notes

- **44 accounts** in this snapshot (deduped domain list from the founder sheet). To add companies, edit the appropriate `chunk-*.mjs` and re-run `dataset:marketry`.
- Contacts use **`unknown@domain`** until real emails are known; outreach stays review-gated per policy.
- Possessive **Marketry’s** in source chunks uses `\u2019` in `.mjs` files to avoid escaping issues.
