# PR: Sales decision stack (Phases 1–8)

## Summary

This PR ships the sales decision stack end to end: Pair Debate, outcomes/evals, decision ranking, controlled execution scaffolding, compounding strategy learning, Discord slash UX, message polish, and proactive decision moments. The system remains advisory by default: no CRM writes and no autonomous sends unless explicitly policy-gated later.

The goal is to turn NightShift sales from a command-driven analysis tool into a **decision operating system**: identify what matters, reason adversarially, surface the best next move, and make that move easy to review and act on in CLI or Discord.

**Integration note:** `integration/sales-v7` combines the **CRM Builder / v7 pipeline** CLI (`import-csv`, `first-ship`, …) with the **Pair Debate / decision-engine** CLI (`pair-debate`, `top-decisions`, …). Analytic commands run without opening the CRM SQLite DB; v7 commands call `initSalesMode()` first. Discord loads both **`!ns sales`** (`salesCommands.ts`) and **slash Sales OS** (`installSalesDecisionOs`).

**Suggested PR title:** `feat(sales): Pair Debate + decision engine + Discord Sales OS (Phases 1–8)`

---

## Suggested review order

1. `src/sales/pairDebate/`
2. `src/sales/decisionEngine/`
3. `src/sales/execution/`
4. `src/sales/intelligence/`
5. `src/sales/discordOs/` and `src/discord/salesOs/`
6. `src/discord/decisionMoments/`
7. `docs/` and `.env.example`

---

## Phase map (shipped scope)

### Phase 1 — Core Pair Debate engine

Closer + Buyer + synthesis pipeline, dossier assembly, run export.

- **CLI:** `nightshift sales pair-debate` (`src/cli/commands/salesPairDebate.ts`).
- **Core:** `src/sales/pairDebate/` — orchestrator, dossier builder, synthesize, export, types, blackboard.

### Phase 2 — Measurement & eval

Outcomes logging for learning and accountability (`pair-debate-outcome` CLI → `src/sales/pairDebate/outcomes.ts`).

- **Eval:** fixtures, synthesis/run scoring (`src/sales/pairDebate/eval/`).
- **Pattern recall** (`patternRecall.ts`), **single-decision baseline** vs pair (`singleDecision.ts`) for compare workflows.
- **CLI:** `pair-debate-eval`, `pair-debate-outcome`, `single-decision`, `compare-decisions` (`src/cli/commands/sales*.ts`).

### Phase 3 — Decision engine (operating layer)

`DecisionScore`, trigger rules, suppression, override signals, ranking — *which deal deserves attention now* (no auto-debate, no CRM).

- **`rankDealsForDebate` / `prioritize`**, **`scoreDeal`**, **`types`** (`src/sales/decisionEngine/`).
- **CLI:** `nightshift sales top-decisions` (`salesTopDecisions.ts`).
- **Docs:** `docs/sales-decision-engine.md`.

### Phase 4 — Controlled execution (`SalesAction`)

JSON actions, policy / suppression / approval posture, audit trail, and draft-from-synthesis scaffolding. **Real sends remain gated by policy and operator review.**

- **`src/sales/execution/`** — types, policy engine, draft-from-synthesis, audit.
- **CLI:** `sales-action policy-eval` / audit (`salesAction.ts`).
- **Config:** `config.salesExecution` (`SALES_EXEC_*`).
- **Docs:** `docs/sales-execution.md`.

### Phase 5 — Compounding intelligence (`SalesStrategyProfile`)

Interpretable boosts from logged outcomes + world; adaptive Closer hints; transparent `learned_priority_boost` on ranked deals.

- **`src/sales/intelligence/`** — extract, profile storage, adaptive prompts, refine decision score, value buckets.
- **CLI:** `strategy-extract` (`salesStrategyExtract.ts`).
- **Docs:** `docs/sales-intelligence.md`.

### Phase 6 — Discord Sales Decision OS (slash + services)

