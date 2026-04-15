# NightShift — OpenClaw Autonomous Build System

A 24/7 autonomous development daemon. You give it objectives through Discord,
it drives Claude Code, OpenAI Codex, and local Ollama models as subprocesses,
plans the work, executes on an isolated git branch, runs tests, commits, and
reports back. Knowledge flows into an OpenClaw brain repo so it learns across
runs.

> Codename: NightShift. "The machine that builds the machine while the builder
> sleeps."

## What this repo contains

A working skeleton of the design document in `DESIGN.md` / the original spec —
Phases 1–5 of the **sales / Pair Debate** track are partially implemented: core
debate (Phase 1), measurement and eval (Phase 2), a **decision engine** (Phase 3),
**SalesAction + policy** (Phase 4), and a **`SalesStrategyProfile` + extraction**
layer (Phase 5 — interpretable learning from outcomes; adaptive Closer hints;
optional priority boosts). See `docs/sales-decision-engine.md`,
`docs/sales-execution.md`, and `docs/sales-intelligence.md`.

**CRM Builder (SQLite) + Marketry target sheet:** canonical import file
[`examples/marketry_chicago_targets.csv`](examples/marketry_chicago_targets.csv),
agent-oriented notes in [`docs/agents/CRM_MARKETRY_DATASET.md`](docs/agents/CRM_MARKETRY_DATASET.md),
regenerate via `npm run dataset:marketry` after editing `datasets/marketry/chunk-*.mjs`.

```
src/
  index.ts                 entry (daemon | cli | run)
  daemon.ts                NightShiftDaemon (top-level orchestrator)
  config.ts                env + config loader
  types.ts                 shared type definitions
  engines/
    base.ts                BaseSession + pricing table
    claude-code.ts         persistent subprocess via `claude -p --output-format stream-json`
    codex.ts               one-shot `codex exec --full-auto`
    local.ts               Ollama via `ollama run`
    session-manager.ts     lifecycle + inbox (cross-session messaging)
    session-pool.ts        worktree-isolated pool for parallel execution
  loop/
    planner.ts             Strategic Planner (Opus) — emits relevant_files + acceptance_criteria
    decision-engine.ts     engine + mode selection, scoring
    dispatcher.ts          single-agent execution with fallback tier + rate-limit detection
    evaluator.ts           guardrails + test/lint + commit/revert
    model-fallback.ts      fallback chain with exponential-backoff cooldowns
    context-monitor.ts     token pressure watchdog + /compact hook
    discovery.ts           first-run codebase auto-discovery
    nightshift-loop.ts     the main autonomous loop
  council/
    orchestrator.ts        Architect / Builder / Reviewer council
  brain/
    persistence.ts         brain repo read/write
    context-builder.ts     prompt context assembly
    api-instructions.ts    API reference loader (polymarket, kalshi, etc.)
  branch/
    manager.ts             branch create/commit/merge
    comparison.ts          branch-vs-main diff report
  safety/
    guardrails.ts          forbidden files, scope, runtime, cost limits
    rollback.ts            git-tag checkpoint + rollback + old-branch prune
    package-approval.ts    install whitelist + approval queue
  discord/
    bot.ts                 discord.js bot
    commands.ts            !ns command router
    webhook.ts             rich-embed webhook publisher
  utils/
    exec.ts                subprocess + git helpers
    logger.ts              scoped logger
.claude/
  settings.json            auto-accept permission profile for Claude Code
scripts/
  systemd-install.sh       install as a VPS service
```

## Requirements

- Node 22+
- `claude` CLI (Claude Code v2.1+) on `$PATH`
- `codex` CLI (v0.118+) on `$PATH`
- Optional: `ollama` for local model execution
- A git checkout of the project the daemon will work on
- A separate git repo for the brain (knowledge layer)

## Setup

```bash
cd /opt/nightshift
npm install
cp .env.example .env
# edit .env and fill in PROJECT_DIR, BRAIN_DIR, DISCORD_BOT_TOKEN, etc.
npm run build
```

Run as a daemon:

```bash
npm run daemon
# or
node dist/index.js daemon
```

Run a single objective from the CLI (no Discord):

```bash
node dist/index.js run "Implement the Polymarket market data fetcher with tests"
```

Run the pre-flight check before your first run:

```bash
node dist/index.js doctor
# or without building:  npx tsx src/index.ts doctor
```

Invoke a command directly (handy for cron):

```bash
node dist/index.js cli status
node dist/index.js cli "add-objective" "Refactor the websocket listener"
```

Install as a systemd service:

```bash
sudo ./scripts/systemd-install.sh /opt/nightshift
```

## Discord commands

