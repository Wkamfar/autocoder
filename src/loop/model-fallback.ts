import { EngineName, ModelTier, SessionResult, Task } from '../types.js';
import { config } from '../config.js';
import { Logger } from '../utils/logger.js';

const FULL_FALLBACK_CHAIN: ModelTier[] = [
  { engine: 'claude', model: 'claude-opus-4-6', label: 'Claude Opus 4.6', costTier: 'premium' },
  { engine: 'codex', model: 'gpt-5.4', label: 'GPT-5.4', costTier: 'premium' },
  { engine: 'cursor', model: 'cursor-composer-1', label: 'Cursor Composer', costTier: 'premium' },
  { engine: 'claude', model: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', costTier: 'standard' },
  { engine: 'codex', model: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', costTier: 'standard' },
  { engine: 'local', model: 'deepseek-chat', label: 'DeepSeek V3 (API)', costTier: 'standard' },
  { engine: 'local', model: 'deepseek-reasoner', label: 'DeepSeek R1 (API)', costTier: 'standard' },
  { engine: 'gemini', model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (backup)', costTier: 'standard' },
];

function activeChain(): ModelTier[] {
  return FULL_FALLBACK_CHAIN.filter((t) => {
    if (t.engine === 'codex' && config.engines.disableCodex) return false;
    if (t.engine === 'cursor' && config.engines.disableCursor) return false;
    if (t.engine === 'local' && config.engines.disableLocal) return false;
    if (t.engine === 'gemini' && config.engines.disableGemini) return false;
    return true;
  });
}

// Only matched against result.error, NOT result.text — the agent's task output
// legitimately contains words like "capacity", "throttled", and "overloaded"
// without being rate-limited.
const RATE_LIMIT_PATTERN =
  /\b(rate[-_\s]?limit|too\s+many\s+requests|http\s*429|status\s*429|quota\s+exceeded|insufficient[-_\s]?quota|throttled|overloaded|try\s+again\s+later|capacity\s+exceeded)\b/i;

interface FailureRecord {
  count: number;
  cooldownUntil: number;
  lastError: string;
}

export class ModelFallback {
  private log = new Logger('fallback');
  private failures = new Map<string, FailureRecord>();

  tiers(): readonly ModelTier[] {
    return activeChain();
  }

  getAvailable(preferredEngine?: EngineName): ModelTier {
    const chain = activeChain();
    if (chain.length === 0) {
      throw new Error('no engines enabled — all have been disabled via env flags.');
    }
    // Honor disable flags: if preferred engine is disabled, ignore the preference.
    const effectivePreferred =
      preferredEngine &&
      ((preferredEngine === 'codex' && config.engines.disableCodex) ||
        (preferredEngine === 'local' && config.engines.disableLocal) ||
        (preferredEngine === 'gemini' && config.engines.disableGemini))
        ? undefined
        : preferredEngine;

    if (effectivePreferred) {
      for (const tier of chain) {
        if (tier.engine !== effectivePreferred) continue;
        if (this.isAvailable(tier)) return tier;
      }
    }
    for (const tier of chain) {
      if (this.isAvailable(tier)) return tier;
    }
    throw new Error(
      'all models unavailable (rate limits / cooldowns active). entering sleep mode.'
    );
  }

  isAvailable(tier: ModelTier): boolean {
    const key = this.key(tier);
    const f = this.failures.get(key);
    if (!f) return true;
    if (Date.now() > f.cooldownUntil) {
      this.failures.delete(key);
      return true;
    }
    return false;
  }

  recordFailure(tier: ModelTier, error: string): number {
    const key = this.key(tier);
    const existing = this.failures.get(key) || {
      count: 0,
      cooldownUntil: 0,
      lastError: '',
    };
    existing.count += 1;
    existing.lastError = error.slice(0, 500);
    const backoffMs = Math.min(30_000 * 2 ** (existing.count - 1), 600_000);
    existing.cooldownUntil = Date.now() + backoffMs;
    this.failures.set(key, existing);
    this.log.warn(
      `${tier.label} failed (${existing.count}x) — cooldown ${Math.round(backoffMs / 1000)}s`
    );
    return backoffMs;
  }

  clear(tier: ModelTier): void {
    this.failures.delete(this.key(tier));
  }

  handleRateLimit(current: ModelTier, _task: Task): ModelTier {
    this.recordFailure(current, 'rate_limited');
    return this.getAvailable();
  }

  detectRateLimit(result: SessionResult): boolean {
    if (result.rate_limited) return true;
    // Only look at the error field. Matching against result.text is a
    // false-positive trap: agent output often contains words like "capacity".
    if (!result.error) return false;
    return RATE_LIMIT_PATTERN.test(result.error);
  }

  snapshot(): Array<{ tier: string; count: number; cooldownMs: number; error: string }> {
    const now = Date.now();
    return [...this.failures.entries()].map(([tier, f]) => ({
      tier,
      count: f.count,
      cooldownMs: Math.max(0, f.cooldownUntil - now),
      error: f.lastError,
    }));
  }

  /** Pick a tier matching a DecisionEngine preference, respecting cooldowns. */
  resolve(preferredEngine: EngineName): ModelTier {
    try {
      return this.getAvailable(preferredEngine);
    } catch (err) {
      this.log.error('fallback exhausted', err);
      throw err;
    }
  }

  private key(tier: ModelTier): string {
    return `${tier.engine}:${tier.model}`;
  }

  /** Apply default models from config to the top-tier entries. */
  static defaultTiers(): ModelTier[] {
    const tiers: ModelTier[] = [
      {
        engine: 'claude',
        model: config.engines.claudeModel,
        label: `Claude ${config.engines.claudeModel}`,
        costTier: 'premium',
      },
    ];
    if (!config.engines.disableCodex) {
      tiers.push({
        engine: 'codex',
        model: config.engines.codexModel,
        label: `Codex ${config.engines.codexModel}`,
        costTier: 'premium',
      });
    }
    if (!config.engines.disableCursor) {
      tiers.push({
        engine: 'cursor',
        model: config.engines.cursorModel,
        label: `Cursor ${config.engines.cursorModel}`,
        costTier: 'premium',
      });
    }
    if (!config.engines.disableLocal) {
      tiers.push({
        engine: 'local',
        model: config.engines.localModel,
        label: `Local ${config.engines.localModel}`,
        costTier: 'free',
      });
    }
    if (!config.engines.disableGemini && config.engines.geminiApiKey) {
      tiers.push({
        engine: 'gemini',
        model: config.engines.geminiModel,
        label: `Gemini ${config.engines.geminiModel}`,
        costTier: 'standard',
      });
    }
    return tiers;
  }
}

export const modelFallback = new ModelFallback();
