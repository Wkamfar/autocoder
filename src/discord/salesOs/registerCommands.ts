import { REST, Routes, SlashCommandBuilder } from 'discord.js';

export const salesSlashCommands = [
  new SlashCommandBuilder()
    .setName('sales')
    .setDescription('Sales Decision OS — overview and shortcuts'),

  new SlashCommandBuilder()
    .setName('top-decisions')
    .setDescription('Rank open deals (Decision Engine)')
    .addIntegerOption((o) =>
      o
        .setName('limit')
        .setDescription('How many deals (1–5)')
        .setMinValue(1)
        .setMaxValue(5)
    )
    .addBooleanOption((o) =>
      o
        .setName('include_non_recommended')
        .setDescription('Include deals below recommendation threshold (debug)')
    ),

  new SlashCommandBuilder()
    .setName('debate')
    .setDescription('Run Pair Debate for a deal')
    .addStringOption((o) =>
      o.setName('deal_id').setDescription('Deal id from sales world').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('compare')
    .setDescription('Single-model + Pair Debate A/B (2× LLM cost)')
    .addStringOption((o) =>
      o.setName('deal_id').setDescription('Deal id from sales world').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('send')
    .setDescription('Review draft email (confirmation only — no auto-send)')
    .addStringOption((o) =>
      o.setName('deal_id').setDescription('Deal id (uses last debate in this channel)').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('outcome')
    .setDescription('Log outcome after acting on a debate')
    .addStringOption((o) =>
      o.setName('deal_id').setDescription('Deal id').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('run_id').setDescription('Pair Debate run id (defaults to last in channel)')
    )
    .addBooleanOption((o) =>
      o.setName('recommended_used').setDescription('Did you use the recommended next step?')
    )
    .addBooleanOption((o) =>
      o.setName('draft_as_is').setDescription('Was the draft sent verbatim?')
    )
    .addStringOption((o) =>
      o
        .setName('human_modified')
        .setDescription('How much you edited')
        .addChoices(
          { name: 'none', value: 'none' },
          { name: 'light', value: 'light' },
          { name: 'heavy', value: 'heavy' }
        )
    )
    .addStringOption((o) =>
      o.setName('override_reason').setDescription('If you did not follow the recommendation')
    )
    .addIntegerOption((o) =>
      o.setName('helpfulness').setDescription('1–5 helpfulness').setMinValue(1).setMaxValue(5)
    ),
].map((c) => c.toJSON());

export async function registerGuildSlashCommands(
  token: string,
  clientId: string,
  guildId: string
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: salesSlashCommands });
}
