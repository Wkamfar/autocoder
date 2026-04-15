# Developer onboarding — where everything lives

Single **navigation map** for the repo. The root [`README.md`](../README.md) is the main NightShift overview; this page ties **sales**, **CRM**, **Discord**, and validation together.

## Documentation map

| Topic | Doc | What you get |
|--------|-----|----------------|
| NightShift daemon, loop, safety, `!ns` commands, deferred work | [`README.md`](../README.md) | Autonomous build system |
| Sales phases 1–8 (Pair Debate, decision engine, Discord Sales OS) | [`PR_SALES_PHASES_1_8.md`](./PR_SALES_PHASES_1_8.md) | Sales stack map and file locations |
| CRM import schema, `pipeline.raw`, core vs enrichment columns | [`companies-pipeline-format.md`](./companies-pipeline-format.md) | CSV → SQLite behavior |
| Marketry Chicago CSV, v6 columns, enums, CRM vs Sales OS boundary | [`agents/CRM_MARKETRY_DATASET.md`](./agents/CRM_MARKETRY_DATASET.md) | Canonical lead file |
| Slash Sales OS rollout (env, seed world, daemon) | [`sales-os-rollout.md`](./sales-os-rollout.md) | `SALES_WORLD_JSON` + Discord slash commands |
| Decision ranking (`top-decisions`) | [`sales-decision-engine.md`](./sales-decision-engine.md) | Triggers, suppression, scoring |
| Execution / policy (`SalesAction`) | [`sales-execution.md`](./sales-execution.md) | Approval paths, env tunables |
| Strategy / learning (`SalesStrategyProfile`) | [`sales-intelligence.md`](./sales-intelligence.md) | Outcomes → hints / boosts |
| Discord bot setup | [`DISCORD_SETUP.md`](../DISCORD_SETUP.md) | Token, intents, `!ns` vs slash |
| Discord Sales OS smoke checklist | [`discord-sales-os-smoke-checklist.md`](./discord-sales-os-smoke-checklist.md) | Live guild checks |

## Two sales surfaces (product boundary)

| Surface | Data | Entry points |
|--------|------|----------------|
| **SQLite CRM** | `SALES_DB_PATH` | CLI `nightshift sales import-csv` / `apply-pending`; Discord **`!ns sales`** |
| **Slash Sales OS** | `loadSalesWorld()` / `SALES_WORLD_JSON` | `/sales`, `/debate`, `/top-decisions`, `/compare` — not the CRM DB by default |

Details: [`agents/CRM_MARKETRY_DATASET.md`](./agents/CRM_MARKETRY_DATASET.md) and [`sales-os-rollout.md`](./sales-os-rollout.md).

## Canonical Marketry dataset

- File: [`examples/marketry_chicago_targets.csv`](../examples/marketry_chicago_targets.csv)
- Validate locally: `npm run validate:marketry-csv` (column set + row count; runs in `ci:smoke`)

## CI / local checks

```bash
npm run ci              # typecheck, test, build, smoke-ci.sh
npm run validate:marketry-csv   # Marketry CSV only (also inside smoke-ci)
```

[`scripts/smoke-ci.sh`](../scripts/smoke-ci.sh) — offline: world shape, eval fixtures, `top-decisions`, policy, CRM SQLite sample import, **Marketry CSV validation**.
