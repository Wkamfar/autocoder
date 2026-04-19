import { REST, Routes, SlashCommandBuilder } from 'discord.js';

/**
 * Slash-command set for NightShift. Deliberately scoped to read-only +
 * common-action commands; destructive ones (stop, accept, rollback, etc.)
 * are still available via `!ns <cmd>` but kept off the slash surface.
 *
 * The command *names* match the `!ns <cmd>` router in
 * `src/discord/commands.ts::handleCommand`, so the slash handler can
 * forward `interaction.commandName` and the `text` option straight
 * through without translation.
 */
export const nsSlashCommands = [
  new SlashCommandBuilder().setName('status').setDescription('Current run progress + cost'),
  new SlashCommandBuilder().setName('tasks').setDescription('List remaining tasks in the queue'),
  new SlashCommandBuilder().setName('cost').setDescription('Token + cost breakdown for the current run'),
  new SlashCommandBuilder().setName('diff').setDescription('Branch-vs-main comparison report'),
  new SlashCommandBuilder().setName('report').setDescription('Generate a comparison report now'),
  new SlashCommandBuilder().setName('doctor').setDescription('Pre-flight check: env, binaries, repos'),
  new SlashCommandBuilder()
    .setName('debate')
    .setDescription('Show the adversarial debate transcript for a task')
    .addStringOption((o) =>
      o.setName('text').setDescription('Task id, e.g. t-042').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('debate-prompt')
    .setDescription("Show the system prompts used for the debate agents"),
  new SlashCommandBuilder().setName('help').setDescription('List all NightShift commands'),
  new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start a new run with an objective')
    .addStringOption((o) =>
      o.setName('text').setDescription('Objective text').setRequired(true)
    ),
  new SlashCommandBuilder().setName('pause').setDescription('Pause the loop after the current task'),
  new SlashCommandBuilder().setName('resume').setDescription('Resume a paused loop'),
  new SlashCommandBuilder()
    .setName('inject')
    .setDescription('Inject an instruction into the live run')
    .addStringOption((o) =>
      o.setName('text').setDescription('Instruction text').setRequired(true)
    ),
  new SlashCommandBuilder().setName('objectives').setDescription('List queued objectives'),
  new SlashCommandBuilder()
    .setName('add-objective')
    .setDescription('Queue an objective for when the current run finishes')
    .addStringOption((o) =>
      o.setName('text').setDescription('Objective text').setRequired(true)
    ),
].map((c) => c.toJSON());

export const NS_SLASH_COMMAND_NAMES = new Set<string>(nsSlashCommands.map((c) => c.name));

export async function registerGuildSlashCommands(
  token: string,
  clientId: string,
  guildId: string
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: nsSlashCommands,
  });
}
