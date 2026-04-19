# NightShift Repair + Debate Mode — Implementation Plan

**Status:** in progress
**Branch:** `claude/vigorous-dirac` (worktree)
**Target droplet:** `64.227.12.140`

---

## 1. Root cause of the crash

`npm run typecheck` fails with 7 TS2307 "cannot find module" errors — the
entire `src/brain/` directory is referenced across the codebase but does
not exist on disk:

| Import site | Missing module | Symbols used |
|-------------|----------------|--------------|
| `src/daemon.ts:11` | `./brain/persistence.js` | `brain.linkRemote()` |
| `src/safety/doctor.ts:5` | `../brain/persistence.js` | `brain.ensureStructure()` |
| `src/loop/decision-engine.ts:2` | `../brain/persistence.js` | `BrainPersistence` (type only) |
| `src/loop/discovery.ts:4` | `../brain/persistence.js` | `BrainPersistence`, `brain.readKnowledge()` |
| `src/loop/nightshift-loop.ts:9` | `../brain/persistence.js` | `ensureStructure`, `readKnowledge`, `startRun`, `recordTaskCompletion`, `updateBrainGuide`, `sync`, `writeMorningReport` |
| `src/loop/nightshift-loop.ts:10` | `../brain/context-builder.js` | `ContextBuilder` + `.build(task)` |
| `src/loop/nightshift-loop.ts:21` | `../brain/api-instructions.js` | `apiInstructions.ensureStructure()`, `.loadRelevant(task)` |

Without these, `tsc` fails → `dist/index.js` is missing or stale →
`node dist/index.js ...` exits immediately with code 1. That matches the
`claude code exited unexpectedly (1)` symptom on both the droplet (under
systemd) and locally (when your `!ns` / slash-command wrapper tries to
spawn it).

## 2. Files to create

### 2.1 `src/brain/persistence.ts`

Class `BrainPersistence` + singleton export `brain`. Persists knowledge
about runs to `$BRAIN_DIR` (default: `./brain`). Structure under
`$BRAIN_DIR`:

```
brain/
├── knowledge/
│   ├── architecture.md          # written by discovery, read by planner
│   ├── patterns.md              # appended learnings
│   ├── antipatterns.md          # appended novel errors
│   ├── brain-guide.md           # rolling summary of recent runs
│   └── api-instructions/        # per-API markdown (managed by apiInstructions)
└── runs/
    └── <run_id>/
        ├── run.json             # snapshot of RunState at startRun time
        ├── progress_log.jsonl   # one line per task result
        └── morning_report.md    # written at finalize
```

**API** (exactly matches call sites):

- `ensureStructure(): Promise<void>` — mkdir -p all dirs, git init if absent
- `linkRemote(): Promise<string>` — wire `config.brain.remote` as `origin`, return a human status string
- `readKnowledge(file): Promise<string>` — read `knowledge/<file>`; return `''` if absent
- `startRun(state: RunState): Promise<string>` — create `runs/<id>/`, write `run.json`, return run dir path
- `recordTaskCompletion(runId, task, result): Promise<void>` — append JSONL to `runs/<id>/progress_log.jsonl`; append learnings to `patterns.md`; append novel errors to `antipatterns.md`
- `updateBrainGuide(state): Promise<void>` — rewrite `brain-guide.md` with rolling summary of last 10 runs
- `sync(message): Promise<void>` — `git add -A && git commit -m <message>`, best-effort push if `config.brain.autoPush && config.brain.remote`
- `writeMorningReport(runId, md): Promise<void>` — write to `runs/<id>/morning_report.md`

### 2.2 `src/brain/context-builder.ts`

Class `ContextBuilder`. Assembles the prompt prefix handed to each
execution session.

```ts
new ContextBuilder(brainStore: BrainPersistence)
build(task: Task): Promise<string>
```

`build()` returns a markdown string containing:
1. `## Task` — id, title, description, acceptance criteria
2. `## Architecture` — contents of `knowledge/architecture.md`
3. `## Patterns` — last ~50 lines of `knowledge/patterns.md`
4. `## Antipatterns` — any antipattern entries whose tags overlap `task.tags`
5. `## Relevant files` — `task.relevant_files` list
6. `## Prior attempts on this task` — if `task.error_history.length > 0`, include each error + attempt number

### 2.3 `src/brain/api-instructions.ts`

Singleton `apiInstructions` loading markdown files from
`$BRAIN_DIR/knowledge/api-instructions/`. Each file is named
`<name>.md` with optional frontmatter of `tags: [polymarket, markets]`
and `keywords: [polymarket, slug]`. `loadRelevant(task)` returns the
content of any file whose tags intersect `task.tags` OR whose keywords
appear in `task.title + task.description`.

```ts
apiInstructions.ensureStructure(): Promise<void>
apiInstructions.loadRelevant(task: Task): Promise<string[]>
```

## 3. Debate mode (replaces council Reviewer for risky tasks)

### When it triggers

In `src/loop/decision-engine.ts`, `pickMode()` already returns `'council'`
for `task.risk === 'high'` or tags like `auth/payments/architecture`. We
extend: when mode is `council` AND `task.risk === 'high'` OR
`task.files_affected >= 5`, the council's Reviewer step becomes a
**debate** between three agents.

### Roles

