import { BaseSession, priceFor } from './base.js';
import { SessionOpts, SessionResult } from '../types.js';
import { config } from '../config.js';
import { run } from '../utils/exec.js';

export class CodexSession extends BaseSession {
  private model = config.engines.codexModel;

  constructor(id: string) {
    super(id, 'codex');
  }

  async start(opts: SessionOpts): Promise<void> {
    this.opts = opts;
    this.model = opts.model || this.model;
    this.status = 'running';
    this.log.info(`ready (codex exec mode, model=${this.model})`);
  }

  async send(message: string): Promise<SessionResult> {
    if (!this.opts) throw new Error('codex session not started');
    const started = Date.now();

    const args = [
      'exec',
      '--full-auto',
      '--yolo',
      '--cd',
      this.opts.projectDir,
      '--model',
      this.model,
      message,
    ];

    this.log.info(`codex exec (${message.length} chars)`);
    const r = await run(config.engines.codexBin, args, {
      cwd: this.opts.projectDir,
      timeoutMs: 1000 * 60 * 30,
    });

    const text = r.stdout;
    // Codex CLI doesn't emit a structured usage line by default — estimate via length.
    const approxIn = Math.ceil(message.length / 4);
    const approxOut = Math.ceil(text.length / 4);
    const cost = priceFor(this.model, approxIn, approxOut);
    this.addCost(approxIn, approxOut, cost);

    const error =
      r.code !== 0
        ? r.stderr || `codex exited ${r.code}`
        : !text.trim()
          ? 'codex returned empty output'
          : undefined;
    if (error && r.stderr) {
      this.log.warn(`codex stderr: ${r.stderr.slice(0, 500)}`);
    }
    return {
      text,
      tokens: approxIn + approxOut,
      cost_usd: cost,
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
