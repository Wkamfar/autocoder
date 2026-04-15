import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { run } from '../utils/exec.js';
import { brain } from '../brain/persistence.js';

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip';

export interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
  hint?: string;
}

export interface DoctorReport {
  ok: boolean;
  fatal: boolean;
  results: CheckResult[];
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function which(bin: string): Promise<string | null> {
  const r = await run('bash', ['-lc', `command -v ${bin} || true`]);
  const out = r.stdout.trim();
  return out.length > 0 ? out : null;
}

async function binVersion(bin: string, args: string[] = ['--version']): Promise<string | null> {
  try {
    const r = await run(bin, args, { timeoutMs: 5000 });
    if (r.code !== 0) return null;
    return (r.stdout || r.stderr).split('\n')[0]?.trim() || null;
  } catch {
    return null;
  }
}

async function isGitRepo(dir: string): Promise<boolean> {
  const r = await run('git', ['rev-parse', '--is-inside-work-tree'], { cwd: dir });
  return r.code === 0 && r.stdout.trim() === 'true';
}

async function branchExists(dir: string, branch: string): Promise<boolean> {
  const r = await run('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], {
    cwd: dir,
  });
  return r.code === 0;
}

async function workingTreeClean(dir: string): Promise<string | null> {
  const r = await run('git', ['status', '--porcelain'], { cwd: dir });
  if (r.code !== 0) return 'git status failed';
  return r.stdout.trim() ? r.stdout.trim() : null;
}

