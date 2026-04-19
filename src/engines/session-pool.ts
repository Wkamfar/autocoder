import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { EngineName, ISession, SessionOpts, Task } from '../types.js';
import { SessionManager, sessionManager } from './session-manager.js';
import { Logger } from '../utils/logger.js';
import { run, runOrThrow } from '../utils/exec.js';

export interface PoolSlot {
  id: string;
  session: ISession;
  engine: EngineName;
  taskId: string;
  worktreePath: string;
  startedAt: number;
  lastActivityAt: number;
  status: 'active' | 'stalled' | 'released';
}

export interface AcquireOpts {
  engine: EngineName;
  task: Task;
  sessionOpts: SessionOpts;
}

/**
 * Managed pool of sessions with worktree-based isolation for parallel execution.
 *
 * Slots are capped per engine (via config.pool.*). Each acquired slot gets its
 * own git worktree so concurrent sessions can edit files without stepping on
 * each other. `mergeWorktree` folds the worktree's commits back into the main
 * nightshift branch when the task succeeds.
 */
export class SessionPool {
  private log = new Logger('pool');
  private slots = new Map<string, PoolSlot>();

  constructor(
    private manager: SessionManager = sessionManager,
    private branch: string = config.project.mainBranch
  ) {}

  setBranch(branch: string): void {
    this.branch = branch;
  }

  size(): number {
    return this.slots.size;
  }

  countByEngine(engine: EngineName): number {
    let n = 0;
    for (const s of this.slots.values()) if (s.engine === engine) n += 1;
    return n;
  }

  freeSlotsForEngine(engine: EngineName): number {
    const cap = this.cap(engine);
    return Math.max(0, cap - this.countByEngine(engine));
  }

  totalFreeSlots(): number {
    return Math.max(0, config.pool.maxConcurrent - this.slots.size);
  }

  private cap(engine: EngineName): number {
    switch (engine) {
      case 'claude':
        return config.pool.maxClaude;
      case 'codex':
        return config.pool.maxCodex;
      case 'cursor':
        // Share the codex cap — both are premium API-based engines and
        // NightShift currently doesn't surface a dedicated POOL_MAX_CURSOR.
        return config.pool.maxCodex;
      case 'local':
        return config.pool.maxLocal;
      case 'gemini':
        return config.pool.maxLocal;
    }
  }

  async acquire(opts: AcquireOpts): Promise<PoolSlot> {
    if (this.totalFreeSlots() <= 0) {
      await this.evictStalest();
    }
    if (this.freeSlotsForEngine(opts.engine) <= 0) {
      await this.evictOldestOf(opts.engine);
    }

    const worktreePath = await this.createWorktree(opts.task.id);
    const session = await this.manager.create(
      opts.engine,
      { ...opts.sessionOpts, projectDir: worktreePath },
      `pool-${opts.task.id}-${randomUUID().slice(0, 6)}`
    );

    const slot: PoolSlot = {
      id: session.id,
      session,
      engine: opts.engine,
      taskId: opts.task.id,
      worktreePath,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      status: 'active',
    };
    this.slots.set(slot.id, slot);
    this.log.info(
      `acquired ${slot.id} (${opts.engine}) for ${opts.task.id} at ${worktreePath}`
    );
    return slot;
  }

  async release(id: string, opts: { merge: boolean } = { merge: false }): Promise<void> {
    const slot = this.slots.get(id);
    if (!slot) return;
    slot.status = 'released';
    try {
      await this.manager.destroy(id);
    } catch (err) {
      this.log.warn(`destroy ${id} failed`, err);
    }
    try {
      if (opts.merge) {
        await this.mergeWorktree(slot);
      }
    } finally {
      await this.removeWorktree(slot.worktreePath);
      this.slots.delete(id);
      this.log.info(`released ${id}`);
    }
  }

  async releaseAll(): Promise<void> {
    for (const id of [...this.slots.keys()]) {
      await this.release(id, { merge: false });
    }
  }

  touch(id: string): void {
    const slot = this.slots.get(id);
    if (slot) slot.lastActivityAt = Date.now();
  }