Slash commands aligned with CLI: `/sales`, `/top-decisions`, `/debate`, `/compare`, `/send`, `/outcome` — thin wrappers over `salesDiscordService` (no CRM writes; outcomes/logging as designed).

- **`src/discord/salesOs/`** — `install`, `handlers`, `registerCommands`, `state`, `logging`, `channelContext`, `threadButtons`.
- **`src/sales/discordOs/salesDiscordService.ts`** — run debate, compare, ranked decisions, exports, etc.
- **`src/discord/bot.ts`** — `installSalesDecisionOs(client)`.
- **Docs / setup:** `DISCORD_SETUP.md`.

### Phase 7 — Discord message polish

Single structure for user-visible strings: scannable, action-first, buttons last, short alerts/errors.

- **`src/discord/components/`** — `layout.ts`, `salesPolish.ts`, `index.ts`.
- **Handlers** refactored to polish + shared button rows; legacy `embeds.ts` removed.
- **Errors:** `formatAlertError` for ≤3 lines on interaction failures.

### Phase 8 — Proactive decision moments

`DecisionMoment` + `decisionConfidence` + `computeTopDecisionMoment` (async over `rankDealsForDebate`).

- **`src/discord/decisionMoments/poster.ts`** — one card, edit-in-place, ignore/escalation, optional `DECISION_PRECOMPUTE_DEBATE`, `handleMomentInteraction`, loop on `ready`.
- **`precomputeCache.ts`**, **`decisionMomentTypes.ts`**, **`decisionMonitor.ts`**.
- **Config:** `config.decisionMoments` (`DECISION_MOMENTS_ENABLED`, `DISCORD_DECISION_CHANNEL_ID`, `DECISION_MONITOR_INTERVAL_MS`, `DECISION_MIN_CONFIDENCE`, `DECISION_MOMENT_MIN_PRIORITY`, `DECISION_EXPIRY_HOURS`, `DECISION_PRECOMPUTE_DEBATE`, `DECISION_MOMENT_MAX_IGNORE`).
- **Ops:** `.env.example` block + `docs/discord-sales-os-smoke-checklist.md`.

---

## Configuration & env (high level)

| Area | Keys (representative) |
|------|------------------------|
| Discord | `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID`, `DISCORD_GUILD_ID`, `DISCORD_OWNER_ID`, optional `DISCORD_WEBHOOK_URL` |
| Phase 3 engine | `DECISION_*`, `SALES_WORLD_JSON` / `state/sales-world.json` |
| Phase 4 execution | `SALES_EXEC_*` |
| Phase 8 moments | `DECISION_MOMENTS_ENABLED`, `DISCORD_DECISION_CHANNEL_ID`, `DECISION_MONITOR_INTERVAL_MS`, `DECISION_MIN_CONFIDENCE`, `DECISION_MOMENT_MIN_PRIORITY`, `DECISION_EXPIRY_HOURS`, optional precompute / max-ignore |

Full list and comments: **`.env.example`**.

---

## Testing

CI runs **`npm test`**, then **`scripts/smoke-ci.sh`** (JSON shape validation for the sample world, eval fixtures, `top-decisions` with `--all`, policy eval, CRM SQLite + CSV). **`npm run rollout:check`** validates snowflake ids and world shape. **Real-guild rollout:** `docs/sales-os-rollout.md`. Extended: `docs/discord-sales-os-smoke-checklist.md`.

```bash
npm run build
npm run typecheck
```

---

## Follow-ups (non-blocking)

- **README** opening may still describe Phases 1–5 only; a small follow-up can extend to 1–8 and link Phase 6–8 + smoke checklist.
- **Real guild:** run the smoke checklist and attach screenshots/transcripts when freezing the release.

---

## Post-merge diff (for reviewers)

```bash
git fetch origin
git diff origin/main...HEAD --stat
```

Adjust `origin/main` to your merge base if different.
