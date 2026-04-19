# Sales Decision OS — rollout (ops only)

Use this after merging `integration/sales-v7` (or main once merged). **No code changes required** — only env, seed data, Discord app setup, and a one-time smoke test.

**CRM ↔ Sales OS convergence (design, not shipped):** [`CRM_SALES_OS_UNIFICATION.md`](./CRM_SALES_OS_UNIFICATION.md).

## Product boundary: CRM vs Sales OS

**One-line internal description:** The CRM is **SQLite-backed** and **seeded from imports**; the Sales OS is currently **world-file-backed** and **decision-centric**; **unification** is a **future step**, not today’s default.

| Surface | Data | Discord / CLI |
|--------|------|----------------|
| **SQLite CRM** | `SALES_DB_PATH` | **Prefix** `!ns sales` (import-csv, apply-pending, …) and CLI `nightshift sales` — real accounts/contacts/mutations. |
| **Slash Sales OS** | `SALES_WORLD_JSON` | `/sales`, `/debate`, `/top-decisions`, `/compare` — reads **`loadSalesWorld()`**, not the CRM DB by default. |

Flow: **`SALES_WORLD_JSON` → slash commands → decision UX**. That is **parallel to**, not the same as, CSV → SQLite CRM (see canonical seed file in [`docs/agents/CRM_MARKETRY_DATASET.md`](./agents/CRM_MARKETRY_DATASET.md)).

**Future opportunity:** CRM → world sync, or slash commands reading SQLite-backed deals/accounts — **not** required for rollout today.

## Prerequisites

| Item | Notes |
|------|--------|
| Bot token | Discord Developer Portal → Application → Bot → Reset Token → `DISCORD_BOT_TOKEN` |
| Guild ID | Developer Mode → right-click server → Copy Server ID → `DISCORD_GUILD_ID` |
| Channel ID | Target text channel → Copy ID → `DISCORD_CHANNEL_ID` |
| Bot invite | Scopes: `bot`, `applications.commands`. Permissions: send/read messages, use slash commands, create public threads (for debate threads). See `DISCORD_SETUP.md`. |
| Engines | `claude` (or configured engines) on `PATH` with valid API credentials for Pair Debate. |

## 1. Freeze env for your team

```bash
cp .env.rollout.example .env
# Edit .env: set DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_CHANNEL_ID (and engines as needed).
npm run rollout:check
```

`npm run rollout:check` verifies Discord vars (including **snowflake-shaped** guild/channel ids), that guild ≠ channel id when both are numeric, and that the world file **parses and matches the structural shape** expected by the engine — **without printing secrets**. It exits 0 if `.env` is missing (not an error — you have not copied the template yet).

`.env.rollout.example` is the **known-good shape** for Sales OS + daemon (proactive moments default **off**). Do **not** commit a filled `.env`.

## 2. Seed the sales world

```bash
npm run rollout:seed-world
```

This copies `examples/sales-world.sample.json` → `state/sales-world.json` if the file does not exist yet. Sample deal id for `/debate`: **`acme-expansion-2026`**.

Alternatively set `SALES_WORLD_JSON` to any valid world file path.

## 3. Build and run

```bash
npm install
npm run build
npm run daemon
```

Confirm logs: bot login, and either `Sales OS slash commands registered (guild …)` or fix `DISCORD_GUILD_ID`.

## 4. Minimum smoke test (Discord)

Do this in your real guild before calling it shipped:

- [ ] Bot shows online; terminal shows login success.
- [ ] Slash commands appear (may take a few seconds after first register).
- [ ] `/sales` returns overview (ephemeral ok).
- [ ] `/top-decisions` returns ranked rows (uses seeded world).
- [ ] `/debate` with `deal_id: acme-expansion-2026` runs and posts a thread/result.
- [ ] Thread buttons respond (Send / Edit / Skip / etc. as implemented).
- [ ] No duplicate proactive cards unless you enabled them.
- [ ] With `DECISION_MOMENTS_ENABLED=0`, no proactive moment card (default in `.env.rollout.example`).

Extended checklist: [`discord-sales-os-smoke-checklist.md`](./discord-sales-os-smoke-checklist.md).

## 5. Golden path (internal demo / regression)

Capture **screenshots or message links** (private channel) for:

1. `/sales` response  
2. `/debate` invocation + **acme-expansion-2026**  
3. Debate result (thread content)  
4. `/outcome` (or outcome flow) after a run  

Store under your team drive or wiki; link from the PR or release notes. This is the **regression reference** for future changes.

## Proactive moments (optional)

Set `DECISION_MOMENTS_ENABLED=1` and optionally `DISCORD_DECISION_CHANNEL_ID`. Expect **one** card, edited in place — see Phase 8 notes in `docs/PR_SALES_PHASES_1_8.md`.

## CI (automated, no secrets)

On **every pull request** (any branch) and on pushes to `main` / `develop` / `integration/sales-v7`, GitHub Actions runs `npm ci`, typecheck, **`npm test`** (sample world/strategy JSON), build, **`bash scripts/smoke-ci.sh`** (world shape CLI check, eval fixtures, `top-decisions` with `--world` + `--all`, policy eval, CRM SQLite + CSV import). Failed smokes upload **`smoke.log`** as an artifact. **Dependabot** opens weekly npm update PRs (`.github/dependabot.yml`).

Locally after a build:

```bash
bash scripts/smoke-ci.sh
# or
npm run ci:smoke
```

## What “shipped on the branch” means

Code is merged; **rollout is complete** when steps 1–4 pass in a real guild and golden-path evidence is stored for the team.
