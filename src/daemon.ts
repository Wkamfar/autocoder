import fs from 'node:fs/promises';
import path from 'node:path';
import { NightShiftLoop, nightshiftLoop } from './loop/nightshift-loop.js';
import { Objective, RunState } from './types.js';
import { config, validateConfig } from './config.js';
import { Logger } from './utils/logger.js';
import { slugify } from './utils/exec.js';
import { packageApproval } from './safety/package-approval.js';
import { modelFallback } from './loop/model-fallback.js';
import { runDoctor, DoctorReport } from './safety/doctor.js';
import { brain } from './brain/persistence.js';
import { allDebatePrompts } from './council/debate-prompts.js';

export class NightShiftDaemon {
  private log = new Logger('daemon');
  private objectiveQueue: Objective[] = [];
  private idleCheckTimer: NodeJS.Timeout | null = null;

  constructor(private loop: NightShiftLoop = nightshiftLoop) {}

  async init(): Promise<void> {
    const configErrors = validateConfig();
    for (const err of configErrors) {
      this.log.warn(`config: ${err}`);
    }
    await fs.mkdir(config.runtime.stateDir, { recursive: true });
    const objFile = path.join(config.runtime.stateDir, 'objectives.json');
    try {
      const raw = await fs.readFile(objFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.objectives)) this.objectiveQueue = parsed.objectives;
    } catch {}
    this.loop.on('finished', () => this.maybeStartNext());
    this.idleCheckTimer = setInterval(() => this.maybeStartNext(), 30_000);
  }

  async shutdown(): Promise<void> {
    if (this.idleCheckTimer) clearInterval(this.idleCheckTimer);
    await this.loop.stop();
  }

  async start(text: string): Promise<RunState> {
    const objective: Objective = {
      id: slugify(text) || `obj-${Date.now()}`,
      title: text.slice(0, 80),
      description: text,
      priority: 1,
      tags: [],
    };
    return this.loop.start(objective);
  }

  async startFromFile(filePath: string): Promise<RunState> {
    const raw = await fs.readFile(filePath, 'utf8');
    let obj: Objective;
    if (filePath.endsWith('.json')) {
      const parsed = JSON.parse(raw);
      obj = Array.isArray(parsed?.objectives) ? parsed.objectives[0] : parsed;
    } else {
      obj = {
        id: slugify(path.basename(filePath, path.extname(filePath))),
        title: raw.split('\n', 1)[0].slice(0, 80) || 'objective',
        description: raw,
        priority: 1,
      };
    }
    return this.loop.start(obj);
  }

  getStatus(): RunState | null {
    return this.loop.getState();
  }

  async injectInstruction(text: string): Promise<void> {
    return this.loop.injectInstruction(text);
  }

  async pause(): Promise<void> {
    return this.loop.pause();
  }
  async resume(): Promise<void> {
    return this.loop.resume();
  }
  async stop(): Promise<void> {
    return this.loop.stop();
  }
  async skip(taskId: string): Promise<void> {
    return this.loop.skipCurrent(taskId);
  }
  async reprioritize(taskId: string): Promise<void> {
    return this.loop.reprioritize(taskId);
  }
  async comparisonReport() {
    return this.loop.comparisonReport();
  }
  async mergeToMain(): Promise<void> {
    return this.loop.mergeToMain();
  }

  async rediscover(): Promise<void> {
    await this.loop.discoveryBootstrap.run(true);
  }

  async rollbackTask(taskId: string): Promise<boolean> {
    const state = this.getStatus();
    if (!state) return false;
    return this.loop.rollbackManager.rollbackTask(taskId, state.run_id);
  }

  listPendingPackages() {
    return packageApproval.listPending();
  }

  approvePackage(pkg: string): boolean {
    return packageApproval.approve(pkg);
  }

  rejectPackage(pkg: string): boolean {
    return packageApproval.reject(pkg);
  }

  fallbackSnapshot() {
    return modelFallback.snapshot();
  }

  async doctor(): Promise<DoctorReport> {
    return runDoctor();
  }

  async linkBrain(): Promise<string> {
    return brain.linkRemote();
  }

  /**
   * Returns the debate transcript for a given task in the currently-running
   * run (or null if none). Used by `!ns debate <task_id>`.
   */
  async getDebate(taskId: string): Promise<string | null> {
    const state = this.getStatus();
    if (!state) return null;
    return brain.readDebate(state.run_id, taskId);
  }

  /**
   * Returns the system prompts used for each debate role. Used by
   * `!ns debate-prompt` so operators can see exactly what the debaters are
   * told.
   */
  getDebatePrompts(): { role: string; prompt: string }[] {
    return allDebatePrompts();
  }

  addObjective(obj: Objective): void {
    this.objectiveQueue.push(obj);
    this.persistObjectives().catch((err) => this.log.warn('persist failed', err));
  }

  listObjectives(): Objective[] {
    return [...this.objectiveQueue];
  }

  private async persistObjectives(): Promise<void> {
    // Atomic write with a simple advisory lock so two processes can't corrupt
    // objectives.json concurrently. We write to a .tmp file, then rename —
    // rename is atomic within the same filesystem on POSIX.
    const file = path.join(config.runtime.stateDir, 'objectives.json');
    const tmp = file + '.tmp';
    const lock = file + '.lock';
    const data = JSON.stringify({ objectives: this.objectiveQueue }, null, 2);

    for (let i = 0; i < 50; i++) {
      try {
        const fh = await fs.open(lock, 'wx');
        await fh.close();
        break;
      } catch {
        if (i === 49) {
          this.log.warn('persist objectives: lock held too long, writing anyway');
        } else {
          await new Promise((r) => setTimeout(r, 20));
          continue;
        }
      }
    }
    try {
      await fs.writeFile(tmp, data);
      await fs.rename(tmp, file);
    } finally {
      await fs.unlink(lock).catch(() => {});
    }
  }

  private async maybeStartNext(): Promise<void> {
    if (this.loop.isRunning()) return;
    // Re-read objectives.json so CLI-added objectives from another process
    // are picked up by the running daemon.
    if (this.objectiveQueue.length === 0) {
      await this.reloadObjectivesFromDisk();
    }
    if (this.objectiveQueue.length === 0) return;
    const next = this.objectiveQueue.shift()!;
    await this.persistObjectives();
    try {
      await this.loop.start(next);
    } catch (err) {
      this.log.error(`failed to start next objective ${next.id}`, err);
    }
  }

  private async reloadObjectivesFromDisk(): Promise<void> {
    const file = path.join(config.runtime.stateDir, 'objectives.json');
    try {
      const raw = await fs.readFile(file, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.objectives)) this.objectiveQueue = parsed.objectives;
    } catch {
      /* no file yet, ignore */
    }
  }

  get events() {
    return this.loop;
  }
}

export const daemon = new NightShiftDaemon();
