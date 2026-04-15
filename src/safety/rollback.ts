import { config } from '../config.js';
import { run, runOrThrow } from '../utils/exec.js';
import { Logger } from '../utils/logger.js';

/**
 * Git tag-based checkpoint/rollback.
 *
 * Before each task we tag HEAD. On failure we reset --hard to the tag and clean
 * untracked files. Tags are namespaced per run so parallel tasks don't collide.
 */
export class RollbackManager {
  private log = new Logger('rollback');
  private history: Array<{ taskId: string; tag: string; at: string }> = [];

  constructor(private repoDir: string = config.project.dir) {}

  async checkpoint(taskId: string, runId: string): Promise<string> {
    const tag = `nightshift/${runId}/pre-${taskId}`;
    try {
      // Delete stale tag if a previous attempt left one behind.
      await run('git', ['tag', '-d', tag], { cwd: this.repoDir });
    } catch {
      /* ignore */
    }
    await runOrThrow('git', ['tag', tag, '-m', `checkpoint for ${taskId}`], {
      cwd: this.repoDir,
    });
    this.history.push({ taskId, tag, at: new Date().toISOString() });
    this.log.info(`checkpoint ${tag}`);
    return tag;
  }

  async rollback(tag: string): Promise<void> {
    this.log.warn(`rolling back to ${tag}`);
    await runOrThrow('git', ['reset', '--hard', tag], { cwd: this.repoDir });
    await run('git', ['clean', '-fd'], { cwd: this.repoDir });
  }

  async rollbackTask(taskId: string, runId: string): Promise<boolean> {
    const entry = [...this.history].reverse().find((h) => h.taskId === taskId);
    const tag = entry?.tag ?? `nightshift/${runId}/pre-${taskId}`;
    try {
      await this.rollback(tag);
      return true;
    } catch (err) {
      this.log.warn(`rollback failed for ${taskId}`, err);
      return false;
    }
  }

  async pruneRunTags(runId: string): Promise<void> {
    const out = await run('git', ['tag', '-l', `nightshift/${runId}/*`], {
      cwd: this.repoDir,
    });
    const tags = out.stdout.split('\n').map((t) => t.trim()).filter(Boolean);
    for (const t of tags) {
      await run('git', ['tag', '-d', t], { cwd: this.repoDir });
    }
  }

  /**
   * Delete nightshift branches older than `config.safety.branchMaxAgeDays`.
   * Safe: only touches `nightshift/*` branches that are fully merged into main.
   */
  async pruneOldBranches(): Promise<string[]> {
    const cutoffDays = config.safety.branchMaxAgeDays;
    const r = await run(
      'git',
      [
        'for-each-ref',
        '--format=%(refname:short)|%(committerdate:unix)',
        'refs/heads/nightshift',
      ],
      { cwd: this.repoDir }
    );
    const now = Date.now() / 1000;
    const deleted: string[] = [];
    for (const line of r.stdout.split('\n').filter(Boolean)) {
      const [name, ts] = line.split('|');
      if (!name || !ts) continue;
      const ageDays = (now - Number(ts)) / 86400;
      if (ageDays < cutoffDays) continue;
      const merged = await run('git', ['branch', '--merged', config.project.mainBranch], {
        cwd: this.repoDir,
      });
      if (!merged.stdout.includes(name)) continue;
      const del = await run('git', ['branch', '-d', name], { cwd: this.repoDir });
      if (del.code === 0) {
        deleted.push(name);
        this.log.info(`pruned ${name}`);
      }
    }
    return deleted;
  }

  getHistory(): ReadonlyArray<{ taskId: string; tag: string; at: string }> {
    return this.history;
  }
}
