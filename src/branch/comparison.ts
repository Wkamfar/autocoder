import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { git, run } from '../utils/exec.js';
import { ComparisonReport, Task } from '../types.js';
import { Logger } from '../utils/logger.js';

interface TestCounts {
  passed: number;
  failed: number;
  total: number;
}

export class BranchComparator {
  private log = new Logger('compare');

  constructor(
    private repoDir: string = config.project.dir,
    private mainBranch: string = config.project.mainBranch
  ) {}

  async generate(branch: string, escalated: Task[]): Promise<ComparisonReport> {
    const g = git(this.repoDir);

    const [namesOut, shortstatOut, commits] = await Promise.all([
      g.diffNames(this.mainBranch, branch),
      g.shortstat(this.mainBranch, branch),
      g.log(branch, 200),
    ]);

    const { insertions, deletions } = this.parseShortstat(shortstatOut);

    // Tests / lint comparison is best-effort; missing commands just yield zeros.
    const mainTests = await this.runTests(this.mainBranch);
    const branchTests = await this.runTests(branch);
    const mainLint = await this.runLint(this.mainBranch);
    const branchLint = await this.runLint(branch);

    const regressions = this.findRegressions(mainTests, branchTests);

    return {
      branch,
      stats: {
        files_changed: namesOut.length,
        insertions,
        deletions,
      },
      tests: {
        main: { passed: mainTests.passed, failed: mainTests.failed },
        branch: { passed: branchTests.passed, failed: branchTests.failed },
        new_tests_added: Math.max(0, branchTests.total - mainTests.total),
        regressions,
      },
      lint: {
        main_errors: mainLint,
        branch_errors: branchLint,
        improvement: mainLint - branchLint,
      },
      commits,
      escalated_tasks: escalated,
    };
  }

  private parseShortstat(s: string): { insertions: number; deletions: number } {
    const ins = /(\d+) insertions?/.exec(s)?.[1] ?? '0';
    const del = /(\d+) deletions?/.exec(s)?.[1] ?? '0';
    return { insertions: Number(ins), deletions: Number(del) };
  }

  private async detectTestCommand(): Promise<string | null> {
    if (config.test.testCommand) return config.test.testCommand;
    const tries: Array<[string, string]> = [
      ['package.json', 'npm test --silent'],
      ['pyproject.toml', 'pytest -q'],
      ['pytest.ini', 'pytest -q'],
      ['go.mod', 'go test ./...'],
      ['Cargo.toml', 'cargo test'],
    ];
    for (const [file, cmd] of tries) {
      try {
        await fs.access(path.join(this.repoDir, file));
        return cmd;
      } catch {}
    }
    return null;
  }

  private async detectLintCommand(): Promise<string | null> {
    if (config.test.lintCommand) return config.test.lintCommand;
    try {
      const pkg = JSON.parse(
        await fs.readFile(path.join(this.repoDir, 'package.json'), 'utf8')
      );
      if (pkg?.scripts?.lint) return 'npm run lint --silent';
    } catch {}
    return null;
  }

  private async runTests(branch: string): Promise<TestCounts> {
    const cmd = await this.detectTestCommand();
    if (!cmd) return { passed: 0, failed: 0, total: 0 };

    const g = git(this.repoDir);
    const current = await g.currentBranch();
    try {
      if (current !== branch) await g.checkout(branch);
      const r = await run('bash', ['-lc', cmd], {
        cwd: this.repoDir,
        timeoutMs: 1000 * 60 * 20,
      });
      return this.parseTestOutput(r.stdout + '\n' + r.stderr, r.code);
    } catch (err) {
      this.log.warn(`test run failed on ${branch}`, err);
      return { passed: 0, failed: 0, total: 0 };
    } finally {
      if (current !== branch) await g.checkout(current);
    }
  }

  private async runLint(branch: string): Promise<number> {
    const cmd = await this.detectLintCommand();
    if (!cmd) return 0;
    const g = git(this.repoDir);
    const current = await g.currentBranch();
    try {
      if (current !== branch) await g.checkout(branch);
      const r = await run('bash', ['-lc', cmd], {
        cwd: this.repoDir,
        timeoutMs: 1000 * 60 * 10,
      });
      const out = (r.stdout + '\n' + r.stderr).match(/error/gi);
      return out?.length ?? (r.code === 0 ? 0 : 1);
    } catch {
      return 0;
    } finally {
      if (current !== branch) await g.checkout(current);
    }
  }

  private parseTestOutput(out: string, code: number): TestCounts {
    // pytest-style
    const pytestPassed = /(\d+) passed/.exec(out)?.[1];
    const pytestFailed = /(\d+) failed/.exec(out)?.[1];
    if (pytestPassed || pytestFailed) {
      const passed = Number(pytestPassed ?? '0');
      const failed = Number(pytestFailed ?? '0');
      return { passed, failed, total: passed + failed };
    }
    // jest/vitest-style "Tests: X passed, Y failed, Z total"
    const jestPassed = /(\d+)\s+passed/i.exec(out)?.[1];
    const jestFailed = /(\d+)\s+failed/i.exec(out)?.[1];
    const jestTotal = /(\d+)\s+total/i.exec(out)?.[1];
    if (jestPassed || jestTotal) {
      return {
        passed: Number(jestPassed ?? '0'),
        failed: Number(jestFailed ?? '0'),
        total: Number(jestTotal ?? jestPassed ?? '0'),
      };
    }
    // go test — assume all pass if exit 0
    return code === 0
      ? { passed: 1, failed: 0, total: 1 }
      : { passed: 0, failed: 1, total: 1 };
  }

  private findRegressions(main: TestCounts, branch: TestCounts): string[] {
    if (branch.failed > main.failed) {
      return [`${branch.failed - main.failed} new failing tests`];
    }
    return [];
  }
}
