import type { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';

/** Prefer parent text channel id when command runs inside a thread (stable session keys). */
export function effectiveTextChannelId(
  interaction: ChatInputCommandInteraction | ButtonInteraction
): string {
  const ch = interaction.channel;
  if (ch?.isThread()) {
    return ch.parentId ?? ch.id;
  }
  return ch?.id ?? '';
}
