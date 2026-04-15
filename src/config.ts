import 'dotenv/config';
import path from 'node:path';
import type { EngineName } from './types.js';

function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(v);
}

function list(key: string, fallback: string[] = []): string[] {
  const v = process.env[key];
  if (!v) return fallback;
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const defaultStateDir = path.join(process.cwd(), 'state');

function engineName(key: string, fallback: EngineName): EngineName {
  const v = str(key, fallback);
  if (v === 'claude' || v === 'codex' || v === 'cursor' || v === 'local') return v;
  return fallback;
}

export const config = {
  discord: {
    token: str('DISCORD_BOT_TOKEN'),
    channelId: str('DISCORD_CHANNEL_ID'),
    /** If set, only this user may run `!ns sales` (recommended). */
    ownerId: str('DISCORD_OWNER_ID'),
    webhookUrl: str('DISCORD_WEBHOOK_URL'),
    /** If set, `!ns sales` only works in this channel (use your sales channel id). */
    salesChannelId: str('DISCORD_SALES_CHANNEL_ID'),
    /** Require DISCORD_OWNER_ID to match for sales commands (default true). */
    salesRequireOwner: bool('DISCORD_SALES_REQUIRE_OWNER', true),
    /** Guild id for slash command registration (Sales Decision OS + future). */
    guildId: str('DISCORD_GUILD_ID'),
  },
  project: {
    dir: str('PROJECT_DIR', process.cwd()),
    mainBranch: str('PROJECT_MAIN_BRANCH', 'main'),
    branchPrefix: str('BRANCH_PREFIX', 'nightshift'),
    referenceRepos: list('REFERENCE_REPOS'),
    vpsHost: str('VPS_HOST', ''),
  },
  brain: {
    dir: str('BRAIN_DIR', path.join(process.cwd(), 'brain')),
    remote: str('BRAIN_REMOTE', ''),
    autoPush: bool('BRAIN_AUTO_PUSH', false),
  },
  engines: {
    claudeBin: str('CLAUDE_BIN', 'claude'),
    codexBin: str('CODEX_BIN', 'codex'),
    cursorBin: str('CURSOR_BIN', 'cursor-agent'),
    ollamaBin: str('OLLAMA_BIN', 'ollama'),
    claudeModel: str('CLAUDE_MODEL', 'claude-opus-4-6'),
    codexModel: str('CODEX_MODEL', 'gpt-5.4'),
    cursorModel: str('CURSOR_MODEL', 'cursor-composer-1'),
    localModel: str('LOCAL_MODEL', 'codellama:34b'),
    disableCodex: bool('DISABLE_CODEX', false),
    disableCursor: bool('DISABLE_CURSOR', false),
    disableLocal: bool('DISABLE_LOCAL', false),
    localProvider: str('LOCAL_PROVIDER', 'deepseek'),
    deepseekApiKey: str('DEEPSEEK_API_KEY', ''),
    deepseekBaseUrl: str('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
    deepseekModel: str('DEEPSEEK_MODEL', 'deepseek-chat'),
  },
  safety: {
    maxRuntimeHours: num('MAX_RUNTIME_HOURS', 8),
    maxCostUsd: num('MAX_COST_USD', 20),
    maxRetriesPerTask: num('MAX_RETRIES_PER_TASK', 3),
    maxConsecutiveEscalations: num('MAX_CONSECUTIVE_ESCALATIONS', 5),
    autoAcceptMaxLines: num('AUTO_ACCEPT_MAX_LINES', 500),
    branchMaxAgeDays: num('BRANCH_MAX_AGE_DAYS', 7),
    packageWhitelist: list('PACKAGE_WHITELIST'),
  },
  pool: {
    maxConcurrent: num('POOL_MAX_CONCURRENT', 3),
    maxClaude: num('POOL_MAX_CLAUDE', 2),
    maxCodex: num('POOL_MAX_CODEX', 2),
    maxLocal: num('POOL_MAX_LOCAL', 1),
    sessionTimeoutMs: num('POOL_SESSION_TIMEOUT_MS', 15 * 60 * 1000),
    stallMs: num('POOL_STALL_MS', 2 * 60 * 1000),
    worktreeRoot: str('POOL_WORKTREE_ROOT', '/tmp/ns-worktrees'),
    enableParallel: bool('POOL_ENABLE_PARALLEL', true),
  },
  context: {
    compactAtPct: num('CONTEXT_COMPACT_AT_PCT', 80),
    killAtPct: num('CONTEXT_KILL_AT_PCT', 90),
    claudeLimit: num('CLAUDE_CONTEXT_LIMIT', 200_000),
  },
  test: {
    testCommand: str('TEST_COMMAND'),
    lintCommand: str('LINT_COMMAND'),
  },
  runtime: {
    logLevel: str('LOG_LEVEL', 'info'),
    stateDir: str('STATE_DIR', defaultStateDir),
    tickMs: num('COORDINATOR_TICK_MS', 10_000),
  },
  /** Sales mode — canonical CRM + CRM Builder (v7). */
  sales: {
    dbPath: str('SALES_DB_PATH', path.join(str('STATE_DIR', defaultStateDir), 'sales.db')),
    staleFollowupDays: num('STALE_FOLLOWUP_DAYS', 7),
  },
  /** Pair Debate — adversarial sales deliberation (advisory-only v1; no CRM writes). */
  pairDebate: {
    maxRounds: num('PAIR_DEBATE_MAX_ROUNDS', 3),
    closerEngine: engineName('PAIR_DEBATE_CLOSER_ENGINE', 'claude'),
    buyerEngine: engineName('PAIR_DEBATE_BUYER_ENGINE', 'claude'),
    closerModel: str('PAIR_DEBATE_CLOSER_MODEL', ''),
    buyerModel: str('PAIR_DEBATE_BUYER_MODEL', ''),
    synthesisEngine: engineName('PAIR_DEBATE_SYNTHESIS_ENGINE', 'claude'),
    synthesisModel: str('PAIR_DEBATE_SYNTHESIS_MODEL', ''),
    maxPromptChars: num('PAIR_DEBATE_MAX_PROMPT_CHARS', 28_000),
    maxResponseChars: num('PAIR_DEBATE_MAX_RESPONSE_CHARS', 12_000),
    /** Minimum sample size before win_rate is treated as strong (else anecdotal). */
    patternMinSample: num('PAIR_DEBATE_PATTERN_MIN_N', 3),
  },
  /**
   * Phase 3 — decision detection + ranking (advisory; suggests when Pair Debate matters).
   * Does not run debates, mutate CRM, or send mail.
   */
  decisionEngine: {
    /** Minimum nominal deal value (USD) for the value-based trigger (0 = disable this trigger). */
    triggerMinDealValueUsd: num('DECISION_TRIGGER_MIN_DEAL_USD', 25_000),
    /** Days since last touch — stall trigger when >= this. */
    triggerStallDays: num('DECISION_TRIGGER_STALL_DAYS', 7),
    /** Stage substring matches (case-insensitive) for "high-touch" stage trigger + scoring. */
    triggerStages: list('DECISION_TRIGGER_STAGES', [
      'proposal',
      'pricing',
      'negotiat',
      'contract',
    ]),
    /** Fires `high_uncertainty` trigger when modeled uncertainty >= this (0..1). */
    triggerMinUncertainty: num('DECISION_TRIGGER_MIN_UNCERTAINTY', 0.55),
    /** Minimum objections count to label `conflicting_signals` trigger. */
    triggerConflictingObjections: num('DECISION_TRIGGER_CONFLICTING_OBJ', 2),
    /** Minimum `priority_index` (0..100) to mark `debate_recommended`. */
    minPriorityIndex: num('DECISION_MIN_PRIORITY_INDEX', 35),
    /** Minimum matched trigger rules (labels) required for `debate_recommended`. */
    debateMinTriggers: num('DECISION_DEBATE_MIN_TRIGGERS', 1),
    /** Outcomes: distinct override reasons in lookback window to fire override pattern trigger. */
    overridePatternMinCount: num('DECISION_OVERRIDE_PATTERN_MIN', 2),
    overrideLookbackDays: num('DECISION_OVERRIDE_LOOKBACK_DAYS', 90),
    /** Normalizes deal size when computing impact (USD). */
    impactReferenceDealUsd: num('DECISION_IMPACT_REFERENCE_USD', 200_000),
  },
  /**
   * Phase 8 — proactive decision moments (one active surface, optional precompute).
   */
  decisionMoments: {
    enabled: bool('DECISION_MOMENTS_ENABLED', false),
    /** Channel to post the single active moment card (defaults to DISCORD_CHANNEL_ID). */
    channelId: str('DISCORD_DECISION_CHANNEL_ID'),
    monitorIntervalMs: num('DECISION_MONITOR_INTERVAL_MS', 300_000),
    minConfidence: num('DECISION_MIN_CONFIDENCE', 0.55),
    /** Minimum priority_index (0–100) scaled gate. */
    minPriorityIndex: num('DECISION_MOMENT_MIN_PRIORITY', 45),
    expiryHours: num('DECISION_EXPIRY_HOURS', 24),
    precomputeDebate: bool('DECISION_PRECOMPUTE_DEBATE', false),
    maxIgnoreBeforeDrop: num('DECISION_MOMENT_MAX_IGNORE', 3),
  },
  /**
   * Phase 4 — SalesAction execution + policy (no default auto-send).
   * Email adapters and real sends are gated behind config + future work.
   */
  salesExecution: {
    /** When false, `auto` mode is downgraded to `assisted` in policy evaluation. */
    autoSendEnabled: bool('SALES_EXEC_AUTO_SEND_ENABLED', false),
    /** If true, recipient email domain must match `allowedEmailDomains`. */
    requireDomainAllowlist: bool('SALES_EXEC_REQUIRE_DOMAIN_ALLOWLIST', false),
    allowedEmailDomains: list('SALES_EXEC_ALLOWED_EMAIL_DOMAINS'),
    bannedPhrases: list('SALES_EXEC_BANNED_PHRASES'),
    /** Substrings that fail suppression if present in body (case-insensitive). */
    suppressionPatterns: list('SALES_EXEC_SUPPRESSION_PATTERNS'),
    maxMessageChars: num('SALES_EXEC_MAX_MESSAGE_CHARS', 50_000),
    /** Deals at or above this nominal USD always require recorded approval. */
    approvalMinDealValueUsd: num('SALES_EXEC_APPROVAL_MIN_DEAL_USD', 100_000),
    enterpriseRequiresApproval: bool('SALES_EXEC_ENTERPRISE_APPROVAL', true),
    /** Action types that always require approval (comma list). */
    actionTypesRequiringApproval: list('SALES_EXEC_APPROVAL_ACTION_TYPES'),
  },
};

export type Config = typeof config;

/**
 * Validate that required fields are set in a way that won't crash the loop at
 * runtime. Returns a list of human-readable warnings; an empty list means OK.
 * Called once at daemon startup so misconfiguration fails loudly instead of
 * silently at the first engine invocation.
 */
export function validateConfig(): string[] {
  const errors: string[] = [];
  if (!config.project.dir) {
    errors.push('PROJECT_DIR is empty');
  }
  if (!config.project.mainBranch) {
    errors.push('PROJECT_MAIN_BRANCH is empty');
  }
  if (
    config.engines.localProvider === 'deepseek' &&
    !config.engines.disableLocal &&
    !config.engines.deepseekApiKey
  ) {
    errors.push('LOCAL_PROVIDER=deepseek but DEEPSEEK_API_KEY is empty');
  }
  if (config.engines.disableCodex && config.engines.disableLocal && config.engines.disableCursor) {
    // Not fatal — claude alone works — but worth warning about.
  }
  if (config.discord.salesRequireOwner && !config.discord.ownerId) {
    errors.push(
      'DISCORD_SALES_REQUIRE_OWNER is true but DISCORD_OWNER_ID is empty — anyone who can post in the sales channel can run !ns sales. Set DISCORD_OWNER_ID or set DISCORD_SALES_REQUIRE_OWNER=0.'
    );
  }
  return errors;
}