```
!ns start <objective>        start a new run
!ns status                   current progress + cost
!ns tasks                    list remaining tasks
!ns pause | resume | stop    control the loop
!ns inject <text>            inject instructions into live run
!ns reprioritize <task_id>
!ns skip <task_id>
!ns diff | report            branch-vs-main comparison
!ns cost
!ns accept                   merge branch into main
!ns objectives
!ns add-objective <text>
!ns rediscover               rerun codebase auto-discovery
!ns rollback <task_id>       reset to a task's pre-checkpoint
!ns packages                 list pending package install requests
!ns approve <pkg>            approve a queued package
!ns reject <pkg>             reject a queued package
!ns fallback                 show model fallback / cooldown state
!ns doctor                   pre-flight check (env, binaries, repos)
!ns help
```

## How it works

1. **Start** — `!ns start <objective>` creates a branch like
   `nightshift/<slug>-<timestamp>` off `main`.
2. **Plan** — the Strategic Planner spawns a Claude session on Opus, reads the
   brain context, and produces a JSON task plan.
3. **Loop** — the Decision Engine picks the next unblocked task, chooses an
   engine (Claude Code / Codex / Local) and a mode (single / council), and
   hands it to the Dispatcher.
4. **Execute** — a session is created through the SessionManager, the
   ContextBuilder assembles a prompt with architecture notes, antipatterns,
   previous attempts, and live operator instructions, and the agent runs.
5. **Evaluate** — the Evaluator checks guardrails (forbidden files, scope,
   diff size), runs tests + lint, then either commits on the test branch,
   reverts and retries, or escalates.
6. **Persist** — every task result is appended to `runs/<id>/progress_log.jsonl`
   in the brain, learnings go into `knowledge/patterns.md`, novel errors go
   into `knowledge/antipatterns.md`, and the brain repo is auto-committed
   (optionally auto-pushed).
7. **Finish** — when the queue drains or a limit trips, the BranchComparator
   generates a report and Discord gets a summary. You review with `!ns diff`
   and merge with `!ns accept`.

## Safety

Hard limits enforced by `src/safety/guardrails.ts`:

| Guardrail | Default | Env var |
|-----------|---------|---------|
| Max runtime per run | 8 h | `MAX_RUNTIME_HOURS` |
| Max cost per run | $20 | `MAX_COST_USD` |
| Max retries per task | 3 | `MAX_RETRIES_PER_TASK` |
| Max consecutive escalations | 5 | `MAX_CONSECUTIVE_ESCALATIONS` |
| Auto-accept diff size | 500 lines | `AUTO_ACCEPT_MAX_LINES` |

Branches are always isolated: NightShift never writes directly to `main`.
`.env`, credentials, and lockfiles are forbidden. Changes outside
`src/`, `tests/`, `docs/`, `scripts/`, or `examples/` are reverted.

## v2.1 Addendum features

The following items from the v2.1 addendum are live in-tree:

- `.claude/settings.json` auto-accept profile so Claude Code never blocks on
  bash prompts (with a strict deny-list for `.env`, secrets, and destructive
  commands).
- **Model fallback chain** (`src/loop/model-fallback.ts`) — premium → standard
  → free local tiers, exponential-backoff cooldowns, and rate-limit pattern
  detection on session output. The dispatcher picks a tier on every dispatch
  and records failures automatically.
- **SessionPool with git worktrees** (`src/engines/session-pool.ts`) — per-task
  worktree creation, capacity caps per engine, conflict grouping by
  `relevant_files`, eviction of stalled slots. Ready for parallel execution.
- **Rollback manager** (`src/safety/rollback.ts`) — pre-task
  `nightshift/<run>/pre-<task>` tags, hard revert on evaluation failure,
  run-scoped tag cleanup, and `pruneOldBranches` (7-day default).
- **Package approval** (`src/safety/package-approval.ts`) — whitelist loaded
  from project manifests + `PACKAGE_WHITELIST` env var, agent prompt is told
  to emit `PACKAGE_REQUEST: <manager> <pkg> <reason>` instead of installing
  unknown deps, queued items are surfaced through Discord.
- **Auto-discovery bootstrap** (`src/loop/discovery.ts`) — first-run scan of
  language, framework, test runner, entry points, routes, models, and external
  API calls; writes `knowledge/architecture.md` for the planner.
- **API instructions layer** (`src/brain/api-instructions.ts`) — per-API
  markdown files under `knowledge/api-instructions/`, auto-injected into task
  prompts by keyword/tag match.
- **Context monitor** (`src/loop/context-monitor.ts`) — token pressure
  evaluation with `/compact` trigger at 80% and forced session rotation at
  90%; tracks context-heavy sessions for the planner to learn from.
- **Discord webhook channel** (`src/discord/webhook.ts`) — rich embeds for
  task start, task complete, escalations, and run finish; works alongside the
  bot or standalone via `DISCORD_WEBHOOK_URL`.
