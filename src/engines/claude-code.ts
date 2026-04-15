import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { BaseSession, priceFor } from './base.js';
import { SessionOpts, SessionResult } from '../types.js';
import { config } from '../config.js';

interface StreamEvent {
  type?: string;
  subtype?: string;
  message?: {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  result?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: string;
  session_id?: string;
}

export class ClaudeCodeSession extends BaseSession {
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = '';
  private pending: {
    resolve: (r: SessionResult) => void;
    reject: (err: Error) => void;
    started: number;
    events: StreamEvent[];
    tokens: number;
    cost: number;
    text: string;
  } | null = null;
  private model = config.engines.claudeModel;
  private sessionId: string | null = null;

  constructor(id: string) {
    super(id, 'claude');
  }

  async start(opts: SessionOpts): Promise<void> {
    this.opts = opts;
    this.model = opts.model || this.model;
    this.status = 'starting';

    const args = [
      '-p',
      '',
      '--output-format',
      'stream-json',
      '--input-format',
      'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
      '--model',
      this.model,
      '--max-turns',
      String(opts.maxTurns ?? 25),
    ];
    if (opts.allowedTools?.length) {
      args.push('--allowedTools', opts.allowedTools.join(','));
    }
    if (opts.systemPrompt) {
      args.push('--append-system-prompt', opts.systemPrompt);
    }

    this.log.info(`spawning ${config.engines.claudeBin} with model=${this.model}`);
    this.child = spawn(config.engines.claudeBin, args, {
      cwd: opts.projectDir,
      env: { ...process.env, ...(opts.env || {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.child.stdout.on('data', (d) => this.onStdout(d.toString()));
    this.child.stderr.on('data', (d) => {
      const msg = d.toString().trim();
      if (!msg) return;
      // Promote anything that looks like an error so it shows up at LOG_LEVEL=info.
      if (/error|fatal|failed|permission denied|panic|traceback/i.test(msg)) {
        this.log.warn(`claude stderr: ${msg.slice(0, 500)}`);
      } else {
        this.log.debug(`stderr: ${msg}`);
      }
    });
    this.child.on('exit', (code) => {
      this.log.info(`exited with code=${code}`);
      this.status = code === 0 ? 'stopped' : 'errored';
      if (this.pending) {
        this.pending.reject(new Error(`claude code exited unexpectedly (${code})`));
        this.pending = null;
      }
    });
    this.child.on('error', (err) => {
      this.log.error('spawn error', err);
      this.status = 'errored';
    });

    this.status = 'running';
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk;
    let newlineIdx: number;
    // eslint-disable-next-line no-cond-assign
    while ((newlineIdx = this.buffer.indexOf('\n')) >= 0) {
      const raw = this.buffer.slice(0, newlineIdx).trim();
      this.buffer = this.buffer.slice(newlineIdx + 1);
      if (!raw) continue;
      let ev: StreamEvent;
      try {
        ev = JSON.parse(raw) as StreamEvent;
      } catch {
        this.log.debug(`non-json line: ${raw.slice(0, 120)}`);
        continue;
      }
      this.handleEvent(ev);
    }
  }

  private handleEvent(ev: StreamEvent): void {
    if (!this.pending) return;
    this.pending.events.push(ev);

    if (ev.session_id && !this.sessionId) this.sessionId = ev.session_id;

    if (ev.type === 'assistant' && ev.message?.content) {
      for (const c of ev.message.content) {
        if (c.type === 'text' && c.text) this.pending.text += c.text;
      }
      const u = ev.message.usage;
      if (u) {
        const inTok = u.input_tokens ?? 0;
        const outTok = u.output_tokens ?? 0;
        this.pending.tokens += inTok + outTok;
        this.pending.cost += priceFor(this.model, inTok, outTok);
      }
    }

    if (ev.type === 'result') {
      const u = ev.usage;
      if (u) {
        const inTok = u.input_tokens ?? 0;
        const outTok = u.output_tokens ?? 0;
        this.pending.tokens += inTok + outTok;
        this.pending.cost += priceFor(this.model, inTok, outTok);
      }
      if (ev.result && !this.pending.text) this.pending.text = ev.result;
      const ok = ev.subtype !== 'error';
      const result: SessionResult = {
        text: this.pending.text,
        tokens: this.pending.tokens,
        cost_usd: this.pending.cost,
        duration_ms: Date.now() - this.pending.started,
        events: this.pending.events,
        error: ok ? undefined : ev.error || 'claude error',
        ok,
      };
      this.addCost(0, this.pending.tokens, this.pending.cost);
      const resolve = this.pending.resolve;
      this.pending = null;
      resolve(result);
    }
  }

  async send(message: string): Promise<SessionResult> {
    if (!this.child || this.status !== 'running') {
      throw new Error(`claude session ${this.id} is not running`);
    }
    if (this.pending) {
      throw new Error('claude session is already awaiting a response');
    }
    return new Promise<SessionResult>((resolve, reject) => {
      this.pending = {
        resolve,
        reject,
        started: Date.now(),
        events: [],
        tokens: 0,
        cost: 0,
        text: '',
      };
      const payload =
        JSON.stringify({
          type: 'user',
          message: {
            role: 'user',
            content: [{ type: 'text', text: message }],
          },
        }) + '\n';
      try {
        this.child!.stdin.write(payload);
      } catch (err) {
        this.pending = null;
        reject(err as Error);
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    try {
      this.child.stdin.end();
      this.child.kill('SIGTERM');
    } catch (err) {
      this.log.warn('stop error', err);
    }
    this.status = 'stopped';
  }
}