export async function runDoctor(): Promise<DoctorReport> {
  const results: CheckResult[] = [];

  // Auto-provision the brain on first doctor run — this clears the BRAIN_DIR
  // warn without forcing the user to manually `git init`. Side effect is
  // idempotent.
  try {
    await brain.ensureStructure();
  } catch {
    /* ignore — the check below will report it */
  }

  // --- Node ---
  const [majorRaw] = process.versions.node.split('.');
  const nodeMajor = Number(majorRaw);
  results.push({
    name: 'Node.js version',
    status: nodeMajor >= 22 ? 'pass' : 'fail',
    message: `node ${process.versions.node}`,
    hint: nodeMajor >= 22 ? undefined : 'upgrade to Node 22+',
  });

  // --- Engine binaries ---
  const claudePath = await which(config.engines.claudeBin);
  if (claudePath) {
    const v = (await binVersion(config.engines.claudeBin)) ?? 'version unknown';
    results.push({
      name: 'claude CLI',
      status: 'pass',
      message: `${claudePath} — ${v}`,
    });
  } else {
    results.push({
      name: 'claude CLI',
      status: 'fail',
      message: `\`${config.engines.claudeBin}\` not found on PATH`,
      hint: 'install Claude Code v2.1+ and make sure it is logged in: `claude`',
    });
  }

  if (config.engines.disableCodex) {
    results.push({
      name: 'codex CLI',
      status: 'skip',
      message: 'disabled via DISABLE_CODEX=true',
    });
  } else {
    const codexPath = await which(config.engines.codexBin);
    if (codexPath) {
      const v = (await binVersion(config.engines.codexBin)) ?? 'version unknown';
      results.push({
        name: 'codex CLI',
        status: 'pass',
        message: `${codexPath} — ${v}`,
      });
    } else {
      results.push({
        name: 'codex CLI',
        status: 'warn',
        message: `\`${config.engines.codexBin}\` not found`,
        hint: 'install OpenAI Codex CLI or set DISABLE_CODEX=true',
      });
    }
  }

  if (config.engines.disableCursor) {
    results.push({
      name: 'cursor CLI',
      status: 'skip',
      message: 'disabled via DISABLE_CURSOR=true',
    });
  } else {
    const cursorPath = await which(config.engines.cursorBin);
    if (cursorPath) {
      const v = (await binVersion(config.engines.cursorBin)) ?? 'version unknown';
      results.push({
        name: 'cursor CLI',
        status: 'pass',
        message: `${cursorPath} — ${v}`,
      });
    } else {
      results.push({
        name: 'cursor CLI',
        status: 'warn',
        message: `\`${config.engines.cursorBin}\` not found`,
        hint: 'install Cursor Agent CLI or set DISABLE_CURSOR=true',
      });
    }
  }

  if (config.engines.disableLocal) {
    results.push({
      name: 'ollama',
      status: 'skip',
      message: 'disabled via DISABLE_LOCAL=true',
    });
  } else {
    const ollamaPath = await which(config.engines.ollamaBin);
    results.push({
      name: 'ollama',
      status: ollamaPath ? 'pass' : 'warn',
      message: ollamaPath ? ollamaPath : 'not installed',
      hint: ollamaPath ? undefined : 'optional — only needed for free-tier local fallback',
    });
  }

  // --- Project dir ---
  const projectDir = config.project.dir;
  if (!(await exists(projectDir))) {
    results.push({
      name: 'PROJECT_DIR',
      status: 'fail',
      message: `${projectDir} does not exist`,
      hint: 'set PROJECT_DIR in .env to an existing git repo',
    });
  } else if (!(await isGitRepo(projectDir))) {
    results.push({
      name: 'PROJECT_DIR',
      status: 'fail',
      message: `${projectDir} is not a git repo`,
      hint: 'run `git init` inside PROJECT_DIR and make an initial commit',
    });
  } else {
    const mainBranch = config.project.mainBranch;
    if (!(await branchExists(projectDir, mainBranch))) {
      results.push({
        name: 'PROJECT_DIR main branch',
        status: 'fail',
        message: `branch \`${mainBranch}\` not found`,
        hint: `create it with \`git checkout -b ${mainBranch}\` or set PROJECT_MAIN_BRANCH`,
      });
    } else {
      results.push({
        name: 'PROJECT_DIR main branch',
        status: 'pass',
        message: `branch \`${mainBranch}\` exists`,
      });
    }
    const dirty = await workingTreeClean(projectDir);
    if (dirty) {
      results.push({
        name: 'PROJECT_DIR working tree',
        status: 'fail',
        message: 'uncommitted changes present',
        hint: 'commit or stash changes before starting a run',
      });
    } else {
      results.push({
        name: 'PROJECT_DIR working tree',
        status: 'pass',
        message: 'clean',
      });
    }
  }

  // --- Brain dir ---
  const brainDir = config.brain.dir;
  if (brainDir.includes('@') && brainDir.includes(':')) {
    results.push({
      name: 'BRAIN_DIR',
      status: 'fail',
      message: `BRAIN_DIR looks like an SSH URL: ${brainDir}`,
      hint:
        'NightShift reads/writes BRAIN_DIR as a local filesystem path. Set BRAIN_DIR to a ' +
        'LOCAL clone/mount and use BRAIN_REMOTE for the ssh remote URL. See README.',
    });
  } else if (!(await exists(brainDir))) {
    results.push({
      name: 'BRAIN_DIR',
      status: 'warn',
      message: `${brainDir} does not exist — will be created on first run`,
      hint: 'for cross-run memory, init a git repo here: `git init`',
    });
  } else if (!(await isGitRepo(brainDir))) {
    results.push({
      name: 'BRAIN_DIR',
      status: 'warn',
      message: `${brainDir} exists but is not a git repo`,
      hint: 'run `git init` inside BRAIN_DIR so brain sync commits work',
    });
  } else {
    results.push({
      name: 'BRAIN_DIR',
      status: 'pass',
      message: `${brainDir} ready`,
    });
  }

  // --- Brain remote (optional git remote for cross-host sync) ---
  if (config.brain.remote) {
    results.push({
      name: 'BRAIN_REMOTE',
      status: 'pass',
      message: config.brain.remote,
      hint: 'NightShift will push brain commits here if BRAIN_AUTO_PUSH=true',
    });
  }

  // --- Reference repos (read-only context sources) ---
  for (const ref of config.project.referenceRepos) {
    if (!(await exists(ref))) {
      results.push({
        name: `reference repo: ${path.basename(ref)}`,
        status: 'warn',
        message: `${ref} not found`,
        hint: 'clone the reference repo or remove it from REFERENCE_REPOS',
      });
    } else if (!(await isGitRepo(ref))) {
      results.push({
        name: `reference repo: ${path.basename(ref)}`,
        status: 'warn',
        message: `${ref} is not a git repo`,
      });
    } else {
      results.push({
        name: `reference repo: ${path.basename(ref)}`,
        status: 'pass',
        message: ref,
      });
    }
  }

  // --- VPS (openclaw host) ---
  if (config.project.vpsHost) {
    const sshOk = await run(
      'bash',
      [
        '-lc',
        `ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new ${config.project.vpsHost} 'echo ok' 2>&1 || true`,
      ],
      { timeoutMs: 8000 }
    ).catch(() => null);
    const txt = sshOk?.stdout?.trim() ?? '';
    if (txt.endsWith('ok')) {
      results.push({
        name: 'VPS SSH',
        status: 'pass',
        message: `${config.project.vpsHost} reachable`,
      });
    } else {
      results.push({
        name: 'VPS SSH',
        status: 'warn',
        message: `${config.project.vpsHost} not reachable in batch mode`,
        hint:
          'run `ssh ' +
          config.project.vpsHost +
          '` once to accept the host key and confirm key-based auth works',
      });
    }
  }

  // --- DeepSeek cloud API (OpenAI-compatible) ---
  if (config.engines.localProvider === 'deepseek' && !config.engines.disableLocal) {
    const key = config.engines.deepseekApiKey;
    const baseUrl = config.engines.deepseekBaseUrl.replace(/\/+$/, '');
    if (!key) {
      results.push({
        name: 'DeepSeek API',
        status: 'fail',
        message: 'DEEPSEEK_API_KEY is empty',
        hint: 'set DEEPSEEK_API_KEY in .env (get one at https://platform.deepseek.com)',
      });
    } else {
      const url = `${baseUrl}/v1/models`;
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 8000);
        const res = await fetch(url, {
          headers: { authorization: `Bearer ${key}` },
          signal: ctl.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const json = (await res.json()) as { data?: { id: string }[] };
          const models = (json.data ?? []).map((m) => m.id);
          const hit = models.includes(config.engines.deepseekModel);
          results.push({
            name: 'DeepSeek API',
            status: hit ? 'pass' : 'warn',
            message: `${url} OK; models: ${models.slice(0, 5).join(', ') || '(none)'}`,
            hint: hit
              ? undefined
              : `configured model \`${config.engines.deepseekModel}\` not in server list`,
          });
        } else if (res.status === 401) {
          results.push({
            name: 'DeepSeek API',
            status: 'fail',
            message: `${url} returned 401 — bad API key`,
            hint: 'check DEEPSEEK_API_KEY in .env',
          });
        } else {
          const body = await res.text().catch(() => '');
          results.push({
            name: 'DeepSeek API',
            status: 'fail',
            message: `${url} HTTP ${res.status}: ${body.slice(0, 200)}`,
          });
        }
      } catch (err) {
        results.push({
          name: 'DeepSeek API',
          status: 'fail',
          message: `${url} unreachable: ${(err as Error).message}`,
          hint: 'check your network or DEEPSEEK_BASE_URL override',
        });
      }
    }
  }

  // --- Discord ---
  if (config.discord.token) {
    results.push({
      name: 'Discord bot token',
      status: 'pass',
      message: 'set',
    });
  } else {
    results.push({
      name: 'Discord bot token',
      status: 'warn',
      message: 'DISCORD_BOT_TOKEN not set',
      hint: 'bot commands disabled — CLI mode still works',
    });
  }
  if (config.discord.channelId) {
    results.push({
      name: 'Discord channel',
      status: 'pass',
      message: config.discord.channelId,
    });
  } else {
    results.push({
      name: 'Discord channel',
      status: 'warn',
      message: 'DISCORD_CHANNEL_ID not set',
      hint: 'bot will listen in any channel but status updates will be skipped',
    });
  }
  results.push({
    name: 'Discord webhook',
    status: config.discord.webhookUrl ? 'pass' : 'skip',
    message: config.discord.webhookUrl ? 'set' : 'DISCORD_WEBHOOK_URL not set (optional)',
  });

  // --- Claude settings (auto-accept) ---
  const settingsFile = path.join(process.cwd(), '.claude', 'settings.json');
  results.push({
    name: '.claude/settings.json',
    status: (await exists(settingsFile)) ? 'pass' : 'warn',
    message: (await exists(settingsFile))
      ? 'auto-accept profile present'
      : 'missing — Claude Code may prompt for permissions',
  });

  // --- State dir ---
  results.push({
    name: 'STATE_DIR',
    status: 'pass',
    message: config.runtime.stateDir,
  });

  const fatal = results.some((r) => r.status === 'fail');
  const ok = !fatal;
  return { ok, fatal, results };
}

export function formatDoctorReport(report: DoctorReport): string {
  const icon = (s: CheckStatus): string => {
    switch (s) {
      case 'pass':
        return 'PASS';
      case 'warn':
        return 'WARN';
      case 'fail':
        return 'FAIL';
      case 'skip':
        return 'SKIP';
    }
  };
  const lines: string[] = [];
  lines.push('NightShift pre-flight check');
  lines.push('='.repeat(60));
  for (const r of report.results) {
    lines.push(`[${icon(r.status)}] ${r.name}`);
    lines.push(`       ${r.message}`);
    if (r.hint) lines.push(`       → ${r.hint}`);
  }
  lines.push('='.repeat(60));
  const counts = report.results.reduce<Record<CheckStatus, number>>(
    (acc, r) => {
      acc[r.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0, skip: 0 }
  );
  lines.push(
    `pass: ${counts.pass}  warn: ${counts.warn}  fail: ${counts.fail}  skip: ${counts.skip}`
  );
  lines.push(
    report.fatal
      ? 'NOT READY — fix the FAIL items above before starting a run.'
      : 'READY — you can start a run with `!ns start <objective>`.'
  );
  return lines.join('\n');
}
