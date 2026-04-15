import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
  type ThreadChannel,
  ThreadAutoArchiveDuration,
} from 'discord.js';
import { Logger } from '../../utils/logger.js';
import { config } from '../../config.js';
import {
  formatAlertError,
  formatCompareRunningStub,
  formatCompareSummary,
  formatDebateRunningStub,
  formatOutcomeOk,
  formatPairDebateSynthesis,
  formatSalesOverview,
  formatSendPreview,
  formatStubReply,
  formatThreadParentPing,
  formatTopDecisionsList,
  formatViewDeal,
} from '../components/salesPolish.js';
import { handleMomentInteraction } from '../decisionMoments/poster.js';
import { logDiscordSalesOs } from './logging.js';
import {
  bindThreadToRunKey,
  getLastRun,
  getRunKeyForThread,
  getTopDecisionsPayload,
  keyGuildChannelDeal,
  rememberDealThread,
  setLastRun,
  setTopDecisionsPayload,
  getDealThread,
  type StoredDealRun,
} from './state.js';
import {
  defaultWorldLabel,
  exportRunToState,
  formatDealSummary,
  getRankedDecisions,
  getRankedDecisionsAll,
  logPairDebateOutcome,
  runCompareOnline,
  runPairDebateForDeal,
} from '../../sales/discordOs/salesDiscordService.js';
import { pruneTopPayloads } from './state.js';
import { effectiveTextChannelId } from './channelContext.js';
import { PREFIX, threadActionRows, topDecisionButtonRows } from './threadButtons.js';

const log = new Logger('discord-sales-os');

async function handleSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.commandName;

  if (name === 'sales') {
    await interaction.reply({
      content: formatSalesOverview(),
      ephemeral: true,
    });
    await logDiscordSalesOs({ event: 'slash_sales', userId: interaction.user.id, channelId: interaction.channelId });
    return;
  }

  if (name === 'top-decisions') {
    await interaction.deferReply();
    pruneTopPayloads();
    const limit = interaction.options.getInteger('limit') ?? 5;
    const includeAll = interaction.options.getBoolean('include_non_recommended') ?? false;
    try {
      const rows = includeAll ? await getRankedDecisionsAll(limit) : await getRankedDecisions(limit);
      const content = formatTopDecisionsList(rows, defaultWorldLabel());
      const dealIds = rows.map((r) => r.deal_id);
      const components = topDecisionButtonRows(dealIds.length);
      await interaction.editReply({ content, components });
      const msg = await interaction.fetchReply();
      setTopDecisionsPayload(msg.id, dealIds);
      await logDiscordSalesOs({
        event: 'slash_top_decisions',
        userId: interaction.user.id,
        channelId: interaction.channelId,
        dealIds,
      });
    } catch (err) {
      await interaction.editReply({
        content: formatAlertError((err as Error).message),
        components: [],
      });
    }
    return;
  }

  if (name === 'debate') {
    const dealId = interaction.options.getString('deal_id', true);
    await interaction.deferReply();
    await runDebateFlow(interaction, dealId);
    return;
  }

  if (name === 'compare') {
    const dealId = interaction.options.getString('deal_id', true);
    await interaction.deferReply();
    await interaction.editReply({ content: formatCompareRunningStub() });
    try {
      const { markdown, pairRunId, totalCostUsd, scopeLabel, singleSynthesis, pairSynthesis } =
        await runCompareOnline(dealId);
      await logDiscordSalesOs({
        event: 'slash_compare',
        userId: interaction.user.id,
        dealId,
        pairRunId,
        totalCostUsd,
      });
      const summary = formatCompareSummary({
        scopeLabel,
        single: singleSynthesis,
        pair: pairSynthesis,
        costUsd: totalCostUsd,
      });
      if (markdown.length > 2800) {
        const buf = Buffer.from(markdown, 'utf8');
        const att = new AttachmentBuilder(buf, { name: `comparison-${pairRunId}.md` });
        await interaction.editReply({ content: summary, files: [att] });
      } else {
        await interaction.editReply({ content: summary });
      }
    } catch (err) {
      await interaction.editReply({ content: formatAlertError((err as Error).message) });
    }
    return;
  }

  if (name === 'send') {
    const dealId = interaction.options.getString('deal_id', true);
    const guildId = interaction.guildId ?? 'dm';
    const channelId = effectiveTextChannelId(interaction);
    const runKey = keyGuildChannelDeal(guildId, channelId, dealId);
    const last = getLastRun(runKey);
    if (!last) {
      await interaction.reply({
        content: formatAlertError('No debate for this deal in channel. `/debate` first.'),
        ephemeral: true,
      });
      return;
    }
    const draft = last.synthesis.draft_artifact?.content ?? '';
    await interaction.reply({
      content: formatSendPreview(draft),
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`${PREFIX}:snd:ok:${dealId}`)
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`${PREFIX}:snd:cancel`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
      ephemeral: true,
    });
    await logDiscordSalesOs({ event: 'slash_send_preview', userId: interaction.user.id, dealId, runId: last.runId });
    return;
  }

  if (name === 'outcome') {
    const dealId = interaction.options.getString('deal_id', true);
    const runIdOpt = interaction.options.getString('run_id');
    const guildId = interaction.guildId ?? 'dm';
    const channelId = effectiveTextChannelId(interaction);
    const runKey = keyGuildChannelDeal(guildId, channelId, dealId);
    const last = getLastRun(runKey);
    const run_id = runIdOpt ?? last?.runId;
    if (!run_id) {
      await interaction.reply({
        content: formatAlertError('Need run_id or /debate in this channel.'),
        ephemeral: true,
      });
      return;
    }
    const row = {
      ts: new Date().toISOString(),
      run_id,
      deal_id: dealId,
      recommended_action_used: interaction.options.getBoolean('recommended_used') ?? undefined,
      draft_used_as_is: interaction.options.getBoolean('draft_as_is') ?? undefined,
      human_modified: (interaction.options.getString('human_modified') as 'none' | 'light' | 'heavy' | null) ?? undefined,
      human_override_reason: interaction.options.getString('override_reason') ?? undefined,
      human_helpfulness_score: (interaction.options.getInteger('helpfulness') ?? undefined) as
        | 1
        | 2
        | 3
        | 4
        | 5
        | undefined,
    };
    const p = await logPairDebateOutcome(row);
    await interaction.reply({ content: formatOutcomeOk(p), ephemeral: true });
    await logDiscordSalesOs({ event: 'slash_outcome', userId: interaction.user.id, ...row });
    return;
  }
}

