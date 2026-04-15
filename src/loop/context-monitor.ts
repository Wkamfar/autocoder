import { config } from '../config.js';
import { Logger } from '../utils/logger.js';
import { ClaudeCodeSession } from '../engines/claude-code.js';
import { ISession } from '../types.js';

export interface ContextState {
  sessionId: string;
  tokens: number;
  limit: number;
  pct: number;
  action: 'ok' | 'compact' | 'kill';
}

/**
 * Watch Claude Code sessions for context pressure and trigger `/compact` or
 * kill+restart when they blow past the configured thresholds.
 */
export class ContextMonitor {
  private log = new Logger('context');
  private compactions = new Map<string, number>();

  evaluate(session: ISession): ContextState {
    const limit = config.context.claudeLimit;
    const tokens = session.getCost().output_tokens + session.getCost().input_tokens;
    const pct = (tokens / limit) * 100;
    let action: ContextState['action'] = 'ok';
    if (pct >= config.context.killAtPct) action = 'kill';
    else if (pct >= config.context.compactAtPct) action = 'compact';
    return { sessionId: session.id, tokens, limit, pct, action };
  }

  async maybeCompact(session: ISession): Promise<ContextState> {
    const state = this.evaluate(session);
    if (state.action === 'ok') return state;

    if (state.action === 'compact' && session instanceof ClaudeCodeSession) {
      try {
        this.log.info(`compacting ${session.id} at ${state.pct.toFixed(1)}%`);
        await session.send('/compact');
        const prev = this.compactions.get(session.id) ?? 0;
        this.compactions.set(session.id, prev + 1);
      } catch (err) {
        this.log.warn(`compact failed for ${session.id}`, err);
      }
    }
    return state;
  }

  compactionCount(sessionId: string): number {
    return this.compactions.get(sessionId) ?? 0;
  }

  reset(sessionId: string): void {
    this.compactions.delete(sessionId);
  }

  contextHeavy(sessionId: string): boolean {
    return (this.compactions.get(sessionId) ?? 0) >= 3;
  }
}

export const contextMonitor = new ContextMonitor();
