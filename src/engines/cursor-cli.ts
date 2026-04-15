import { BaseSession, priceFor } from './base.js';
import { SessionOpts, SessionResult } from '../types.js';
import { config } from '../config.js';
import { run } from '../utils/exec.js';

/**
 * Cursor Agent CLI session. Uses `cursor-agent` in non-interactive exec mode,
 * analogous to the Codex session: a single `send()` call spawns the binary,
 * streams the message in, captures stdout, and parses the result.
 *
 * Disabled by default (DISABLE_CURSOR=true). To enable:
 *   1. install Cursor Agent CLI on PATH (or set CURSOR_BIN)
 *   2. set DISABLE_CURSOR=false in .env
 *   3. optionally set CURSOR_MODEL
 */
export class CursorCliSession extends BaseSession {
  private model = config.engines.cursorModel;

  constructor(id: string) {
    super(id, 'cursor');
  }

  async start(opts: SessionOpts): Promise<void> {
    this.opts = opts;
    this.model = opts.model || this.model;
    this.status = 'running';
    this.log.info(`ready (cursor exec mode, model=${this.model})`);
  }

  async send(message: string): Promise<SessionResult> {
    if (!this.opts) throw new Error('cursor session not started');
    const started = Date.now();

    const args = [
      '--print',
      '--model',
      this.model,
      '--yes',
      message,
    ];
    if (this.opts.systemPrompt) {
      args.splice(0, 0, '--system', this.opts.systemPrompt);
    }

    this.log.info(`cursor exec (${message.length} chars)`);
    const r = await run(config.engines.cursorBin, args, {
      cwd: this.opts.projectDir,
      timeoutMs: 1000 * 60 * 30,
    });

    const text = r.stdout;
    const approxIn = Math.ceil(message.length / 4);
    const approxOut = Math.ceil(text.length / 4);
    const cost = priceFor(this.model, approxIn, approxOut);
    this.addCost(approxIn, approxOut, cost);

    const error =
      r.code !== 0
        ? r.stderr || `cursor exited ${r.code}`
        : !text.trim()
          ? 'cursor returned empty output'
          : undefined;

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
