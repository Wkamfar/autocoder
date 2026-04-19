import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { run } from '../utils/exec.js';
import { Logger } from '../utils/logger.js';
import { RunState, Task, TaskResult } from '../types.js';

/**
 * BrainPersistence
 *
 * Writes knowledge produced by each run to `$BRAIN_DIR` on disk and, if a
 * remote is configured, commits + pushes so the brain is visible across hosts.
 *
 * On-disk layout:
 *
 *   $BRAIN_DIR/
 *     knowledge/
 *       architecture.md           - populated by DiscoveryBootstrap
 *       patterns.md               - appended learnings per successful task
 *       antipatterns.md           - appended novel errors
 *       brain-guide.md            - rolling summary of recent runs
 *       api-instructions/         - managed by ApiInstructions
 *     runs/
 *       <run_id>/
 *         run.json                - snapshot of RunState at startRun
 *         progress_log.jsonl      - one JSON line per task result
 *         debates/
 *           <task_id>.md          - debate transcripts (written by council)
 *         morning_report.md       - final comparison report
 *
 * All methods are best-effort: writes + git operations that fail are logged
 * but never thrown upward, because losing a knowledge write should never
 * crash the run.
 */
export class BrainPersistence {
  private log = new Logger('brain');

  constructor(private readonly dir: string = config.brain.dir) {}

  get root(): string {
    return this.dir;
  }

  get knowledgeDir(): string {
    return path.join(this.dir, 'knowledge');
  }

  get runsDir(): string {
    return path.join(this.dir, 'runs');
  }

