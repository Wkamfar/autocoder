# Controlling NightShift from Discord

NightShift already has a two-way Discord integration built in (`src/discord/bot.ts`, `src/discord/commands.ts`). This document walks you through wiring it up so you can type an objective in a Discord channel and have NightShift pick it up and start a run — no terminal required.

## Clarifying "webhook" vs "bot"

Discord *webhooks* are outbound only — they let an external service POST messages **into** Discord. They cannot receive messages **from** users. To control NightShift by typing in a channel, you need a **Discord bot**, which connects to the Discord gateway over WebSocket and listens for `messageCreate` events. NightShift's `ClawBot` class is exactly that. The `DISCORD_WEBHOOK_URL` variable in `config.ts` is used for the opposite direction (posting noisy alerts out) and is optional.

## One-time setup

### 1. Create the Discord application and bot

1. Go to <https://discord.com/developers/applications> and click **New Application**. Name it something like "NightShift".
2. In the left sidebar, click **Bot**.
3. Click **Reset Token** and copy the token. This goes into `DISCORD_BOT_TOKEN`. Treat it like a password — never commit it.
4. Scroll down to **Privileged Gateway Intents** and enable **MESSAGE CONTENT INTENT**. Without this the bot can see that messages exist but cannot read their text, so `!ns` commands will silently do nothing.

### 2. Invite the bot to your server

1. In the sidebar, click **OAuth2 → URL Generator**.
2. Under **Scopes**, check **`bot`** and **`applications.commands`** (required for **slash commands**, including the Sales Decision OS: `/sales`, `/top-decisions`, `/debate`, etc.).
3. Under **Bot Permissions**, check:
   - View Channels
   - Send Messages
   - Read Message History
   - Embed Links
   - Send Messages in Threads
   - Create Public Threads
   - Mention Everyone (only if you want the owner-ping on escalations to work)
4. Copy the generated URL at the bottom, open it in a browser, pick your server, and authorize.

### 3. Get the channel ID and (for slash commands) guild ID

1. In Discord, enable Developer Mode: **User Settings → Advanced → Developer Mode → On**.
2. Right-click the channel you want NightShift to post in and **Copy ID**. This is `DISCORD_CHANNEL_ID`.
3. Right-click your own username and **Copy ID**. This is `DISCORD_OWNER_ID` — used for escalation pings.
4. For **slash commands**, right-click the **server icon** (guild) → **Copy Server ID**. Set **`DISCORD_GUILD_ID`** in `.env`. On startup the bot registers commands for that guild (instant; no global command wait).

### 4. Populate `.env`

Create `/mnt/c/Users/wkamf/AutoCoder/.env` (or append to an existing one):

```
DISCORD_BOT_TOKEN=<the token from step 1>
DISCORD_CHANNEL_ID=<the channel id from step 3>
DISCORD_OWNER_ID=<your user id from step 3>
# Optional — only if you also want outbound webhook alerts in a second channel:
# DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### 5. Start NightShift in daemon mode

Instead of `node dist/index.js run "..."` (which is one-shot and exits), start the long-running daemon so the bot can accept commands:

```
cd /mnt/c/Users/wkamf/AutoCoder && node dist/index.js daemon
```

You should see `discord logged in as NightShift#1234` in the terminal. Post `!ns help` in the channel to confirm the bot responds.

## Daily usage — sending prompts from Discord

Once the daemon is running, type in the channel:

```
!ns start do a deep dive into /mnt/c/Users/wkamf/Documents/GitHub/arc and generate a comprehensive README.md
```

The bot will reply with the run id and branch name, and then post live updates as tasks execute. Useful commands while a run is live:

| Command | What it does |
|---|---|
| `!ns start <objective>` | Start a new run with the given objective |
| `!ns status` | Current progress, cost, branch |
| `!ns tasks` | List remaining tasks in the queue |
| `!ns pause` / `!ns resume` | Pause after current task / resume |
| `!ns stop` | Stop and commit WIP to the run branch |
| `!ns inject <text>` | Inject extra guidance into the next task's prompt |
| `!ns skip <task_id>` | Skip a task |
| `!ns rollback <task_id>` | Reset to the task's pre-checkpoint |
| `!ns fallback` | Show which engines are in cooldown |
| `!ns doctor` | Pre-flight check (env vars, binaries, repos) |
| `!ns accept` | Merge the run branch into main |
| `!ns help` | Full command list |

Full reference lives in `src/discord/commands.ts`.

## Keeping the daemon running

`node dist/index.js daemon` runs in the foreground. To keep it up in WSL across reboots, wrap it in `nohup` or a systemd user unit, e.g.:

```
nohup node dist/index.js daemon > ~/nightshift.log 2>&1 &
```

Or, simpler, run it inside `tmux` / `screen` so you can detach and reattach.

## Sales / Pair Debate commands

The **sales** CLI (`nightshift sales pair-debate`, `top-decisions`,
`sales-action policy-eval`, etc.) runs from a terminal on the machine where
NightShift is installed. **Slash commands** (`/debate`, `/top-decisions`, …) run
the same engines from Discord when `DISCORD_GUILD_ID` is set — see the list
above.

**Sales Decision OS (Phase 6)** — thin wrappers only: no CRM writes, no
auto-email. Outcomes append to `state/pair-debate-outcomes.jsonl`; Discord
actions append to `state/discord-sales-os.jsonl`.

## Troubleshooting

- **`!ns` commands do nothing:** Privileged Message Content intent is not enabled in the Developer Portal. Fix step 1.4 and restart the daemon.
- **Bot shows online but never posts:** `DISCORD_CHANNEL_ID` is wrong or the bot doesn't have Send Messages permission in that channel. Double-check the channel ID (it's numeric, ~18 digits) and check channel permissions.
- **`logged in as ... undefined`:** Your token was revoked or pasted with whitespace. Reset it in the Developer Portal and repaste.
- **`TOKEN_INVALID`:** Token is malformed. It should look like `M...` or `N...` followed by two dot-separated base64 chunks. Don't wrap it in quotes inside `.env`.