async function runDebateFlow(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  dealId: string
): Promise<void> {
  const guildId = interaction.guildId ?? 'dm';
  const channelId = effectiveTextChannelId(interaction);
  const runKey = keyGuildChannelDeal(guildId, channelId, dealId);

  await interaction.editReply({ content: formatDebateRunningStub() });

  try {
    const result = await runPairDebateForDeal(dealId);
    const exportDir = await exportRunToState(result);
    const summary = formatDealSummary(dealId);
    const v =
      summary?.description.match(/\*\*Value:\*\* ([^\n]+)/)?.[1]?.replace(/[^0-9.k$]/gi, '') ?? '';
    const acct = summary?.title ?? dealId;
    const threadName = `🧠 Pair Debate — ${acct}${v ? ` (${v})` : ''}`.slice(0, 100);

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

    await interaction.editReply({
      content: formatThreadParentPing(result.run_id, result.total_cost_usd),
      components: [],
    });

    const msg = await interaction.fetchReply();
    if (!interaction.inGuild()) {
      await interaction.followUp({ content: 'Use this in a server text channel.', ephemeral: true });
      return;
    }

    let thread: ThreadChannel | null = null;
    const existingId = getDealThread(runKey);
    if (existingId) {
      try {
        const ch = await interaction.client.channels.fetch(existingId);
        if (ch?.isThread()) {
          thread = ch;
          if (thread.archived) await thread.setArchived(false);
        }
      } catch {
        /* create new */
      }
    }
    if (!thread) {
      thread = await msg.startThread({
        name: threadName,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
        reason: 'Pair Debate synthesis',
      });
      rememberDealThread(runKey, thread.id);
    }

    bindThreadToRunKey(thread.id, runKey);

    const body = formatPairDebateSynthesis({
      dealId,
      runId: result.run_id,
      synthesis: result.synthesis,
    });
    await thread.send({
      content: body,
      components: threadActionRows(),
    });

    await logDiscordSalesOs({
      event: 'debate_complete',
      userId: interaction.user.id,
      dealId,
      runId: result.run_id,
      threadId: thread.id,
      exportDir,
      logPath: result.logPath,
    });

    const logAppend = path.join(config.runtime.stateDir, 'pair-debate-runs', `discord-${result.run_id}.txt`);
    await fs.mkdir(path.dirname(logAppend), { recursive: true });
    await fs.appendFile(
      logAppend,
      `[discord] ${new Date().toISOString()} user=${interaction.user.id} channel=${channelId} deal=${dealId} thread=${thread.id}\n`,
      'utf8'
    );
  } catch (err) {
    await interaction.editReply({ content: formatAlertError((err as Error).message) });
  }
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const id = interaction.customId;
  if (!id.startsWith(`${PREFIX}:`)) return;

  const parts = id.split(':');
  if (parts[1] === 'dm') {
    const dmAction = parts[2] as 'debate' | 'send' | 'skip';
    const dealId = parts.slice(3).join(':');
    const guildId = interaction.guildId ?? '';
    const channelId = effectiveTextChannelId(interaction);
    await interaction.deferReply({ ephemeral: true });
    const text = await handleMomentInteraction(
      interaction.client,
      dmAction,
      dealId,
      guildId,
      channelId,
      interaction.user.id
    );
    await interaction.editReply({ content: text });
    return;
  }

  const [, section, action, arg] = parts;

  if (section === 'td') {
    const payload = interaction.message.id ? getTopDecisionsPayload(interaction.message.id) : undefined;
    if (!payload) {
      await interaction.reply({ content: 'This list expired — run `/top-decisions` again.', ephemeral: true });
      return;
    }
    const idx = Number(arg);
    const dealId = payload.dealIds[idx];
    if (!dealId) {
      await interaction.reply({ content: 'Invalid button.', ephemeral: true });
      return;
    }

    if (action === 'v') {
      const s = formatDealSummary(dealId);
      await interaction.reply({
        content: formatViewDeal(s?.title ?? dealId, s?.description ?? 'Not in world file.'),
        ephemeral: true,
      });
      await logDiscordSalesOs({ event: 'button_view', userId: interaction.user.id, dealId });
      return;
    }

    if (action === 'x') {
      await interaction.reply({ content: '_Dismissed._', ephemeral: true });
      await logDiscordSalesOs({ event: 'button_dismiss', userId: interaction.user.id, dealId });
      return;
    }

    if (action === 'd') {
      await interaction.deferReply({ ephemeral: false });
      await runDebateFlow(interaction, dealId);
      return;
    }
  }

  if (section === 'thr') {
    await interaction.deferReply({ ephemeral: true });
    const threadId = interaction.channel?.isThread() ? interaction.channel.id : '';
    const runKey = threadId ? getRunKeyForThread(threadId) : undefined;
    const last = runKey ? getLastRun(runKey) : undefined;
    if (!last) {
      await interaction.editReply('No session in this thread. Run `/debate` from the channel.');
      return;
    }

    if (action === 'send') {
      await interaction.editReply({ content: formatStubReply('send') });
      await logDiscordSalesOs({ event: 'button_send_stub', userId: interaction.user.id, runId: last.runId });
      return;
    }
    if (action === 'edit') {
      await interaction.editReply({ content: formatStubReply('edit') });
      return;
    }
    if (action === 'skip') {
      await interaction.editReply({ content: formatStubReply('skip') });
      return;
    }
    if (action === 'cmp') {
      await interaction.editReply({ content: formatCompareRunningStub() });
      const parent = interaction.channel?.isThread() ? interaction.channel.parent : null;
      if (parent?.isTextBased()) {
        try {
          const r = await runCompareOnline(last.dealId);
          const summary = formatCompareSummary({
            scopeLabel: r.scopeLabel,
            single: r.singleSynthesis,
            pair: r.pairSynthesis,
            costUsd: r.totalCostUsd,
          });
          if (r.markdown.length > 2800) {
            const buf = Buffer.from(r.markdown, 'utf8');
            await parent.send({
              content: summary,
              files: [new AttachmentBuilder(buf, { name: `compare-${r.pairRunId}.md` })],
            });
          } else {
            await parent.send({ content: summary });
          }
        } catch (e) {
          await parent.send({ content: formatAlertError((e as Error).message) });
        }
      }
      return;
    }
    if (action === 'full') {
      const dir = last.exportDir ?? '—';
      await interaction.editReply({ content: formatStubReply('full', `${dir} · ${last.logPath}`) });
      return;
    }
  }

  if (section === 'snd') {
    if (action === 'cancel') {
      await interaction.reply({ content: 'Cancelled.', ephemeral: true });
      return;
    }
    if (action === 'ok') {
      await interaction.reply({
        content: formatStubReply('send'),
        ephemeral: true,
      });
      await logDiscordSalesOs({ event: 'button_send_confirm_stub', userId: interaction.user.id, dealId: arg });
      return;
    }
  }
}

export async function handleSalesOsInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlash(interaction);
      return;
    }
    if (interaction.isButton()) {
      await handleButton(interaction);
    }
  } catch (err) {
    log.error('sales os interaction failed', err);
    const msg = formatAlertError((err as Error).message);
    if (!interaction.isRepliable()) return;
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    } catch {
      await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
    }
  }
}
