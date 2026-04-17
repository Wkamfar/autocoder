import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { Task, TaskResult, EngineName, RunState, Objective } from '../types.js';
import { Logger } from '../utils/logger.js';
import { git, run, runOrThrow } from '../utils/exec.js';

export interface BrainEngineProfileEntry {
  task_type: string;
  complexity: string;
  success: boolean;
  tokens: number;
  duration_ms: number;
  at: string;
}

export class BrainPersistence {
  private log = new Logger('brain');
  constructor(private brainDir: string = config.brain.dir) {}

  private abs(...parts: string[]): string {
    return path.join(this.brainDir, ...parts);
  }

  async ensureStructure(): Promise<void> {
    const dirs = [
      'knowledge',
      'decisions',
      'runs',
      'engine-profiles',
      'metrics',
    ];
    await fs.mkdir(this.brainDir, { recursive: true });
    for (const d of dirs) {
      await fs.mkdir(this.abs(d), { recursive: true });
    }
    await this.seedFile(
      'BRAIN_GUIDE.md',
      '# OpenClaw Brain Guide\n\nAuto-maintained by NightShift.\n'
    );
    await this.seedFile('knowledge/architecture.md', '# Architecture Notes\n');
    await this.seedFile('knowledge/patterns.md', '# Working Patterns\n');
    await this.seedFile('knowledge/antipatterns.md', '# Known Antipatterns\n');
    await this.seedFile('knowledge/dependencies.md', '# Dependency Notes\n');
    await this.seedFile('knowledge/api-contracts.md', '# External API Contracts\n');
    await this.ensureGitRepo();
  }

