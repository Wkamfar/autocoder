# Discord Sales OS — Phase 7/8 live smoke checklist

Use this in a **real guild** before calling Phase 7/8 shipped. Capture evidence (screenshots or message links) for the happy path.

## Preconditions

- `.env` filled from `.env.example` (`DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_CHANNEL_ID`, Phase 8 keys as needed).
- Bot invited with permissions to read/send messages and use application commands in the target channels.
- `DECISION_MOMENTS_ENABLED=1` if testing proactive cards.

## Checklist

| # | Check | Pass |
|---|--------|------|
| 1 | Bot starts; **one** proactive decision card appears in `DISCORD_DECISION_CHANNEL_ID` or `DISCORD_CHANNEL_ID`. | ☐ |
| 2 | **Run Debate** on the card runs Pair Debate and posts the polished synthesis (thread or flow as implemented). | ☐ |
| 3 | Monitor tick **updates** the existing card instead of posting duplicate spam. | ☐ |
| 4 | **Send / Edit / Skip** (and **Compare** where applicable) behave and match button labels. | ☐ |
| 5 | `nsos:dm:*` custom ids (proactive card) round-trip: no “Unknown interaction” / wrong deal. | ☐ |
| 6 | Restart bot: **no duplicate** proactive cards (state + edit path). | ☐ |
| 7 | Suppressed deals **do not** surface as top moment (cross-check with world + suppression rules). | ☐ |
| 8 | Forced error path (e.g. invalid deal): user-facing text stays **≤ 3 lines** (alert style). | ☐ |

## Evidence (optional)

- Screenshot or link: proactive card before action.
- Screenshot or link: after **Run Debate**.
- Note: channel id used for moments and any restart test timestamp.

## Freeze criteria

When rows 1–8 pass with evidence, Phase 7/8 is **rollout-ready** from a UX/ops perspective.
