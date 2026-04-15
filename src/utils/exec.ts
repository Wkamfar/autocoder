import { spawn, SpawnOptions } from 'node:child_process';

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
}

export interface ExecOpts {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  input?: string;
}

export async function run(
  cmd: string,
  args: string[],
  opts: ExecOpts = {}
): Promise<ExecResult> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const spawnOpts: SpawnOptions = {
      cwd: opts.cwd,
      env: { ...process.env, ...(opts.env || {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    };
    const child = spawn(cmd, args, spawnOpts);
    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = opts.timeoutMs
      ? setTimeout(() => {
          killed = true;
          child.kill('SIGKILL');
        }, opts.timeoutMs)
      : null;

    child.stdout?.on('data', (d) => (stdout += d.toString()));
    child.stderr?.on('data', (d) => (stderr += d.toString()));

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        code: killed ? 124 : code ?? 0,
        stdout,
        stderr,
        duration_ms: Date.now() - started,
      });
    });

    if (opts.input && child.stdin) {
      child.stdin.write(opts.input);
      child.stdin.end();
    }
  });
}

export async function runOrThrow(
  cmd: string,
  args: string[],
  opts: ExecOpts = {}
): Promise<string> {
  const r = await run(cmd, args, opts);
  if (r.code !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (${r.code}): ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

export function git(cwd: string) {
  return {
    async status(): Promise<string> {
      return runOrThrow('git', ['status', '--porcelain'], { cwd });
    },
    async currentBranch(): Promise<string> {
      return (await runOrThrow('git', ['branch', '--show-current'], { cwd })).trim();
    },
    async checkoutNew(branch: string, from: string): Promise<void> {
      await runOrThrow('git', ['checkout', '-B', branch, from], { cwd });
    },
    async checkout(branch: string): Promise<void> {
      await runOrThrow('git', ['checkout', branch], { cwd });
    },
    async add(paths: string[] = ['-A']): Promise<void> {
      await runOrThrow('git', ['add', ...paths], { cwd });
    },
    async commit(msg: string): Promise<string> {
      await runOrThrow('git', ['commit', '-m', msg], { cwd });
      return (await runOrThrow('git', ['rev-parse', 'HEAD'], { cwd })).trim();
    },
    async revert(sha: string): Promise<void> {
      await runOrThrow('git', ['reset', '--hard', sha], { cwd });
    },
    async headSha(): Promise<string> {
      return (await runOrThrow('git', ['rev-parse', 'HEAD'], { cwd })).trim();
    },
    async diffStat(base: string, target: string): Promise<string> {
      return runOrThrow('git', ['diff', `${base}...${target}`, '--stat'], { cwd });
    },
    async diffNames(base: string, target: string): Promise<string[]> {
      const out = await runOrThrow('git', ['diff', `${base}...${target}`, '--name-only'], { cwd });
      return out.split('\n').filter(Boolean);
    },
    async shortstat(base: string, target: string): Promise<string> {
      return runOrThrow('git', ['diff', `${base}...${target}`, '--shortstat'], { cwd });
    },
    async log(branch: string, limit = 50): Promise<{ sha: string; message: string }[]> {
      const out = await runOrThrow(
        'git',
        ['log', `-${limit}`, '--pretty=format:%H%x09%s', branch],
        { cwd }
      );
      return out
        .split('\n')
        .filter(Boolean)
        .map((l) => {
          const [sha, ...rest] = l.split('\t');
          return { sha, message: rest.join('\t') };
        });
    },
    async push(branch: string): Promise<void> {
      await runOrThrow('git', ['push', '-u', 'origin', branch], { cwd });
    },
    async merge(branch: string): Promise<void> {
      await runOrThrow('git', ['merge', '--no-ff', branch], { cwd });
    },
  };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}
