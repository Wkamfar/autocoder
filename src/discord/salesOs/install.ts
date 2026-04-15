import type { Client } from 'discord.js';
import { config } from '../../config.js';
import { Logger } from '../../utils/logger.js';
import { handleSalesOsInteraction } from './handlers.js';
import { registerGuildSlashCommands } from './registerCommands.js';
import { startDecisionMomentLoop, tickDecisionMoments } from '../decisionMoments/poster.js';

const log = new Logger('discord-sales-os');

export function installSalesDecisionOs(client: Client): void {
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
      const cmds = new Set(['sales', 'top-decisions', 'debate', 'compare', 'send', 'outcome']);
      if (!cmds.has(interaction.commandName)) return;
    } else if (interaction.isButton()) {
      if (!interaction.customId.startsWith('nsos:')) return;
    } else {
      return;
    }
    await handleSalesOsInteraction(interaction);
  });

  client.once('ready', async () => {
    if (config.discord.token && config.discord.guildId?.trim()) {
      try {
        await registerGuildSlashCommands(config.discord.token, client.user!.id, config.discord.guildId.trim());
        log.info(`Sales OS slash commands registered (guild ${config.discord.guildId})`);
      } catch (err) {
        log.error('Sales OS slash registration failed', err);
      }
    } else {
      log.info('Sales OS: set DISCORD_GUILD_ID for slash commands');
    }
    tickDecisionMoments(client).catch((e) => log.warn('initial moment tick', e));
    startDecisionMomentLoop(client);
  });
}
