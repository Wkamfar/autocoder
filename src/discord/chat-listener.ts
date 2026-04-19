import type { Client, Message, TextBasedChannel } from 'discord.js';
import { Logger } from '../utils/logger.js';
import { ChatService } from '../chat/chat-service.js';

const log = new Logger('discord-chat');
const CHUNK = 1900;
const MAX_CHUNKS = 5;

/**
 * Attach a plain-message listener that routes anything typed in the
 * `chatChannelId` channel (unless it starts with `!` or `/`) to the
 * ChatService, which replies using DeepSeek.
 *
 * discord.js allows multiple `messageCreate` listeners — the existing
 * `!ns` handler in ClawBot keeps working untouched. This listener simply
 * short-circuits on anything it doesn't own.
 */
export function installChatListener(
  client: Client,
  chat: ChatService,
  chatChannelId: string
): void {
  if (!chatChannelId) {
    log.info('DISCORD_CHAT_CHANNEL_ID not set — chat surface disabled');
    return;
  }
  log.info(`chat surface bound to channel ${chatChannelId}`);

  client.on('messageCreate', async (msg: Message) => {
    if (msg.author.bot) return;
    const content = msg.content.trim();
    if (!content) return;
    if (content.startsWith('!') || content.startsWith('/')) return;
    if (msg.channel.id !== chatChannelId) {
      log.info(
        `ignored plain message in channel ${msg.channel.id} (bound to ${chatChannelId}) — set DISCORD_CHAT_CHANNEL_ID=${msg.channel.id} to enable chat here`
      );
      return;
    }
    log.info(`chat from ${msg.author.tag}: ${content.slice(0, 60)}`);

    try {
      await startTyping(msg.channel);
    } catch {
      /* typing is best-effort */
    }

    try {
      const res = await chat.ask(msg.channel.id, content);
      if (!res.ok) {
        await msg.reply(res.error || 'chat failed');
        return;
      }
      await sendChunked(msg, res.text);
    } catch (err) {
      log.error('chat failed', err);
      await msg.reply(`chat error: ${(err as Error).message.slice(0, 200)}`);
    }
  });
}

async function startTyping(channel: TextBasedChannel): Promise<void> {
  const maybeSendTyping = (channel as unknown as { sendTyping?: () => Promise<void> })
    .sendTyping;
  if (typeof maybeSendTyping === 'function') {
    await maybeSendTyping.call(channel);
  }
}

async function sendChunked(msg: Message, text: string): Promise<void> {
  const chunks = splitChunks(text, CHUNK, MAX_CHUNKS);
  if (chunks.length === 0) {
    await msg.reply('(empty reply)');
    return;
  }
  await msg.reply(chunks[0]);
  for (let i = 1; i < chunks.length; i++) {
    const ch = msg.channel as unknown as { send: (s: string) => Promise<unknown> };
    await ch.send(chunks[i]);
  }
}

function splitChunks(text: string, size: number, max: number): string[] {
  const out: string[] = [];
  let remaining = text;
  while (remaining.length > size && out.length < max - 1) {
    // prefer splitting on a newline boundary if one exists in the last 200 chars
    let cut = size;
    const window = remaining.slice(0, size);
    const lastNl = window.lastIndexOf('\n');
    if (lastNl > size - 200) cut = lastNl;
    out.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining.length > size) {
    out.push(remaining.slice(0, size - 20) + '\n…(truncated)…');
  } else if (remaining) {
    out.push(remaining);
  }
  return out;
}