  listSlots(): ReadonlyArray<PoolSlot> {
    return [...this.slots.values()];
  }

  findStalled(): PoolSlot[] {
    const cutoff = Date.now() - config.pool.stallMs;
    return [...this.slots.values()].filter((s) => s.lastActivityAt < cutoff);
  }

  /**
   * Group tasks into sets that can be executed in parallel. Two tasks conflict
   * if their `relevant_files` overlap. Greedy grouping — good enough for most
   * plans and deterministic.
   */
  groupByConflict(tasks: Task[]): Task[][] {
    const groups: Task[][] = [];
    const assigned = new Set<string>();
    for (const task of tasks) {
      if (assigned.has(task.id)) continue;
      const group: Task[] = [task];
      assigned.add(task.id);
      const touched = new Set<string>(task.relevant_files);
      for (const other of tasks) {
        if (assigned.has(other.id)) continue;
        const conflict = other.relevant_files.some((f) => touched.has(f));
        if (conflict) continue;
        group.push(other);
        assigned.add(other.id);
        for (const f of other.relevant_files) touched.add(f);
      }
      groups.push(group);
    }
    return groups;
  }

  private async evictStalest(): Promise<void> {
    const stalled = this.findStalled();
    const target = stalled.length
      ? stalled.sort((a, b) => a.lastActivityAt - b.lastActivityAt)[0]
      : [...this.slots.values()].sort((a, b) => a.lastActivityAt - b.lastActivityAt)[0];
    if (target) {
      this.log.warn(`evicting ${target.id} to free a slot`);
      await this.release(target.id, { merge: false });
    }
  }

  private async evictOldestOf(engine: EngineName): Promise<void> {
    const candidates = [...this.slots.values()]
      .filter((s) => s.engine === engine)
      .sort((a, b) => a.lastActivityAt - b.lastActivityAt);
    if (candidates.length) {
      this.log.warn(`evicting ${candidates[0].id} (${engine}) to free a slot`);
      await this.release(candidates[0].id, { merge: false });
    }
  }

  private async createWorktree(taskId: string): Promise<string> {
    await fs.mkdir(config.pool.worktreeRoot, { recursive: true });
    const dirName = `ns-${taskId}-${randomUUID().slice(0, 6)}`;
    const worktreePath = path.join(config.pool.worktreeRoot, dirName);
    try {
      await runOrThrow(
        'git',
        ['worktree', 'add', worktreePath, this.branch],
        { cwd: config.project.dir }
      );
    } catch (err) {
      this.log.warn(
        `worktree add failed, falling back to project dir (parallel disabled)`,
        err
      );
      return config.project.dir;
    }
    return worktreePath;
  }

  private async mergeWorktree(slot: PoolSlot): Promise<void> {
    if (slot.worktreePath === config.project.dir) return;
    // Stage and commit whatever the agent produced inside the worktree.
    const stageStatus = await run('git', ['status', '--porcelain'], {
      cwd: slot.worktreePath,
    });
    if (stageStatus.stdout.trim()) {
      await run('git', ['add', '-A'], { cwd: slot.worktreePath });
      await run(
        'git',
        ['commit', '-m', `nightshift-worktree(${slot.taskId})`],
        { cwd: slot.worktreePath }
      );
    }
    // Fast-forward merge into the parent branch.
    const merge = await run(
      'git',
      ['merge', '--no-ff', '-m', `merge worktree ${slot.taskId}`, `HEAD@{upstream}`],
      { cwd: config.project.dir }
    );
    if (merge.code !== 0) {
      // Fall back to cherry-picking the worktree HEAD.
      const sha = await run('git', ['rev-parse', 'HEAD'], { cwd: slot.worktreePath });
      const head = sha.stdout.trim();
      if (head) {
        await run('git', ['cherry-pick', head], { cwd: config.project.dir });
      }
    }
  }

  private async removeWorktree(worktreePath: string): Promise<void> {
    if (worktreePath === config.project.dir) return;
    await run('git', ['worktree', 'remove', '--force', worktreePath], {
      cwd: config.project.dir,
    });
  }
}

export const sessionPool = new SessionPool();
