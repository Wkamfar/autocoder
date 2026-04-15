import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const PREFIX = 'nsos';

export function threadActionRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${PREFIX}:thr:send`).setLabel('Send as-is').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${PREFIX}:thr:edit`).setLabel('Edit').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${PREFIX}:thr:skip`).setLabel('Skip').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${PREFIX}:thr:cmp`).setLabel('Compare').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`${PREFIX}:thr:full`).setLabel('Full run').setStyle(ButtonStyle.Secondary)
    ),
  ];
}

export function topDecisionButtonRows(count: number): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < count; i++) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${PREFIX}:td:d:${i}`)
          .setLabel('Debate')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`${PREFIX}:td:v:${i}`)
          .setLabel('View')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`${PREFIX}:td:x:${i}`)
          .setLabel('Dismiss')
          .setStyle(ButtonStyle.Danger)
      )
    );
  }
  return rows;
}
