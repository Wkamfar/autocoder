import 'dotenv/config';
import path from 'node:path';

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

export const config = {
  discord: {
    token: str('DISCORD_BOT_TOKEN'),
    channelId: str('DISCORD_CHANNEL_ID'),
    ownerId: str('DISCORD_OWNER_ID'),
    webhookUrl: str('DISCORD_WEBHOOK_URL'),
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
    stateDir: str('STATE_DIR', path.join(process.cwd(), 'state')),
    tickMs: num('COORDINATOR_TICK_MS', 10_000),
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
  return errors;
}
