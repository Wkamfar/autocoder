import {
  Client,
  GatewayIntentBits,
  Message,
  Partials,
  TextChannel,
} from 'discord.js';
import { config } from '../config.js';
import { NightShiftDaemon } from '../daemon.js';
import { Logger } from '../utils/logger.js';
import { ComparisonReport, RunState, Task, TaskResult } from '../types.js';
import { COMMAND_HELP, handleCommand } from './commands.js';
import { handleSalesCommand, SALES_COMMAND_HELP } from './salesCommands.js';

export class ClawBot {
  private client: Client;
  private log = new Logger('discord');
  private channel: TextChannel | null = null;
  private tasksCompleted = 0;

  constructor(private daemon: NightShiftDaemon) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel],
    });
  }

  async login(): Promise<void> {
    if (!config.discord.token) {
      this.log.warn('DISCORD_BOT_TOKEN not set — Discord bot disabled');
      return;
    }
    this.client.on('messageCreate', (m) => this.onMessage(m));
    this.client.once('ready', async () => {
      this.log.info(`logged in as ${this.client.user?.tag}`);
      if (config.discord.channelId) {
        try {
          const ch = await this.client.channels.fetch(config.discord.channelId);
          if (ch && ch.isTextBased()) this.channel = ch as TextChannel;
        } catch (err) {
          this.log.warn('could not fetch channel', err);
        }
      }
    });
    await this.client.login(config.discord.token);
    this.wireDaemonEvents();
  }

  async shutdown(): Promise<void> {
    await this.client.destroy();
  }

  private async onMessage(msg: Message): Promise<void> {
    if (msg.author.bot) return;
    if (!msg.content.startsWith('!ns')) return;
    const parts = msg.content.trim().split(/\s+/);
    const [, cmd, ...rest] = parts;
    if (!cmd) {
      await msg.reply('```\n' + COMMAND_HELP + '\n\n' + SALES_COMMAND_HELP + '\n```');
      return;
    }
    try {
      if (cmd === 'sales') {
        const sub = rest[0] ?? 'help';
        const subArgs = rest.slice(1).join(' ');
        const reply = await handleSalesCommand(msg, sub, subArgs);
        if (reply) await msg.reply(reply.length > 1900 ? reply.slice(0, 1900) + '…' : reply);
        return;
      }
      const reply = await handleCommand(this.daemon, cmd, rest.join(' '));
      if (reply) await msg.reply(reply.length > 1900 ? reply.slice(0, 1900) + '…' : reply);
    } catch (err) {
      this.log.error('command failed', err);
      await msg.reply(`error: ${(err as Error).message}`);
    }
  }

  private wireDaemonEvents(): void {
    this.daemon.events.on('taskStart', (task: Task) => {
      this.post(`▶ start ${task.id} — ${task.title}`);
    });
    this.daemon.events.on('taskComplete', (task: Task, result: TaskResult) => {
      this.tasksCompleted += 1;
      const icon = result.status === 'passed' ? 'OK' : result.status === 'escalated' ? 'ESC' : 'FAIL';
      this.post(
        `[${icon}] ${task.id} via ${result.engine} (${result.mode}) — $${result.cost_usd.toFixed(3)}`
      );
      if (this.tasksCompleted % 5 === 0) {
        const state = this.daemon.getStatus();
        if (state) this.post(this.formatStatus(state));
      }
    });
    this.daemon.events.on('escalation', (task: Task, reason: string) => {
      this.post(
        `ESCALATION — ${task.id} needs a human: ${reason.slice(0, 500)}\n<@${config.discord.ownerId}>`
      );
    });
    this.daemon.events.on('finished', (state: RunState, report: ComparisonReport) => {
      this.post(this.formatReport(state, report));
    });
    this.daemon.events.on('error', (err: Error) => {
      this.post(`loop error: ${err.message}\n<@${config.discord.ownerId}>`);
    });
  }

  private async post(content: string): Promise<void> {
    if (!this.channel) {
      this.log.info(`(no channel) ${content}`);
      return;
    }
    try {
      await this.channel.send(content.length > 1900 ? content.slice(0, 1900) + '…' : content);
    } catch (err) {
      this.log.warn('post failed', err);
    }
  }

  formatStatus(state: RunState): string {
    const total = state.completed.length + state.task_queue.length + state.escalated.length;
    const done = state.completed.length;
    const bar = buildProgressBar(done, total);
    return [
      `NightShift ${state.run_id}`,
      `objective: ${state.objective.title}`,
      `branch: ${state.branch}`,
      `progress: ${bar} ${done}/${total}`,
      `current: ${state.current_task_id ?? '—'}`,
      `cost: $${state.total_cost_usd.toFixed(2)}`,
      `escalated: ${state.escalated.length}`,
      `status: ${state.status}`,
    ].join('\n');
  }

  formatReport(state: RunState, report: ComparisonReport): string {
    return [
      `NightShift run ${state.run_id} finished (${state.status})`,
      `branch ${report.branch}`,
      `${report.stats.files_changed} files, +${report.stats.insertions}/-${report.stats.deletions}`,
      `tests: main ${report.tests.main.passed}/${report.tests.main.failed} → branch ${report.tests.branch.passed}/${report.tests.branch.failed}`,
      `lint: ${report.lint.main_errors} → ${report.lint.branch_errors} (Δ ${report.lint.improvement})`,
      `completed ${state.completed.length}, escalated ${state.escalated.length}`,
      `cost $${state.total_cost_usd.toFixed(2)}`,
      `use !ns diff for full detail, !ns accept to merge`,
    ].join('\n');
  }
}

function buildProgressBar(done: number, total: number, width = 16): string {
  if (total === 0) return '[' + ' '.repeat(width) + ']';
  const filled = Math.round((done / total) * width);
  return '[' + '#'.repeat(filled) + '-'.repeat(width - filled) + ']';
}
