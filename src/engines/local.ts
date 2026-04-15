import { BaseSession } from './base.js';
import { SessionOpts, SessionResult } from '../types.js';
import { config } from '../config.js';
import { run } from '../utils/exec.js';

export class LocalSession extends BaseSession {
  private model = config.engines.localModel;

  constructor(id: string) {
    super(id, 'local');
  }

  async start(opts: SessionOpts): Promise<void> {
    this.opts = opts;
    this.model = opts.model || this.model;
    this.status = 'running';
    this.log.info(`ready (ollama, model=${this.model})`);
  }

  async send(message: string): Promise<SessionResult> {
    if (!this.opts) throw new Error('local session not started');
    const started = Date.now();
    const r = await run(config.engines.ollamaBin, ['run', this.model], {
      cwd: this.opts.projectDir,
      input: message,
      timeoutMs: 1000 * 60 * 15,
    });

    const text = r.stdout;
    const error =
      r.code !== 0
        ? r.stderr || `ollama exited ${r.code}`
        : !text.trim()
          ? 'ollama returned empty output'
          : undefined;
    return {
      text,
      tokens: Math.ceil((message.length + text.length) / 4),
      cost_usd: 0,
      duration_ms: Date.now() - started,
      events: [],
      error,
      ok: !error,
    };
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
  }
}
