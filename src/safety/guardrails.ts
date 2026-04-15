import path from 'node:path';
import { config } from '../config.js';
import { Task, RunState } from '../types.js';

const FORBIDDEN_FILE_PATTERNS = [
  /(^|\/)\.env(\.|$)/,
  /(^|\/)secrets?\.(json|yaml|yml|toml)$/,
  /credentials?\.json$/,
  /id_rsa(\.pub)?$/,
];

// Root-level files that are always in scope even though they live outside
// the configured ALLOWED_DIRS. Doc/config files at repo root would otherwise
// trip checkScope() and get reverted.
const ALLOWED_ROOT_FILES = new Set([
  'README.md',
  'CONTRIBUTING.md',
  'CLAUDE.md',
  'AGENTS.md',
  'LICENSE',
  'LICENSE.md',
  'CHANGELOG.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
  '.gitignore',
  '.editorconfig',
  '.prettierrc',
  '.prettierrc.json',
  '.eslintrc',
  '.eslintrc.json',
]);

const READ_ONLY_PATTERNS = [
  /(^|\/)package\.json$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)requirements(-[a-z]+)?\.txt$/,
  /(^|\/)poetry\.lock$/,
  /(^|\/)Gemfile\.lock$/,
];

const DESTRUCTIVE_COMMAND_SUBSTRINGS = [
  'rm -rf /',
  'rm -rf ~',
  'rm -rf *',
  'DROP TABLE',
  'DROP DATABASE',
  'docker rm -f',
  'mkfs',
  ':(){ :|:& };:',
  'dd if=/dev/zero',
];

export interface GuardrailViolation {
  kind:
    | 'forbidden_file'
    | 'readonly_file'
    | 'destructive_command'
    | 'scope_violation'
    | 'diff_too_large'
    | 'runtime_exceeded'
    | 'cost_exceeded'
    | 'retry_exhausted'
    | 'escalation_streak';
  detail: string;
}

export function checkFiles(changed: string[]): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];
  for (const raw of changed) {
    const rel = raw.trim();
    if (!rel) continue;
    for (const pat of FORBIDDEN_FILE_PATTERNS) {
      if (pat.test(rel)) {
        violations.push({ kind: 'forbidden_file', detail: rel });
      }
    }
    for (const pat of READ_ONLY_PATTERNS) {
      if (pat.test(rel)) {
        violations.push({ kind: 'readonly_file', detail: rel });
      }
    }
  }
  return violations;
}

export function checkScope(changed: string[], allowedDirs: string[]): GuardrailViolation[] {
  if (allowedDirs.length === 0) return [];
  const violations: GuardrailViolation[] = [];
  for (const rel of changed) {
    const normalized = rel.replace(/\\/g, '/');
    if (ALLOWED_ROOT_FILES.has(normalized)) continue;
    const inside = allowedDirs.some((dir) => {
      const d = dir.replace(/\\/g, '/').replace(/\/$/, '');
      return normalized === d || normalized.startsWith(d + '/');
    });
    if (!inside) violations.push({ kind: 'scope_violation', detail: rel });
  }
  return violations;
}

export function checkCommand(cmd: string): GuardrailViolation | null {
  const lowered = cmd.toLowerCase();
  for (const bad of DESTRUCTIVE_COMMAND_SUBSTRINGS) {
    if (lowered.includes(bad.toLowerCase())) {
      return { kind: 'destructive_command', detail: bad };
    }
  }
  return null;
}

export function checkDiffSize(insertions: number, deletions: number): GuardrailViolation | null {
  const total = insertions + deletions;
  if (total > config.safety.autoAcceptMaxLines) {
    return { kind: 'diff_too_large', detail: `${total} > ${config.safety.autoAcceptMaxLines}` };
  }
  return null;
}

export function checkRunLimits(state: RunState, startedAt: number): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];
  const elapsedHours = (Date.now() - startedAt) / 36e5;
  if (elapsedHours >= config.safety.maxRuntimeHours) {
    violations.push({ kind: 'runtime_exceeded', detail: `${elapsedHours.toFixed(2)}h` });
  }
  if (state.total_cost_usd >= config.safety.maxCostUsd) {
    violations.push({ kind: 'cost_exceeded', detail: `$${state.total_cost_usd.toFixed(2)}` });
  }
  if (state.consecutive_escalations >= config.safety.maxConsecutiveEscalations) {
    violations.push({
      kind: 'escalation_streak',
      detail: `${state.consecutive_escalations} consecutive`,
    });
  }
  return violations;
}

export function shouldRetry(task: Task): boolean {
  return task.retry_count < config.safety.maxRetriesPerTask;
}

export function normalizeAllowedDirs(dirs: string[]): string[] {
  return dirs.map((d) => path.posix.normalize(d.replace(/\\/g, '/')));
}
