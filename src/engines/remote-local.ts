import { BaseSession, priceFor } from './base.js';
import { SessionOpts, SessionResult } from '../types.js';
import { config } from '../config.js';

/**
 * DeepSeek cloud API session (OpenAI-compatible /v1/chat/completions).
 * Still wired to the `local` engine slot because the decision engine uses
 * that slot for cheap/bulk work — but it is in fact a paid API tier.
 */
export class RemoteLocalSession extends BaseSession {
  private model: string;
  private baseUrl: string;
  private apiKey: string;

  constructor(id: string) {
    super(id, 'local');
    this.model = config.engines.deepseekModel;
    this.baseUrl = config.engines.deepseekBaseUrl.replace(/\/+$/, '');
    this.apiKey = config.engines.deepseekApiKey;
  }

  async start(opts: SessionOpts): Promise<void> {
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY not set — cannot start DeepSeek session');
    }
    this.opts = opts;
    this.model = opts.model || this.model;
    this.status = 'running';
    this.log.info(`ready (deepseek api, model=${this.model})`);
  }

  async send(message: string): Promise<SessionResult> {
    if (!this.opts) throw new Error('deepseek session not started');
    const started = Date.now();

    const body = {
      model: this.model,
      stream: false,
      temperature: 0.2,
      messages: [
        ...(this.opts.systemPrompt
          ? [{ role: 'system', content: this.opts.systemPrompt }]
          : []),
        { role: 'user', content: message },
      ],
    };

    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 1000 * 60 * 10);
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        const rateLimited = res.status === 429;
        return {
          text: '',
          tokens: 0,
          cost_usd: 0,
          duration_ms: Date.now() - started,
          events: [],
          error: `deepseek HTTP ${res.status}: ${err.slice(0, 500)}`,
          rate_limited: rateLimited,
          ok: false,
        };
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const text = json.choices?.[0]?.message?.content ?? '';
      const inTok = json.usage?.prompt_tokens ?? Math.ceil(message.length / 4);
      const outTok = json.usage?.completion_tokens ?? Math.ceil(text.length / 4);
      const costUsd = priceFor(this.model, inTok, outTok);
      this.addCost(inTok, outTok, costUsd);

      if (!text.trim()) {
        return {
          text: '',
          tokens: inTok + outTok,
          cost_usd: costUsd,
          duration_ms: Date.now() - started,
          events: [],
          error: 'deepseek returned empty content',
          ok: false,
        };
      }

      return {
        text,
        tokens: inTok + outTok,
        cost_usd: costUsd,
        duration_ms: Date.now() - started,
        events: [],
        ok: true,
      };
    } catch (err) {
      return {
        text: '',
        tokens: 0,
        cost_usd: 0,
        duration_ms: Date.now() - started,
        events: [],
        error: `deepseek fetch failed: ${(err as Error).message}`,
        ok: false,
      };
    }
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
  }
}
