import type { Client, ChatInputCommandInteraction } from 'discord.js';
import { config } from '../../config.js';
import { Logger } from '../../utils/logger.js';
import { NightShiftDaemon } from '../../daemon.js';
import { handleCommand } from '../commands.js';
import {
  NS_SLASH_COMMAND_NAMES,
  registerGuildSlashCommands,
} from './registerCommands.js';

const log = new Logger('discord-ns-slash');

/**
 * Wire the NightShift slash commands into an existing Discord client.
 *
 * Mirrors the Sales OS installer pattern: on `ready`, register the commands
 * as guild-scoped (so updates appear instantly in Discord's autocomplete),
 * and attach an `interactionCreate` listener that filters by command name
 * so other installers (Sales OS, future ones) can coexist.
 *
 * The handler forwards to `handleCommand(daemon, cmd, args)` — the same
 * router used by `!ns <cmd>` — so slash and text stay in lockstep.
 */
export function installNsSlashCommands(client: Client, daemon: NightShiftDaemon): void {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!NS_SLASH_COMMAND_NAMES.has(interaction.commandName)) return;
    await handleNsSlash(interaction, daemon);
  });

  client.once('ready', async () => {
    if (!config.discord.token) return;
    if (!config.discord.guildId?.trim()) {
      log.info('DISCORD_GUILD_ID not set — NightShift slash commands not registered');
      return;
    }
    try {
      await registerGuildSlashCommands(
        config.discord.token,
        client.user!.id,
        config.discord.guildId.trim()
      );
      log.info(`NightShift slash commands registered (guild ${config.discord.guildId})`);
    } catch (err) {
      log.error('NightShift slash registration failed', err);
    }
  });
}

async function handleNsSlash(
  interaction: ChatInputCommandInteraction,
  daemon: NightShiftDaemon
): Promise<void> {
  await interaction.deferReply();
  const cmd = interaction.commandName;
  const text = interaction.options.getString('text') ?? '';
  try {
    const reply = await handleCommand(daemon, cmd, text);
    const safe = reply && reply.length > 1900 ? reply.slice(0, 1900) + '…' : reply;
    await interaction.editReply(safe || '(no output)');
  } catch (err) {
    log.error(`slash /${cmd} failed`, err);
    try {
      await interaction.editReply(`error: ${(err as Error).message.slice(0, 300)}`);
    } catch {
      /* interaction may have timed out; ignore */
    }
  }
}
