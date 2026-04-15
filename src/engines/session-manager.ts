import { randomUUID } from 'node:crypto';
import { EngineName, ISession, SessionOpts } from '../types.js';
import { ClaudeCodeSession } from './claude-code.js';
import { CodexSession } from './codex.js';
import { CursorCliSession } from './cursor-cli.js';
import { LocalSession } from './local.js';
import { RemoteLocalSession } from './remote-local.js';
import { config } from '../config.js';
import { Logger } from '../utils/logger.js';

interface InboxMessage {
  from: string;
  to: string;
  content: string;
  at: string;
}

export class SessionManager {
  private sessions = new Map<string, ISession>();
  private inboxes = new Map<string, InboxMessage[]>();
  private log = new Logger('sessions');

  list(): { id: string; engine: EngineName; status: string }[] {
    return [...this.sessions.values()].map((s) => ({
      id: s.id,
      engine: s.engine,
      status: s.getStatus(),
    }));
  }

  get(id: string): ISession | undefined {
    return this.sessions.get(id);
  }

  async create(engine: EngineName, opts: SessionOpts, id?: string): Promise<ISession> {
    const sid = id ?? `${engine}-${randomUUID().slice(0, 8)}`;
    let session: ISession;
    switch (engine) {
      case 'claude':
        session = new ClaudeCodeSession(sid);
        break;
      case 'codex':
        if (config.engines.disableCodex) {
          throw new Error('codex engine is disabled (DISABLE_CODEX=true)');
        }
        session = new CodexSession(sid);
        break;
      case 'cursor':
        if (config.engines.disableCursor) {
          throw new Error('cursor engine is disabled (DISABLE_CURSOR=true)');
        }
        session = new CursorCliSession(sid);
        break;
      case 'local':
        if (config.engines.disableLocal) {
          throw new Error('local engine is disabled (DISABLE_LOCAL=true)');
        }
        session =
          config.engines.localProvider === 'deepseek'
            ? new RemoteLocalSession(sid)
            : new LocalSession(sid);
        break;
    }
    await session.start(opts);
    this.sessions.set(sid, session);
    this.log.info(`created session ${sid} (${engine})`);
    return session;
  }

  async destroy(id: string): Promise<void> {
    const s = this.sessions.get(id);
    if (!s) return;
    try {
      await Promise.race([
        s.stop(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error(`stop ${id} timeout`)), 5000)
        ),
      ]);
    } catch (err) {
      this.log.warn(`stop ${id} failed or timed out, forcing`, err);
      // Best-effort SIGKILL of any underlying child process.
      const child = (s as unknown as { child?: { kill?: (sig: string) => void } }).child;
      try {
        child?.kill?.('SIGKILL');
      } catch {
        /* ignore */
      }
    }
    this.sessions.delete(id);
    this.log.info(`destroyed session ${id}`);
  }

  async destroyAll(): Promise<void> {
    const ids = [...this.sessions.keys()];
    await Promise.all(
      ids.map((id) =>
        this.destroy(id).catch((err) => this.log.warn(`cleanup ${id} failed`, err))
      )
    );
  }

  sendTo(from: string, to: string, content: string): void {
    const list = this.inboxes.get(to) || [];
    list.push({ from, to, content, at: new Date().toISOString() });
    this.inboxes.set(to, list);
  }

  inbox(id: string): InboxMessage[] {
    return this.inboxes.get(id) || [];
  }

  deliverInbox(id: string): InboxMessage[] {
    const msgs = this.inbox(id);
    this.inboxes.delete(id);
    return msgs;
  }

  totalCostUsd(): number {
    let t = 0;
    for (const s of this.sessions.values()) t += s.getCost().cost_usd;
    return t;
  }
}

export const sessionManager = new SessionManager();