- **Planner schema v2** — tasks now carry `relevant_files` and
  `acceptance_criteria` so the pool can parallelize safely and the dispatcher
  can scaffold TDD prompts.

## Still deferred

- TDD pre-task test scaffolding (planner now emits `acceptance_criteria`, but
  the dispatcher doesn't yet run the pre-implementation "write failing test"
  call — hook point is `ExecutionDispatcher.execute`).
- Fully tick-based coordinator with simultaneous task execution (the
  `SessionPool` is in place, but `NightShiftLoop` still dispatches
  sequentially; the next step is to replace the while-loop with a tick loop
  that calls `pool.groupByConflict` and fans out).
- Engine profile learning → adaptive routing weights.
- Web dashboard.
- Gemini / Cursor Agent engine adapters.
- Direct OpenClaw bot cross-talk.

## Sales — Pair Debate (Phases 1–5)

- **Phase 1 — Core engine:** `nightshift sales pair-debate --deal <id>` (Closer +
  BuyerMind + synthesis). Advisory-only; exports JSON/Memo for review.
- **Phase 2 — Measurement:** outcome logging (`pair-debate-outcome`), pattern
  recall with honest sample floors, eval rubric, optional heuristic `score-run`,
  A/B `compare-decisions`.
- **Phase 3 — Decision engine (operating layer):** ranks **which** open deals
  should get attention *now* — `DecisionScore` + trigger rules +  
  `nightshift sales top-decisions`. This does **not** auto-run debates or touch
  the CRM; it is a co-pilot style prioritization surface. Full schema and env
  tunables: [`docs/sales-decision-engine.md`](docs/sales-decision-engine.md).
- **Phase 4 — Controlled execution:** `SalesAction` JSON schema + layered policy
  (policy / suppression / approval), audit log, and CLI `sales-action policy-eval`.
  Default posture is **assisted** (human sends); `auto` is downgraded unless
  `SALES_EXEC_AUTO_SEND_ENABLED=1`. Details: [`docs/sales-execution.md`](docs/sales-execution.md).
- **Phase 5 — Compounding intelligence:** `SalesStrategyProfile` derived from
  outcome logs (+ optional CRM world join). CLI `strategy-extract` writes
  `sales-strategy-profile.json`; Pair Debate injects **adaptive Closer hints** when
  that file exists; `top-decisions` can apply transparent **`learned_priority_boost`**
  by stage/value segment. [`docs/sales-intelligence.md`](docs/sales-intelligence.md).

Quick start (requires `state/sales-world.json` or `SALES_WORLD_JSON`):

```bash
nightshift sales top-decisions --limit 10
nightshift sales pair-debate --deal <id-from-list>
nightshift sales sales-action policy-eval examples/sales-action.sample.json examples/sales-action-context.sample.json
nightshift sales strategy-extract --world examples/sales-world.sample.json
```

**Discord (optional):** with `DISCORD_GUILD_ID` + `applications.commands` invite scope,
the daemon registers **slash commands** (`/top-decisions`, `/debate`, `/compare`,
`/send`, `/outcome`, `/sales`) that call the same sales services — see
[`DISCORD_SETUP.md`](DISCORD_SETUP.md).

## Documentation map

New to the repo: start at **[`docs/ONBOARDING.md`](docs/ONBOARDING.md)** — links **README** → sales phases → **CRM** (SQLite + Marketry CSV) → **Sales OS** (world JSON + slash commands) → rollout, with a short **product boundary** (CRM vs decision layer). Same content is summarized here: the **daemon** lives in this README; **sales** details are split across [`docs/PR_SALES_PHASES_1_8.md`](docs/PR_SALES_PHASES_1_8.md), [`docs/agents/CRM_MARKETRY_DATASET.md`](docs/agents/CRM_MARKETRY_DATASET.md), [`docs/sales-os-rollout.md`](docs/sales-os-rollout.md), and the topic docs linked from onboarding.

## Development

```bash
npm run typecheck
npm test                  # node:test — sample JSON shape + fixtures
npm run ci:smoke          # build + offline smoke (eval fixtures, top-decisions, policy, CRM DB+CSV, Marketry CSV)
npm run validate:marketry-csv  # examples/marketry_chicago_targets.csv column + row contract only
npm run ci                # typecheck + test + build + smoke (matches CI job)
npm run rollout:check     # after .env + seed: Discord snowflakes + world shape (secrets not printed)
npm run dev daemon        # run with tsx, no build step
```

CI (GitHub Actions) runs typecheck, build, and `scripts/smoke-ci.sh` on every PR and on pushes to `main`, `develop`, and `integration/sales-v7` (see `.github/workflows/ci.yml`).
</think>


<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
Shell