| Role | Model | Purpose |
|------|-------|---------|
| **Advocate** | `claude-sonnet-4-6` | Defend the Builder's diff. Argue it ships. |
| **Skeptic** | `claude-sonnet-4-6` | Adversarial. Find the strongest objections that would block merge. |
| **Judge** | `claude-opus-4-6` | Reads both sides + the diff, renders `[APPROVE]` / `[REJECT]` / `[REVISE: <bullets>]`. |

### Flow

1. Architect → Plan (unchanged)
2. Builder → Implementation (unchanged)
3. **Debate** (new, replaces single Reviewer):
   - **Round 1 (parallel):** Advocate argues diff is correct and should merge. Skeptic lists their 3 strongest objections with citations into the diff. (~400 tokens each, capped.)
   - **Round 2 (parallel):** Advocate responds to each Skeptic objection. Skeptic picks the one unrebutted objection they consider strongest.
   - **Judge:** reads full transcript + `git diff HEAD~1` snippets (truncated), decides.
4. Transcript saved to `$BRAIN_DIR/runs/<run_id>/debates/<task_id>.md`.

### Prompts

Saved as a versioned artifact at `src/council/debate-prompts.ts`:

```ts
export const DEBATE_ADVOCATE_SYSTEM = `
You are the Advocate in an adversarial code-review debate. Your job is to defend
the proposed code change so it can ship.

Rules:
- Ground every claim in specific code from the diff; cite file:line.
- Do not invent functionality that isn't in the diff.
- If a concern raised is legitimate, concede it explicitly (say "conceded: …") —
  the debate is a search for truth, not a popularity contest.
- Keep responses under 400 words per round.
- End each message with: [ADVOCATE ROUND <n> END]
`;

export const DEBATE_SKEPTIC_SYSTEM = `
You are the Skeptic in an adversarial code-review debate. Your job is to find
the strongest reasons NOT to merge this change. Assume production stakes.

Rules:
- Prioritize security, correctness, data loss, and backwards-compat regressions
  over style. If you find none, say so explicitly — a clean diff is valid.
- Ground every objection in specific code from the diff; cite file:line.
- One objection per bullet. Rank by severity (S1 blocks merge, S2 should-fix,
  S3 nit).
- Do not fabricate issues. Speculative concerns must be marked [SPECULATION].
- Keep responses under 400 words per round.
- End each message with: [SKEPTIC ROUND <n> END]
`;

export const DEBATE_JUDGE_SYSTEM = `
You are the Judge. You read the Advocate/Skeptic transcript and the actual diff,
then render a verdict. You are not a tiebreaker — you weigh evidence.

Rules:
- Only block-severity (S1) unrebutted objections justify [REJECT].
- If there are real but fixable issues, prefer [REVISE: …] over [REJECT].
- If no S1 objection survived rebuttal and the diff is on-task, [APPROVE].
- Your verdict MUST be on its own final line in one of these exact forms:
    [APPROVE]
    [REJECT: <one-line reason>]
    [REVISE: <short, actionable bullet list>]
- Before the verdict line, give ≤5 sentences of reasoning.
`;
```

### Discord surface

New `!ns debate <task_id>` command in `src/discord/commands.ts`: reads
`runs/<run>/debates/<task>.md` for the current run and returns the
transcript (truncated to Discord's 2000-char limit, with a notice if
truncated and the file path on the VPS).

Also: `!ns debate-prompt` prints the three system prompts exactly as
defined in `debate-prompts.ts` (what you asked for — "I would like to
know the prompt used to set that up").

## 4. Droplet deployment

### Access

SSH currently rejects key `SHA256:pro+cJpP4KKoMXtZVZtZOyTcuUt54q8+idQnBVk+keI`
(public key in `~/.ssh/id_ed25519.pub`). Options:

a) Add the pubkey to `/root/.ssh/authorized_keys` via DigitalOcean web
   console, OR
b) User runs the deploy commands themselves (I'll provide them).

### Deploy commands (once SSH works)

```bash
ssh root@64.227.12.140 'cd /opt/nightshift && \
  git fetch origin && \
  git checkout main && \
  git pull --ff-only && \
  npm install --production=false && \
  npm run build && \
  systemctl restart nightshift && \
  sleep 2 && \
  systemctl status nightshift --no-pager && \
  node dist/index.js doctor'
```

Expected post-deploy state:
- `systemctl status nightshift` shows `active (running)`
- `node dist/index.js doctor` exits 0 with all checks `pass` or `warn`
  (BRAIN_REMOTE / DISCORD_WEBHOOK_URL are optional)
- `!ns doctor` in Discord returns the same report
- `journalctl -u nightshift --since "5m ago"` shows no crashes

## 5. Verification checklist

- [ ] `npm run typecheck` → 0 errors
- [ ] `npm run build` → `dist/` populated, no errors
- [ ] `node dist/index.js doctor` locally → exit 0
- [ ] New unit boundary: instantiate `BrainPersistence` against a temp
      dir and call `ensureStructure()` + `startRun()` + `sync()` →
      produces the expected file layout
- [ ] Droplet: `systemctl status nightshift` green
- [ ] Discord: `!ns doctor` returns report
- [ ] Discord: `!ns debate-prompt` prints the three system prompts
- [ ] Trigger a small high-risk objective → debate transcript file
      created at `runs/<id>/debates/<task>.md`

## 6. Deferred (not this PR)

- TDD pre-task test scaffolding (already noted in README "Still deferred")
- Tick-based parallel coordinator
- Web dashboard

---

_Generated 2026-04-18. Updates tracked in the commit history of this branch._
