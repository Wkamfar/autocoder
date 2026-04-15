import { config } from '../config.js';
import { ComparisonReport, RunState, Task, TaskResult } from '../types.js';
import { Logger } from '../utils/logger.js';

interface Embed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: string;
}

/**
 * Rich-embed updates through a Discord incoming webhook. This is independent of
 * the ClawBot (bot.ts) — enable it by setting DISCORD_WEBHOOK_URL in .env.
 *
 * Uses the message-edit API to update a single pinned status message instead
 * of spamming new messages on every tick.
 */
export class DiscordWebhook {
  private log = new Logger('webhook');
  // Unix ms at which we can attempt webhook posts again; bumped on 429.
  private rateLimitedUntil = 0;

  constructor(private url: string = config.discord.webhookUrl) {}

  enabled(): boolean {
    return !!this.url;
  }

  private truncateEmbed(embed: Embed): Embed {
    // Discord embed limits: description 4096, field value 1024, total 6000.
    const out: Embed = { ...embed };
    if (out.description && out.description.length > 4000) {
      out.description = out.description.slice(0, 4000) + '…';
    }
    if (out.fields) {
      out.fields = out.fields.map((f) => ({
        ...f,
        value: f.value.length > 1000 ? f.value.slice(0, 1000) + '…' : f.value,
      }));
    }
    return out;
  }

  private async post(body: object): Promise<void> {
    if (!this.enabled()) return;
    if (Date.now() < this.rateLimitedUntil) {
      this.log.debug('webhook rate-limited, skipping post');
      return;
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after') ?? '5');
        this.rateLimitedUntil = Date.now() + Math.max(retryAfter, 1) * 1000;
        this.log.warn(`discord 429 — backing off ${retryAfter}s`);
        return;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        this.log.warn(`webhook ${res.status}: ${txt.slice(0, 200)}`);
      }
    } catch (err) {
      this.log.warn('webhook post failed', err);
    } finally {
      clearTimeout(timer);
    }
  }

  async sendEmbed(embed: Embed, content?: string): Promise<void> {
    return this.post({ content, embeds: [this.truncateEmbed(embed)] });
  }

  async sendContent(content: string): Promise<void> {
    return this.post({ content: content.slice(0, 1900) });
  }

  async sendTaskStart(task: Task, engine: string): Promise<void> {
    return this.sendEmbed({
      title: `Task started: ${task.id}`,
      description: task.description.slice(0, 400),
      color: 0x3498db,
      fields: [
        { name: 'Engine', value: engine, inline: true },
        { name: 'Risk', value: task.risk, inline: true },
        { name: 'Complexity', value: task.complexity, inline: true },
        { name: 'Files', value: (task.relevant_files.join(', ') || '—').slice(0, 300) },
      ],
      timestamp: new Date().toISOString(),
    });
  }

  async sendTaskComplete(task: Task, result: TaskResult): Promise<void> {
    const ok = result.status === 'passed';
    return this.sendEmbed({
      title: `${ok ? 'Passed' : result.status.toUpperCase()}: ${task.id}`,
      description: result.summary.slice(0, 600) || task.title,
      color: ok ? 0x2ecc71 : 0xe67e22,
      fields: [
        { name: 'Engine', value: `${result.engine} (${result.mode})`, inline: true },
        { name: 'Tokens', value: String(result.tokens), inline: true },
        { name: 'Cost', value: `$${result.cost_usd.toFixed(3)}`, inline: true },
        {
          name: 'Files changed',
          value: (result.files_changed.join('\n') || '—').slice(0, 600),
        },
      ],
      timestamp: new Date().toISOString(),
    });
  }

  async sendEscalation(task: Task, reason: string): Promise<void> {
    const mention = config.discord.ownerId ? `<@${config.discord.ownerId}>` : '';
    return this.sendEmbed(
      {
        title: `ESCALATION: ${task.id}`,
        description: `${task.title}\n\n${reason.slice(0, 1000)}`,
        color: 0xe74c3c,
        fields: [
          { name: 'Retries', value: String(task.retry_count), inline: true },
          { name: 'Risk', value: task.risk, inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
      mention ? `${mention} NightShift needs your attention` : undefined
    );
  }

  async sendFinished(state: RunState, report: ComparisonReport): Promise<void> {
    const progressBar = this.buildProgress(
      state.completed.length,
      state.completed.length + state.task_queue.length + state.escalated.length
    );
    return this.sendEmbed({
      title: `Run ${state.run_id} finished (${state.status})`,
      description: `${state.objective.title}\n\n${progressBar}`,
      color: state.status === 'completed' ? 0x2ecc71 : 0xf1c40f,
      fields: [
        { name: 'Branch', value: state.branch, inline: false },
        {
          name: 'Files',
          value: `${report.stats.files_changed} changed, +${report.stats.insertions}/-${report.stats.deletions}`,
          inline: true,
        },
        {
          name: 'Tests',
          value: `${report.tests.branch.passed}/${report.tests.branch.failed}`,
          inline: true,
        },
        {
          name: 'Lint',
          value: `${report.lint.main_errors}→${report.lint.branch_errors}`,
          inline: true,
        },
        { name: 'Completed', value: String(state.completed.length), inline: true },
        { name: 'Escalated', value: String(state.escalated.length), inline: true },
        { name: 'Cost', value: `$${state.total_cost_usd.toFixed(2)}`, inline: true },
      ],
      timestamp: new Date().toISOString(),
    });
  }

  private buildProgress(done: number, total: number, width = 18): string {
    if (total === 0) return '`[' + ' '.repeat(width) + ']` 0/0';
    const filled = Math.round((done / total) * width);
    return (
      '`[' + '▓'.repeat(filled) + '░'.repeat(width - filled) + `]` +
      '` ' +
      `${done}/${total}`
    );
  }
}

export const webhook = new DiscordWebhook();
