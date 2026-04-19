import { BaseSession, priceFor } from './base.js';
import { SessionOpts, SessionResult } from '../types.js';
import { config } from '../config.js';

export class GeminiSession extends BaseSession {
  private model: string;
  private baseUrl: string;
  private apiKey: string;

  constructor(id: string) {
    super(id, 'gemini');
    this.model = config.engines.geminiModel;
    this.baseUrl = config.engines.geminiBaseUrl.replace(/\/+$/, '');
    this.apiKey = config.engines.geminiApiKey;
  }

  async start(opts: SessionOpts): Promise<void> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not set — cannot start Gemini session');
    }
    this.opts = opts;
    this.model = opts.model || this.model;
    this.status = 'running';
    this.log.info(`ready (gemini api, model=${this.model})`);
  }

  async send(message: string): Promise<SessionResult> {
    if (!this.opts) throw new Error('gemini session not started');
    const started = Date.now();

    const body = {
      contents: [
        ...(this.opts.systemPrompt
          ? [{ role: 'model', parts: [{ text: this.opts.systemPrompt }] }]
          : []),
        { role: 'user', parts: [{ text: message }] },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    };

    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 1000 * 60 * 10);
      const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        return {
          text: '',
          tokens: 0,
          cost_usd: 0,
          duration_ms: Date.now() - started,
          events: [],
          error: `gemini HTTP ${res.status}: ${err.slice(0, 500)}`,
          rate_limited: res.status === 429,
          ok: false,
        };
      }

      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const inTok = json.usageMetadata?.promptTokenCount ?? Math.ceil(message.length / 4);
      const outTok = json.usageMetadata?.candidatesTokenCount ?? Math.ceil(text.length / 4);
      const costUsd = priceFor(this.model, inTok, outTok);
      this.addCost(inTok, outTok, costUsd);

      if (!text.trim()) {
        return {
          text: '',
          tokens: inTok + outTok,
          cost_usd: costUsd,
          duration_ms: Date.now() - started,
          events: [],
          error: 'gemini returned empty content',
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
        error: `gemini fetch failed: ${(err as Error).message}`,
        ok: false,
      };
    }
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
  }
}
