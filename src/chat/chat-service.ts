import fs from 'node:fs/promises';
import path from 'node:path';
import { RemoteLocalSession } from '../engines/remote-local.js';
import { config } from '../config.js';
import { Logger } from '../utils/logger.js';

/**
 * DeepSeek-backed chat service. Replies to plain messages in a designated
 * channel with answers grounded in the repo's brain/knowledge files and
 * top-level docs. Keeps a short rolling memory per channel so follow-up
 * questions feel conversational.
 *
 * Intentionally simple: one DeepSeek session per call, no planner/branch
 * pipeline, no Claude, no tools.
 *
 * Supports a custom `persona` (prepended to the system prompt) and an
 * optional `dynamicContext` callback that returns role-specific live data
 * (e.g. the Sales chat injects current CRM state) — also cached with the
 * rest of the system prompt for `cacheTtlMs`.
 */
export interface ChatOptions {
  /** Replaces the default preamble. Used to give each channel a persona. */
  persona?: string;
  /**
   * Optional callback producing role-specific live context, appended to
   * the system prompt. Cached with the rest of the prompt.
   */
  dynamicContext?: () => Promise<string> | string;
  /** Tag used in logs so you can tell multiple services apart. */
  name?: string;
}

export class ChatService {
  private log: Logger;
  private memory = new Map<string, ChatTurn[]>();
  private cache: { text: string; loadedAt: number } | null = null;
  private readonly maxTurns = 20; // 10 user/assistant pairs
  private readonly cacheTtlMs = 5 * 60 * 1000;
  private readonly sectionCap = 4000;
  private readonly totalCap = 24000;
  private readonly persona: string;
  private readonly dynamicContext?: () => Promise<string> | string;

  constructor(
    private readonly brainDir: string = config.brain.dir,
    private readonly repoRoot: string = process.cwd(),
    options: ChatOptions = {}
  ) {
    this.log = new Logger(options.name ? `chat:${options.name}` : 'chat');
    this.persona =
      options.persona ||
      "You are NightShift's chat assistant. NightShift is an autonomous build daemon that runs Discord-driven coding tasks. Answer the user's questions using the repo context below. Be concise and direct. If you don't know something from the context, say so rather than guessing.";
    this.dynamicContext = options.dynamicContext;
  }

  async ask(
    channelId: string,
    userText: string
  ): Promise<{ text: string; ok: boolean; error?: string }> {
    const history = this.memory.get(channelId) ?? [];
    const systemPrompt = await this.buildSystemPrompt();

    const transcript = this.renderTranscript(history, userText);
    const session = new RemoteLocalSession(`chat-${channelId}-${Date.now()}`);
    try {
      await session.start({
        projectDir: this.repoRoot,
        model: config.engines.deepseekModel,
        systemPrompt,
      });
    } catch (err) {
      return {
        text: '',
        ok: false,
        error: `chat init failed: ${(err as Error).message}`,
      };
    }

    try {
      const res = await session.send(transcript);
      if (!res.ok) {
        if (res.rate_limited) {
          return {
            text: '',
            ok: false,
            error: 'DeepSeek rate-limited — try again shortly.',
          };
        }
        const msg = res.error || 'unknown error';
        return {
          text: '',
          ok: false,
          error: `chat error: ${msg.slice(0, 200)}`,
        };
      }
      const reply = res.text.trim();
      if (!reply) {
        return { text: '', ok: false, error: 'DeepSeek returned no answer.' };
      }
      // commit to memory
      const next = [...history, { role: 'user' as const, content: userText }, { role: 'assistant' as const, content: reply }];
      this.memory.set(channelId, next.slice(-this.maxTurns));
      return { text: reply, ok: true };
    } finally {
      await session.stop().catch(() => {});
    }
  }

  resetChannel(channelId: string): void {
    this.memory.delete(channelId);
  }

  private renderTranscript(history: ChatTurn[], userText: string): string {
    if (history.length === 0) return userText;
    const lines: string[] = [];
    for (const turn of history) {
      lines.push(`${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`);
    }
    lines.push(`User: ${userText}`);
    lines.push('Assistant:');
    return lines.join('\n');
  }

  private async buildSystemPrompt(): Promise<string> {
    const staticPart = await this.buildStaticSections();
    // dynamicContext is always fetched fresh — role-specific live data
    // (e.g. current CRM state) should not be stuck in a 5-min cache.
    if (this.dynamicContext) {
      try {
        const extra = await this.dynamicContext();
        if (extra && extra.trim()) {
          const capped =
            extra.length > this.sectionCap
              ? extra.slice(0, this.sectionCap) + '\n…(truncated)…'
              : extra;
          return staticPart + '\n\n## Live Role Context\n' + capped;
        }
      } catch (err) {
        this.log.warn(`dynamicContext failed: ${(err as Error).message}`);
      }
    }
    return staticPart;
  }

  private async buildStaticSections(): Promise<string> {
    if (this.cache && Date.now() - this.cache.loadedAt < this.cacheTtlMs) {
      return this.cache.text;
    }

    const sections: string[] = [this.persona];
    const knowledgeDir = path.join(this.brainDir, 'knowledge');

    const arch = await this.readCapped(path.join(knowledgeDir, 'architecture.md'), this.sectionCap);
    if (arch) sections.push('## Architecture\n' + arch);

    const guide = await this.readCapped(path.join(knowledgeDir, 'brain-guide.md'), this.sectionCap);
    if (guide) sections.push('## Brain Guide (recent run summaries)\n' + guide);

    const patterns = await this.readCapped(path.join(knowledgeDir, 'patterns.md'), this.sectionCap);
    if (patterns) sections.push('## Patterns\n' + patterns);

    const anti = await this.readLastLines(path.join(knowledgeDir, 'antipatterns.md'), 40);
    if (anti) sections.push('## Recent Anti-patterns\n' + anti.slice(0, this.sectionCap));

    for (const docName of ['README.md', 'DISCORD_SETUP.md', 'PLAN.md']) {
      const body = await this.readCapped(path.join(this.repoRoot, docName), this.sectionCap);
      if (body) sections.push(`## ${docName}\n${body}`);
    }

    let text = sections.join('\n\n');
    if (text.length > this.totalCap) {
      this.log.warn(`system prompt truncated from ${text.length} to ${this.totalCap} chars`);
      text = text.slice(0, this.totalCap) + '\n…(truncated)…';
    }
    this.cache = { text, loadedAt: Date.now() };
    return text;
  }

  private async readCapped(filePath: string, cap: number): Promise<string> {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const trimmed = raw.trim();
      if (!trimmed) return '';
      return trimmed.length > cap ? trimmed.slice(0, cap) + '\n…(truncated)…' : trimmed;
    } catch {
      return '';
    }
  }

  private async readLastLines(filePath: string, n: number): Promise<string> {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const lines = raw.trim().split('\n');
      return lines.slice(-n).join('\n');
    } catch {
      return '';
    }
  }
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}
