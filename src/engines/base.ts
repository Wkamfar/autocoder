import {
  CostInfo,
  EngineName,
  ISession,
  SessionOpts,
  SessionResult,
  SessionStatus,
} from '../types.js';
import { Logger } from '../utils/logger.js';

export abstract class BaseSession implements ISession {
  readonly id: string;
  readonly engine: EngineName;
  protected status: SessionStatus = 'idle';
  protected cost: CostInfo = { input_tokens: 0, output_tokens: 0, cost_usd: 0 };
  protected opts: SessionOpts | null = null;
  protected log: Logger;

  constructor(id: string, engine: EngineName) {
    this.id = id;
    this.engine = engine;
    this.log = new Logger(`engine:${engine}:${id}`);
  }

  abstract start(opts: SessionOpts): Promise<void>;
  abstract send(message: string): Promise<SessionResult>;
  abstract stop(): Promise<void>;

  getStatus(): SessionStatus {
    return this.status;
  }
  getCost(): CostInfo {
    return { ...this.cost };
  }

  protected addCost(input: number, output: number, usd: number): void {
    this.cost.input_tokens += input;
    this.cost.output_tokens += output;
    this.cost.cost_usd += usd;
  }
}

// Simple per-token pricing table; values are USD per 1K tokens.
// These are intentionally conservative placeholders — override via env if needed.
export const PRICING: Record<string, { in: number; out: number }> = {
  'claude-opus-4-6': { in: 0.015, out: 0.075 },
  'claude-sonnet-4-6': { in: 0.003, out: 0.015 },
  'claude-haiku-4-5': { in: 0.00025, out: 0.00125 },
  'gpt-5.4': { in: 0.005, out: 0.015 },
  'gpt-5.3-codex': { in: 0.003, out: 0.012 },
  'cursor-composer-1': { in: 0.004, out: 0.012 },
  // DeepSeek API (cache-miss) — published prices as of 2026-04.
  'deepseek-chat': { in: 0.00027, out: 0.0011 },
  'deepseek-reasoner': { in: 0.00055, out: 0.00219 },
  'codellama:34b': { in: 0, out: 0 },
  'gemini-2.5-flash': { in: 0.00015, out: 0.0006 },
  'gemini-2.5-pro': { in: 0.00125, out: 0.005 },
  default: { in: 0.005, out: 0.015 },
};

export function priceFor(model: string, inTok: number, outTok: number): number {
  const p = PRICING[model] ?? PRICING.default;
  return (inTok / 1000) * p.in + (outTok / 1000) * p.out;
}
