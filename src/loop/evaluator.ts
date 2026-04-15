import { BranchManager } from '../branch/manager.js';
import { Task, TaskResult, TaskStatus } from '../types.js';
import { checkDiffSize, checkFiles, checkScope } from '../safety/guardrails.js';
import { Logger } from '../utils/logger.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { run, git } from '../utils/exec.js';

const ALLOWED_DIRS = ['src', 'tests', 'test', 'docs', 'scripts', 'examples'];

const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.rst', '.txt', '.adoc']);

function isDocFile(rel: string): boolean {
  const normalized = rel.replace(/\\/g, '/').toLowerCase();
  const dot = normalized.lastIndexOf('.');
  if (dot === -1) return false;
  return DOC_EXTENSIONS.has(normalized.slice(dot));
}

export class Evaluator {
  private log = new Logger('evaluator');

  constructor(private branches: BranchManager) {}

  async evaluate(
    task: Task,
    branch: string,
    precommitSha: string,
    dispatchedFiles: string[]
  ): Promise<{ status: TaskStatus; error?: string; filesChanged: string[]; commitSha: string }> {
    const g = git(config.project.dir);
    const changed = await g.diffNames(precommitSha, 'HEAD');
    const files = changed.length ? changed : dispatchedFiles;

    const forbidden = checkFiles(files);
    if (forbidden.length) {
      await this.branches.revertTo(precommitSha);
      return {
        status: 'failed',
        error: `guardrail violation: ${forbidden.map((v) => `${v.kind}:${v.detail}`).join(', ')}`,
        filesChanged: files,
        commitSha: precommitSha,
      };
    }

    const scope = checkScope(files, ALLOWED_DIRS);
    if (scope.length) {
      await this.branches.revertTo(precommitSha);
      return {
        status: 'failed',
        error: `scope violation: ${scope.map((v) => v.detail).join(', ')}`,
        filesChanged: files,
        commitSha: precommitSha,
      };
    }

    // Run tests + lint — but skip them when the diff is doc-only. A README or
    // CHANGELOG edit shouldn't have to wait 20min for CI and can't break tests.
    const docOnly = files.length > 0 && files.every(isDocFile);
    if (docOnly) {
      this.log.info(`doc-only diff (${files.length} file(s)) — skipping test/lint`);
    }
    const testOk = docOnly
      ? { ok: true, output: '(skipped — doc-only diff)' }
      : await this.runDetected('test');
    const lintOk = docOnly
      ? { ok: true, output: '(skipped — doc-only diff)' }
      : await this.runDetected('lint');

    if (!testOk.ok) {
      await this.branches.revertTo(precommitSha);
      return {
        status: 'failed',
        error: `tests failed:\n${testOk.output.slice(0, 2000)}`,
        filesChanged: files,
        commitSha: precommitSha,
      };
    }

    if (!lintOk.ok) {
      await this.branches.revertTo(precommitSha);
      return {
        status: 'failed',
        error: `lint failed:\n${lintOk.output.slice(0, 2000)}`,
        filesChanged: files,
        commitSha: precommitSha,
      };
    }

    // Check diff size for auto-accept.
    const shortstat = await g.shortstat('HEAD~0', 'HEAD');
    const ins = Number(/(\d+) insertions?/.exec(shortstat)?.[1] ?? '0');
    const del = Number(/(\d+) deletions?/.exec(shortstat)?.[1] ?? '0');
    const sizeViolation = checkDiffSize(ins, del);
    if (sizeViolation) {
      this.log.warn(`diff too large for auto-accept: ${sizeViolation.detail}`);
      return {
        status: 'escalated',
        error: `diff too large: ${sizeViolation.detail}`,
        filesChanged: files,
        commitSha: precommitSha,
      };
    }

    // Commit.
    const commitMsg = `nightshift(${task.id}): ${task.title.slice(0, 60)}`;
    const sha = await this.branches.commitAll(commitMsg);
    return { status: 'passed', filesChanged: files, commitSha: sha || precommitSha };
  }

  private async runDetected(kind: 'test' | 'lint'): Promise<{ ok: boolean; output: string }> {
    const cmd = kind === 'test' ? await this.detectTest() : await this.detectLint();
    if (!cmd) return { ok: true, output: '(skipped — no command configured)' };
    const r = await run('bash', ['-lc', cmd], {
      cwd: config.project.dir,
      timeoutMs: 1000 * 60 * 20,
    });
    return { ok: r.code === 0, output: r.stdout + '\n' + r.stderr };
  }

  private async detectTest(): Promise<string | null> {
    if (config.test.testCommand) return config.test.testCommand;
    const tries: Array<[string, string]> = [
      ['package.json', 'npm test --silent'],
      ['pyproject.toml', 'pytest -q'],
      ['pytest.ini', 'pytest -q'],
      ['go.mod', 'go test ./...'],
      ['Cargo.toml', 'cargo test'],
    ];
    for (const [f, c] of tries) {
      try {
        await fs.access(path.join(config.project.dir, f));
        return c;
      } catch {}
    }
    return null;
  }

  private async detectLint(): Promise<string | null> {
    if (config.test.lintCommand) return config.test.lintCommand;
    try {
      const pkg = JSON.parse(
        await fs.readFile(path.join(config.project.dir, 'package.json'), 'utf8')
      );
      if (pkg?.scripts?.lint) return 'npm run lint --silent';
    } catch {}
    return null;
  }

  buildResult(
    task: Task,
    engine: TaskResult['engine'],
    mode: TaskResult['mode'],
    session: { tokens: number; cost_usd: number; duration_ms: number; text: string },
    evalResult: { status: TaskStatus; error?: string; filesChanged: string[] },
    learnings: string[]
  ): TaskResult {
    return {
      task_id: task.id,
      status: evalResult.status,
      engine,
      mode,
      tokens: session.tokens,
      cost_usd: session.cost_usd,
      duration_ms: session.duration_ms,
      summary: session.text.slice(0, 1200),
      files_changed: evalResult.filesChanged,
      error: evalResult.error,
      is_novel_error: !!evalResult.error && task.retry_count === 0,
      learnings,
    };
  }
}