  /** Auto-initialize the brain as a git repo if it isn't one yet. */
  private async ensureGitRepo(): Promise<void> {
    const already = await run('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: this.brainDir,
    });
    if (already.code === 0 && already.stdout.trim() === 'true') return;
    try {
      await runOrThrow('git', ['init', '-q', '-b', 'main'], { cwd: this.brainDir });
      // Local identity so brain commits work even without global git config.
      await runOrThrow('git', ['config', 'user.email', 'nightshift@openclaw.local'], {
        cwd: this.brainDir,
      });
      await runOrThrow('git', ['config', 'user.name', 'NightShift'], { cwd: this.brainDir });
      await runOrThrow('git', ['add', '-A'], { cwd: this.brainDir });
      // Allow empty in case seed files already committed by a previous attempt.
      await runOrThrow('git', ['commit', '-q', '--allow-empty', '-m', 'brain: initial seed'], {
        cwd: this.brainDir,
      });
      this.log.info(`initialized brain git repo at ${this.brainDir}`);
    } catch (err) {
      this.log.warn(`brain git init failed: ${(err as Error).message}`);
    }
  }

  private async seedFile(rel: string, content: string): Promise<void> {
    const full = this.abs(rel);
    try {
      await fs.access(full);
    } catch {
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content, 'utf8');
    }
  }

  async startRun(state: RunState): Promise<string> {
    const runDir = this.abs('runs', state.run_id);
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(
      path.join(runDir, 'objective.md'),
      `# ${state.objective.title}\n\n${state.objective.description}\n`
    );
    await fs.writeFile(path.join(runDir, 'progress_log.jsonl'), '');
    await fs.writeFile(path.join(runDir, 'error_registry.json'), '[]');
    await fs.writeFile(path.join(runDir, 'plan.json'), JSON.stringify(state.task_queue, null, 2));
    // Update "current" symlink pointer (as a file to stay portable).
    await fs.writeFile(this.abs('runs', 'CURRENT'), state.run_id, 'utf8');
    return runDir;
  }

  async appendProgress(runId: string, entry: Record<string, unknown>): Promise<void> {
    const file = this.abs('runs', runId, 'progress_log.jsonl');
    await fs.appendFile(file, JSON.stringify(entry) + '\n');
  }

  async recordTaskCompletion(runId: string, task: Task, result: TaskResult): Promise<void> {
    await this.appendProgress(runId, {
      ts: new Date().toISOString(),
      task_id: task.id,
      engine: result.engine,
      mode: result.mode,
      status: result.status,
      tokens: result.tokens,
      cost_usd: result.cost_usd,
      files_changed: result.files_changed,
      summary: result.summary,
    });

    if (result.learnings.length > 0) {
      await this.appendToKnowledge('patterns.md', task, result.learnings);
    }

    if (result.status === 'failed' && result.is_novel_error && result.error) {
      await this.recordAntipattern(task, result.error);
    }

    await this.updateEngineProfile(result.engine, {
      task_type: task.type,
      complexity: task.complexity,
      success: result.status === 'passed',
      tokens: result.tokens,
      duration_ms: result.duration_ms,
      at: new Date().toISOString(),
    });

    await this.appendCostHistory(result);
  }

  private async appendToKnowledge(
    filename: string,
    task: Task,
    learnings: string[]
  ): Promise<void> {
    const file = this.abs('knowledge', filename);
    const block = [
      `\n## ${task.id} — ${task.title}`,
      `_${new Date().toISOString()}_`,
      ...learnings.map((l) => `- ${l}`),
      '',
    ].join('\n');
    await fs.appendFile(file, block);
  }

  async recordAntipattern(task: Task, error: string): Promise<void> {
    const file = this.abs('knowledge', 'antipatterns.md');
    const block = [
      `\n## ${task.id} — ${task.title}`,
      `_${new Date().toISOString()}_`,
      '',
      'Error:',
      '```',
      error.slice(0, 1500),
      '```',
      '',
    ].join('\n');
    await fs.appendFile(file, block);
  }

  async getRelevantAntipatterns(task: Task, limit = 5): Promise<string[]> {
    try {
      const content = await fs.readFile(this.abs('knowledge', 'antipatterns.md'), 'utf8');
      const blocks = content.split(/\n## /).filter(Boolean);
      const needle = (task.title + ' ' + task.description).toLowerCase();
      const scored = blocks.map((b) => {
        const words = needle.split(/\s+/);
        const hits = words.filter((w) => w.length > 3 && b.toLowerCase().includes(w)).length;
        return { block: b, hits };
      });
      scored.sort((a, b) => b.hits - a.hits);
      return scored
        .filter((s) => s.hits > 0)
        .slice(0, limit)
        .map((s) => s.block.slice(0, 600));
    } catch {
      return [];
    }
  }

  async updateEngineProfile(
    engine: EngineName,
    entry: BrainEngineProfileEntry
  ): Promise<void> {
    const file = this.abs('engine-profiles', `${engine}.jsonl`);
    await fs.appendFile(file, JSON.stringify(entry) + '\n');
  }

  async appendCostHistory(result: TaskResult): Promise<void> {
    await fs.appendFile(
      this.abs('metrics', 'cost_history.jsonl'),
      JSON.stringify({
        ts: new Date().toISOString(),
        engine: result.engine,
        cost_usd: result.cost_usd,
        tokens: result.tokens,
        task_id: result.task_id,
      }) + '\n'
    );
  }

  async writeDecision(objective: Objective, summary: string): Promise<void> {
    const date = new Date().toISOString().slice(0, 10);
    const file = this.abs('decisions', `${date}_${objective.id}.md`);
    await fs.writeFile(file, `# ${objective.title}\n\n${summary}\n`);
  }

  async writeMorningReport(runId: string, report: string): Promise<void> {
    await fs.writeFile(this.abs('runs', runId, 'morning_report.md'), report);
  }

  async readKnowledge(filename: string): Promise<string> {
    try {
      return await fs.readFile(this.abs('knowledge', filename), 'utf8');
    } catch {
      return '';
    }
  }

  async updateBrainGuide(state: RunState): Promise<void> {
    const guide = this.abs('BRAIN_GUIDE.md');
    const footer = [
      '\n---',
      `_Last NightShift run: ${state.run_id} (${state.status}) — ${new Date().toISOString()}_`,
      `- Objective: ${state.objective.title}`,
      `- Completed: ${state.completed.length} / ${state.completed.length + state.task_queue.length}`,
      `- Cost: $${state.total_cost_usd.toFixed(2)}`,
      '',
    ].join('\n');
    try {
      const cur = await fs.readFile(guide, 'utf8');
      const stripped = cur.replace(/\n---\n_Last NightShift run:[\s\S]*$/, '');
      await fs.writeFile(guide, stripped + footer);
    } catch {
      await fs.writeFile(guide, `# OpenClaw Brain Guide\n${footer}`);
    }
  }

  /**
   * Link the brain to the OpenClaw remote: set the `openclaw` git remote,
   * fetch to verify reachability, and (optionally) push. Returns a human-
   * readable status string.
   */
  async linkRemote(remote: string = config.brain.remote): Promise<string> {
    if (!remote) return 'no BRAIN_REMOTE configured';
    await this.ensureStructure();
    try {
      try {
        await runOrThrow('git', ['remote', 'set-url', 'openclaw', remote], {
          cwd: this.brainDir,
        });
      } catch {
        await runOrThrow('git', ['remote', 'add', 'openclaw', remote], { cwd: this.brainDir });
      }
      const fetched = await run('git', ['fetch', 'openclaw', '--quiet'], {
        cwd: this.brainDir,
        timeoutMs: 15_000,
      });
      if (fetched.code !== 0) {
        return `remote \`openclaw\` set, but fetch failed: ${fetched.stderr.trim().slice(0, 400)}`;
      }
      return `linked brain → ${remote} (fetch ok)`;
    } catch (err) {
      return `link failed: ${(err as Error).message}`;
    }
  }

  async sync(commitMsg: string): Promise<void> {
    const g = git(this.brainDir);
    try {
      const status = await g.status();
      if (!status.trim()) return;
      await g.add();
      await g.commit(commitMsg);
      if (config.brain.autoPush && config.brain.remote) {
        // Brain repo has no `origin` — only the configured `openclaw` remote
        // (the VPS-hosted bare repo). Skip the default `git push` entirely.
        const branch = await g.currentBranch();
        await this.pushToRemote(config.brain.remote, branch).catch((err) => {
          this.log.warn(`brain push to ${config.brain.remote} failed: ${(err as Error).message}`);
        });
      }
    } catch (err) {
      this.log.warn('brain sync failed (repo may not be initialized)', err);
    }
  }

  private async pushToRemote(remote: string, branch: string): Promise<void> {
    // Ensure a named remote 'openclaw' points at the configured URL.
    try {
      await runOrThrow('git', ['remote', 'set-url', 'openclaw', remote], { cwd: this.brainDir });
    } catch {
      await runOrThrow('git', ['remote', 'add', 'openclaw', remote], { cwd: this.brainDir });
    }
    await runOrThrow('git', ['push', 'openclaw', branch], { cwd: this.brainDir });
  }
}

export const brain = new BrainPersistence();