  async ensureStructure(): Promise<void> {
    await fs.mkdir(this.knowledgeDir, { recursive: true });
    await fs.mkdir(this.runsDir, { recursive: true });
    await fs.mkdir(path.join(this.knowledgeDir, 'api-instructions'), {
      recursive: true,
    });
    // Seed empty knowledge files so readers can `cat` them without EEXIST
    // gymnastics.
    for (const f of ['architecture.md', 'patterns.md', 'antipatterns.md', 'brain-guide.md']) {
      const p = path.join(this.knowledgeDir, f);
      try {
        await fs.access(p);
      } catch {
        await fs.writeFile(p, '');
      }
    }
    // Init as a git repo if it isn't one. The brain is optional version
    // control — if `git init` fails we still function as a plain filesystem.
    const isRepo = await run('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: this.dir,
    });
    if (isRepo.code !== 0) {
      const init = await run('git', ['init', '-q'], { cwd: this.dir });
      if (init.code !== 0) {
        this.log.warn('brain: git init failed, continuing without version control');
      } else {
        // Default branch name to main to match most projects.
        await run('git', ['symbolic-ref', 'HEAD', 'refs/heads/main'], {
          cwd: this.dir,
        });
      }
    }
  }

  /**
   * Configure `config.brain.remote` as the `origin` remote on the brain repo.
   * Returns a human-readable status string used by the `!ns doctor` output.
   */
  async linkRemote(): Promise<string> {
    if (!config.brain.remote) return 'no BRAIN_REMOTE set — nothing to link';
    await this.ensureStructure();
    const existing = await run('git', ['remote', 'get-url', 'origin'], {
      cwd: this.dir,
    });
    if (existing.code === 0) {
      const current = existing.stdout.trim();
      if (current === config.brain.remote) {
        return `origin already set to ${current}`;
      }
      await run('git', ['remote', 'set-url', 'origin', config.brain.remote], {
        cwd: this.dir,
      });
      return `updated origin -> ${config.brain.remote}`;
    }
    const add = await run('git', ['remote', 'add', 'origin', config.brain.remote], {
      cwd: this.dir,
    });
    if (add.code !== 0) {
      return `failed to add origin: ${add.stderr.trim() || 'unknown error'}`;
    }
    return `added origin -> ${config.brain.remote}`;
  }

  async readKnowledge(file: string): Promise<string> {
    const p = path.join(this.knowledgeDir, file);
    try {
      return await fs.readFile(p, 'utf8');
    } catch {
      return '';
    }
  }

  async writeKnowledge(file: string, content: string): Promise<void> {
    await fs.mkdir(this.knowledgeDir, { recursive: true });
    await fs.writeFile(path.join(this.knowledgeDir, file), content);
  }

  async appendKnowledge(file: string, content: string): Promise<void> {
    await fs.mkdir(this.knowledgeDir, { recursive: true });
    await fs.appendFile(path.join(this.knowledgeDir, file), content);
  }

  /**
   * Create `runs/<run_id>/` and snapshot the initial RunState. Returns the
   * directory path so callers can write additional artifacts.
   */
  async startRun(state: RunState): Promise<string> {
    const runDir = path.join(this.runsDir, state.run_id);
    await fs.mkdir(runDir, { recursive: true });
    await fs.mkdir(path.join(runDir, 'debates'), { recursive: true });
    await fs.writeFile(
      path.join(runDir, 'run.json'),
      JSON.stringify(state, null, 2)
    );
    await fs.writeFile(path.join(runDir, 'progress_log.jsonl'), '');
    return runDir;
  }

  async recordTaskCompletion(
    runId: string,
    task: Task,
    result: TaskResult
  ): Promise<void> {
    const line =
      JSON.stringify({
        at: new Date().toISOString(),
        task_id: task.id,
        title: task.title,
        status: result.status,
        engine: result.engine,
        mode: result.mode,
        cost_usd: result.cost_usd,
        tokens: result.tokens,
        duration_ms: result.duration_ms,
        files_changed: result.files_changed,
        summary: result.summary,
        error: result.error,
        is_novel_error: result.is_novel_error,
      }) + '\n';
    const p = path.join(this.runsDir, runId, 'progress_log.jsonl');
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.appendFile(p, line);

    if (result.learnings && result.learnings.length > 0) {
      const block =
        `\n## ${task.id} — ${task.title} (${new Date().toISOString()})\n` +
        result.learnings.map((l) => `- ${l}`).join('\n') +
        '\n';
      await this.appendKnowledge('patterns.md', block);
    }

    if (result.is_novel_error && result.error) {
      const block =
        `\n## ${task.id} — ${new Date().toISOString()}\n` +
        `Task: ${task.title}\n` +
        `Engine: ${result.engine}\n` +
        `Error: ${result.error}\n`;
      await this.appendKnowledge('antipatterns.md', block);
    }
  }

  /**
   * Maintain a rolling summary of the most recent completed runs at
   * `knowledge/brain-guide.md`. This is what the planner reads to avoid
   * repeating recent mistakes.
   */
  async updateBrainGuide(state: RunState): Promise<void> {
    const guidePath = path.join(this.knowledgeDir, 'brain-guide.md');
    const previous = await this.readKnowledge('brain-guide.md');
    const header = `# NightShift Brain Guide\n\nLast updated: ${new Date().toISOString()}\n\n`;
    const section =
      `## Run ${state.run_id} — ${state.objective.title}\n` +
      `- Status: ${state.status}\n` +
      `- Branch: ${state.branch}\n` +
      `- Completed: ${state.completed.length}\n` +
      `- Failed: ${state.failed.length}\n` +
      `- Escalated: ${state.escalated.length}\n` +
      `- Cost: $${state.total_cost_usd.toFixed(2)}\n\n`;

    // Keep only the most recent 10 run blocks so the file stays small.
    const existingBlocks = previous
      .split(/^## Run /m)
      .slice(1)
      .slice(0, 9)
      .map((s) => '## Run ' + s);
    const body = [section, ...existingBlocks].join('');
    await fs.writeFile(guidePath, header + body);
  }

  /**
   * Stage everything in the brain dir, commit, and best-effort push. Any
   * failure is logged and swallowed — the run continues.
   */
  async sync(message: string): Promise<void> {
    try {
      await run('git', ['add', '-A'], { cwd: this.dir });
      // --allow-empty guards against "nothing to commit" when the run wrote
      // nothing new. We still want a commit marker so the timeline is
      // readable.
      const commit = await run(
        'git',
        ['commit', '--allow-empty', '-m', message],
        { cwd: this.dir }
      );
      if (commit.code !== 0 && !/nothing to commit/i.test(commit.stderr)) {
        this.log.warn(`brain commit failed: ${commit.stderr.trim()}`);
      }
      if (config.brain.autoPush && config.brain.remote) {
        const push = await run('git', ['push', 'origin', 'HEAD'], {
          cwd: this.dir,
          timeoutMs: 30_000,
        });
        if (push.code !== 0) {
          this.log.warn(`brain push failed: ${push.stderr.trim()}`);
        }
      }
    } catch (err) {
      this.log.warn('brain sync failed', err);
    }
  }

  async writeMorningReport(runId: string, content: string): Promise<void> {
    const p = path.join(this.runsDir, runId, 'morning_report.md');
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content);
  }

  /**
   * Persist a debate transcript for a specific task so it can be surfaced in
   * Discord via `!ns debate <task_id>`.
   */
  async writeDebate(runId: string, taskId: string, content: string): Promise<void> {
    const p = path.join(this.runsDir, runId, 'debates', `${taskId}.md`);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content);
  }

  async readDebate(runId: string, taskId: string): Promise<string | null> {
    const p = path.join(this.runsDir, runId, 'debates', `${taskId}.md`);
    try {
      return await fs.readFile(p, 'utf8');
    } catch {
      return null;
    }
  }
}

export const brain = new BrainPersistence();
