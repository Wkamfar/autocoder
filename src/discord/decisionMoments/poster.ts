import path from 'node:path';
import fs from 'node:fs/promises';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  ThreadAutoArchiveDuration,
} from 'discord.js';
import { config } from '../../config.js';
import { Logger } from '../../utils/logger.js';
import { computeTopDecisionMoment } from '../../sales/decisionEngine/decisionMonitor.js';
import {
  formatDecisionMomentCard,
  formatPairDebateSynthesis,
  formatThreadParentPing,
} from '../components/salesPolish.js';
import { logDiscordSalesOs } from '../salesOs/logging.js';
import { exportRunToState, runPairDebateForDeal } from '../../sales/discordOs/salesDiscordService.js';
import {
  cachePrecomputedDebate,
  peekPrecomputedDebate,
  takePrecomputedDebate,
} from '../../sales/decisionEngine/precomputeCache.js';
import {
  bindThreadToRunKey,
  getDealThread,
  keyGuildChannelDeal,
  rememberDealThread,
  setLastRun,
  type StoredDealRun,
} from '../salesOs/state.js';
import { PREFIX, threadActionRows } from '../salesOs/threadButtons.js';

const log = new Logger('decision-moments');

type PosterState = {
  messageId: string | null;
  dealId: string | null;
  ignoreCount: Record<string, number>;
};

function statePath(): string {
  return path.join(config.runtime.stateDir, 'decision-moment-poster.json');
}

async function loadState(): Promise<PosterState> {
  try {
    const raw = await fs.readFile(statePath(), 'utf8');
    return JSON.parse(raw) as PosterState;
  } catch {
    return { messageId: null, dealId: null, ignoreCount: {} };
  }
}

async function saveState(s: PosterState): Promise<void> {
  await fs.mkdir(path.dirname(statePath()), { recursive: true });
  await fs.writeFile(statePath(), JSON.stringify(s, null, 2), 'utf8');
}

function momentChannelId(): string {
  return config.decisionMoments.channelId.trim() || config.discord.channelId;
}

function expiresShort(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const h = Math.max(0, Math.round((t - Date.now()) / 3600_000));
  return h < 1 ? '<1h' : `${h}h`;
}

function momentRows(dealId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${PREFIX}:dm:debate:${dealId}`)
        .setLabel('Run Debate')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${PREFIX}:dm:send:${dealId}`)
        .setLabel('Send now')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${PREFIX}:dm:skip:${dealId}`)
        .setLabel('Skip')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

export async function tickDecisionMoments(client: Client): Promise<void> {
  if (!config.decisionMoments.enabled) return;
  const chId = momentChannelId();
  if (!chId) return;

  const channel = await client.channels.fetch(chId);
  if (!channel?.isSendable()) return;

  const moment = await computeTopDecisionMoment();
  const state = await loadState();

  if (!moment) {
    if (state.messageId) {
      try {
        const msg = await channel.messages.fetch(state.messageId);
        await msg.edit({ content: '_Cleared._', components: [] });
      } catch {
        /* */
      }
    }
    await saveState({ ...state, messageId: null, dealId: null });
    return;
  }

  const ign = state.ignoreCount[moment.deal_id] ?? 0;
  if (ign >= config.decisionMoments.maxIgnoreBeforeDrop) return;

  const esc = (ign >= 2 ? 2 : ign === 1 ? 1 : 0) as 0 | 1 | 2;

  if (config.decisionMoments.precomputeDebate && !peekPrecomputedDebate(moment.deal_id)) {
    try {
      const result = await runPairDebateForDeal(moment.deal_id);
      await exportRunToState(result);
      cachePrecomputedDebate(moment.deal_id, result);
    } catch (e) {
      log.warn('precompute failed', e);
    }
  }

  const hasPre = Boolean(peekPrecomputedDebate(moment.deal_id));
  const card = formatDecisionMomentCard(moment, {
    escalation: esc,
    precomputed: hasPre && config.decisionMoments.precomputeDebate,
    expiresInShort: expiresShort(moment.expires_at),
  });

  const rows = momentRows(moment.deal_id);

  if (state.messageId && state.dealId === moment.deal_id) {
    try {
      const msg = await channel.messages.fetch(state.messageId);
      await msg.edit({ content: card, components: rows });
      return;
    } catch {
      /* fall through */
    }
  }

  const msg = await channel.send({ content: card, components: rows });
  await saveState({ ...state, messageId: msg.id, dealId: moment.deal_id });
  await logDiscordSalesOs({ event: 'moment_post', dealId: moment.deal_id, messageId: msg.id });
}

export async function handleMomentInteraction(
  client: Client,
  action: 'debate' | 'send' | 'skip',
  dealId: string,
  guildId: string,
  channelId: string,
  userId: string
): Promise<string> {
  const state = await loadState();
  if (action === 'skip') {
    state.ignoreCount[dealId] = (state.ignoreCount[dealId] ?? 0) + 1;
    await saveState(state);
    await logDiscordSalesOs({ event: 'moment_skip', dealId, userId });
    return '_Skipped._';
  }
  if (action === 'send') {
    await logDiscordSalesOs({ event: 'moment_send_stub', dealId, userId });
    return '_No send adapter — use CRM._';
  }

  const runKey = keyGuildChannelDeal(guildId, channelId, dealId);
  let result = takePrecomputedDebate(dealId);
  if (!result) {
    result = await runPairDebateForDeal(dealId);
  }
  const exportDir = await exportRunToState(result);
  const acct = result.dossier.scope_label.split('—')[0]?.trim() ?? dealId;
  const stored: StoredDealRun = {
    dealId,
    runId: result.run_id,
    scopeLabel: result.dossier.scope_label,
    accountName: acct,
    valueUsd: 0,
    synthesis: result.synthesis,
    logPath: result.logPath,
    exportDir,
    totalCostUsd: result.total_cost_usd,
    totalTokens: result.total_tokens,
    guildId,
    channelId,
  };
  setLastRun(runKey, stored);

  const ch = await client.channels.fetch(channelId);
  if (!ch?.isSendable()) return 'Channel error.';
  const textCh = ch;
  const ping = await textCh.send({
    content: formatThreadParentPing(result.run_id, result.total_cost_usd),
  });

  let thread = null as import('discord.js').ThreadChannel | null;
  const existingId = getDealThread(runKey);
  if (existingId) {
    try {
      const t = await client.channels.fetch(existingId);
      if (t?.isThread()) {
        thread = t;
        if (thread.archived) await thread.setArchived(false);
      }
    } catch {
      /* */
    }
  }
  if (!thread) {
    thread = await ping.startThread({
      name: `🧠 ${acct}`.slice(0, 100),
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    });
    rememberDealThread(runKey, thread.id);
  }
  bindThreadToRunKey(thread.id, runKey);

  const body = formatPairDebateSynthesis({
    dealId,
    runId: result.run_id,
    synthesis: result.synthesis,
  });
  await thread.send({ content: body, components: threadActionRows() });
  await logDiscordSalesOs({ event: 'moment_debate_ran', dealId, runId: result.run_id, userId, exportDir });
  return '_Posted to thread._';
}

export function startDecisionMomentLoop(client: Client): NodeJS.Timeout | null {
  if (!config.decisionMoments.enabled) return null;
  const ms = Math.max(60_000, config.decisionMoments.monitorIntervalMs);
  return setInterval(() => {
    tickDecisionMoments(client).catch((e) => log.error('moment tick', e));
  }, ms);
}
