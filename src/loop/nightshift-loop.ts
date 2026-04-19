import { EventEmitter } from 'node:events';
import path from 'node:path';
import fs from 'node:fs/promises';
import { config } from '../config.js';
import { Logger } from '../utils/logger.js';
import { SessionManager, sessionManager } from '../engines/session-manager.js';
import { BranchManager } from '../branch/manager.js';
import { BranchComparator } from '../branch/comparison.js';
import { BrainPersistence, brain } from '../brain/persistence.js';
import { ContextBuilder } from '../brain/context-builder.js';
import { DecisionEngine } from './decision-engine.js';
import { StrategicPlanner } from './planner.js';
import { ExecutionDispatcher } from './dispatcher.js';
import { Evaluator } from './evaluator.js';
import { CouncilOrchestrator } from '../council/orchestrator.js';
import { checkRunLimits, shouldRetry } from '../safety/guardrails.js';
import { RollbackManager } from '../safety/rollback.js';
import { packageApproval } from '../safety/package-approval.js';
import { modelFallback } from './model-fallback.js';
import { DiscoveryBootstrap } from './discovery.js';
import { apiInstructions } from '../brain/api-instructions.js';
import { webhook } from '../discord/webhook.js';
import {
  ComparisonReport,
  Objective,
  RunState,
  Task,
  TaskResult,
} from '../types.js';

export interface LoopEvents {
  status: (state: RunState) => void;
  taskStart: (task: Task) => void;
  taskComplete: (task: Task, result: TaskResult) => void;
  escalation: (task: Task, reason: string) => void;
  finished: (state: RunState, report: ComparisonReport) => void;
  error: (err: Error) => void;
  log: (line: string) => void;
}

export class NightShiftLoop extends EventEmitter {
  private log = new Logger('loop');
  private state: RunState | null = null;
  private runDir: string | null = null;
  private startedAt = 0;
  private abort = false;
  private paused = false;

  private readonly branches: BranchManager;
  private readonly comparator: BranchComparator;
  private readonly planner: StrategicPlanner;
  private readonly decisionEngine: DecisionEngine;
  private readonly dispatcher: ExecutionDispatcher;
  private readonly evaluator: Evaluator;
  private readonly council: CouncilOrchestrator;
  private readonly context: ContextBuilder;
  private readonly rollback: RollbackManager;
  private readonly discovery: DiscoveryBootstrap;

  constructor(
    private sessions: SessionManager = sessionManager,
    private brainStore: BrainPersistence = brain
  ) {
    super();
    this.branches = new BranchManager();
    this.comparator = new BranchComparator();
    this.planner = new StrategicPlanner(sessions);
    this.decisionEngine = new DecisionEngine(brainStore);
    this.dispatcher = new ExecutionDispatcher(sessions);
    this.evaluator = new Evaluator(this.branches);
    this.council = new CouncilOrchestrator(sessions, this.branches);
    this.context = new ContextBuilder(brainStore);
    this.rollback = new RollbackManager();
    this.discovery = new DiscoveryBootstrap(config.project.dir, brainStore);
  }

  get rollbackManager(): RollbackManager {
    return this.rollback;
  }

  get discoveryBootstrap(): DiscoveryBootstrap {
    return this.discovery;
  }

  getState(): RunState | null {
    return this.state ? { ...this.state } : null;
  }

  isRunning(): boolean {
    return this.state?.status === 'running';
  }

  async start(objective: Objective): Promise<RunState> {
    if (this.state && this.state.status === 'running') {
      throw new Error('a run is already in progress');
    }
    await this.brainStore.ensureStructure();
    await apiInstructions.ensureStructure();
    await packageApproval.load();

    // First-run discovery: populate architecture.md before planning.
    try {
      await this.discovery.run();
    } catch (err) {
      this.log.warn('discovery failed, continuing', err);
    }

    // Prune old nightshift branches opportunistically.
    this.rollback
      .pruneOldBranches()
      .then((pruned) => {
        if (pruned.length) this.emit('log', `pruned old branches: ${pruned.join(', ')}`);
      })
      .catch(() => {});

    const runId = this.planner.newRunId();
    const branch = await this.branches.createBranch(objective.id);

    const brainContext = await this.brainStore.readKnowledge('architecture.md');
    const plan = await this.planner.plan(objective, brainContext);

    this.state = {
      run_id: runId,
      started_at: new Date().toISOString(),
      objective,
      branch,
      task_queue: plan,
      completed: [],
      failed: [],
      escalated: [],
      total_cost_usd: 0,
      total_tokens: 0,
      status: 'running',
      consecutive_escalations: 0,
      injected_instructions: [],
    };
    this.startedAt = Date.now();
    this.abort = false;
    this.paused = false;
    this.runDir = await this.brainStore.startRun(this.state);

    await fs.mkdir(config.runtime.stateDir, { recursive: true });
    await this.persistState();

    this.emit('status', this.state);
    this.emit('log', `run ${runId} started on branch ${branch} with ${plan.length} tasks`);

    // Kick off the loop in the background.
    this.runLoop().catch(async (err) => {
      this.log.error('loop crashed', err);
      this.emit('error', err as Error);
      if (this.state) this.state.status = 'errored';
      // Best-effort cleanup so a crash doesn't leave zombie sessions or the
      // working tree stranded on a nightshift branch.
      try {
        await this.sessions.destroyAll();
      } catch {
        /* ignore */
      }
      try {
        await this.branches.restoreMain();
      } catch {
        /* ignore */
      }
      try {
        await this.persistState();
      } catch {
        /* ignore */
      }
    });

    return this.state;
  }

  private async runLoop(): Promise<void> {
    if (!this.state) return;

    while (!this.abort) {
      if (this.paused) {
        await this.sleep(500);
        continue;
      }
      const violations = checkRunLimits(this.state, this.startedAt);
      if (violations.length) {
        this.log.warn('run limits violated', violations);
        this.emit('log', `run stopping: ${violations.map((v) => v.kind).join(', ')}`);
        break;
      }

      const completedIds = new Set(this.state.completed.map((t) => t.id));
      const decision = this.decisionEngine.selectNextTask(this.state.task_queue, {
        errorStreak: this.state.consecutive_escalations,
        completedTaskIds: completedIds,
      });

      if (!decision) {
        if (this.state.task_queue.some((t) => t.status === 'pending')) {
          this.log.warn('no decidable task — queue is blocked by missing deps');
        }
        break;
      }

      const task = decision.task;
      task.status = 'in_progress';
      this.state.current_task_id = task.id;
      this.emit('taskStart', task);
      this.emit('log', `[${task.id}] ${decision.reasoning}`);
      await webhook.sendTaskStart(task, decision.engine);

      // Pre-task git checkpoint so we can revert cleanly on failure.
      try {
        task.checkpoint_tag = await this.rollback.checkpoint(task.id, this.state.run_id);
      } catch (err) {
        this.log.warn(`checkpoint failed for ${task.id}`, err);
      }

      const precommitSha = await this.branches.headSha();
      let sessionResult;
      try {
        const context = await this.context.build(task);
        const apiDocs = await apiInstructions.loadRelevant(task);
        const apiBlock = apiDocs.length
          ? `\n\n## API reference\n${apiDocs.join('\n\n---\n\n')}`
          : '';
        const injected = this.state.injected_instructions.join('\n');
        const finalContext =
          context +
          apiBlock +
          (injected ? `\n\n## Live Instructions from Operator\n${injected}` : '');

        if (decision.mode === 'council') {
          sessionResult = await this.council.run(task, finalContext, {
            useDebate: CouncilOrchestrator.shouldDebate(task),
            runId: this.state.run_id,
          });
        } else {
          let tier = undefined;
          try {
            tier = modelFallback.resolve(decision.engine);
          } catch (err) {
            this.emit('log', `all models cooling down: ${(err as Error).message}`);
            throw err;
          }
          sessionResult = await this.dispatcher.execute(decision, finalContext, { tier });
        }
      } catch (err) {
        const msg = (err as Error).message;
        this.log.error(`task ${task.id} errored during dispatch`, err);
        sessionResult = {
          text: `dispatch error: ${msg}`,
          tokens: 0,
          cost_usd: 0,
          duration_ms: 0,
          events: [],
          error: msg,
        };
      }

      // Queue package install requests from the agent for Discord approval.
      const pkgRequests = this.dispatcher.extractPackageRequests(sessionResult.text);
      for (const req of pkgRequests) {
        const decision = packageApproval.decide(
          req.pkg,
          req.manager as 'npm' | 'pip' | 'cargo' | 'go'
        );
        this.emit(
          'log',
          `package ${req.manager} ${req.pkg} → ${decision}${req.reason ? ` (${req.reason})` : ''}`
        );
      }

      const filesFromAgent = this.dispatcher.extractChangedFiles(sessionResult.text);
      const evalResult = await this.evaluator.evaluate(
        task,
        this.state.branch,
        precommitSha,
        filesFromAgent
      );

      // Hard revert to the pre-task checkpoint on any failure so retries start clean.
      if (evalResult.status === 'failed' && task.checkpoint_tag) {
        await this.rollback.rollbackTask(task.id, this.state.run_id);
      }

      const learnings = this.dispatcher.extractLearnings(sessionResult.text);
      const result = this.evaluator.buildResult(
        task,
        decision.engine,
        decision.mode,
        sessionResult,
        evalResult,
        learnings
      );

      this.state.total_cost_usd += result.cost_usd;
      this.state.total_tokens += result.tokens;

      if (evalResult.status === 'passed') {
        task.status = 'passed';
        this.state.completed.push(task);
        this.state.task_queue = this.state.task_queue.filter((t) => t.id !== task.id);
        this.state.consecutive_escalations = 0;
      } else if (evalResult.status === 'escalated') {
        task.status = 'escalated';
        this.state.escalated.push(task);
        this.state.task_queue = this.state.task_queue.filter((t) => t.id !== task.id);
        this.state.consecutive_escalations += 1;
        this.emit('escalation', task, evalResult.error ?? 'unknown');
        await webhook.sendEscalation(task, evalResult.error ?? 'unknown');
      } else {
        task.retry_count += 1;
        task.error_history.push({
          attempt: task.retry_count,
          error: evalResult.error ?? 'unknown',
          at: new Date().toISOString(),
        });
        if (!shouldRetry(task)) {
          task.status = 'escalated';
          this.state.escalated.push(task);
          this.state.task_queue = this.state.task_queue.filter((t) => t.id !== task.id);
          this.state.consecutive_escalations += 1;
          this.emit('escalation', task, 'retries exhausted');
          await webhook.sendEscalation(task, 'retries exhausted');
        } else {
          task.status = 'pending';
        }
      }

      await webhook.sendTaskComplete(task, result);

      if (this.runDir) {
        await this.brainStore.recordTaskCompletion(this.state.run_id, task, result);
      }
      await this.brainStore.updateBrainGuide(this.state);
      await this.brainStore.sync(`brain: ${task.id} ${result.status}`);
      await this.persistState();

      this.emit('taskComplete', task, result);
      this.emit('status', this.state);
    }

    await this.finalize();
  }

  private async finalize(): Promise<void> {
    if (!this.state) return;
    const remaining = this.state.task_queue.some((t) => t.status === 'pending');
    this.state.status = this.abort
      ? 'stopped'
      : remaining
        ? 'paused'
        : 'completed';

    await this.sessions.destroyAll();
    const report = await this.comparator.generate(this.state.branch, this.state.escalated);
    if (this.runDir) {
      await this.brainStore.writeMorningReport(this.state.run_id, this.renderReport(report));
      await this.brainStore.sync(`brain: finalize ${this.state.run_id}`);
    }
    // Clean up per-task rollback tags for this run.
    try {
      await this.rollback.pruneRunTags(this.state.run_id);
    } catch {
      /* ignore */
    }
    await this.persistState();
    // Return the working tree to main so the user's repo is not left on the
    // nightshift branch after a run completes. The branch itself is preserved
    // for review/merge.
    await this.branches.restoreMain();
    await webhook.sendFinished(this.state, report);
    this.emit('finished', this.state, report);
  }

  renderReport(report: ComparisonReport): string {
    return [
      `# NightShift Report — ${report.branch}`,
      '',
      `## Stats`,
      `- Files changed: ${report.stats.files_changed}`,
      `- Insertions: ${report.stats.insertions}`,
      `- Deletions: ${report.stats.deletions}`,
      '',
      `## Tests`,
      `- main: ${report.tests.main.passed} passed, ${report.tests.main.failed} failed`,
      `- branch: ${report.tests.branch.passed} passed, ${report.tests.branch.failed} failed`,
      `- new: ${report.tests.new_tests_added}`,
      `- regressions: ${report.tests.regressions.join(', ') || 'none'}`,
      '',
      `## Lint`,
      `- main errors: ${report.lint.main_errors}`,
      `- branch errors: ${report.lint.branch_errors}`,
      `- delta: ${report.lint.improvement}`,
      '',
      `## Commits (${report.commits.length})`,
      ...report.commits.map((c) => `- ${c.sha.slice(0, 9)} ${c.message}`),
      '',
      `## Escalated (${report.escalated_tasks.length})`,
      ...report.escalated_tasks.map((t) => `- ${t.id}: ${t.title}`),
      '',
    ].join('\n');
  }

  async injectInstruction(instruction: string): Promise<void> {
    if (!this.state) return;
    this.state.injected_instructions.push(instruction);
    await this.persistState();
    this.emit('log', `injected instruction: ${instruction}`);
  }

  async pause(): Promise<void> {
    this.paused = true;
    if (this.state) this.state.status = 'paused';
  }

  async resume(): Promise<void> {
    this.paused = false;
    if (this.state) this.state.status = 'running';
  }

  async stop(): Promise<void> {
    this.abort = true;
    this.paused = false;
    if (this.state) this.state.status = 'stopped';
    try {
      await this.sessions.destroyAll();
    } catch {
      /* ignore */
    }
    try {
      await this.branches.restoreMain();
    } catch {
      /* ignore */
    }
  }

  async skipCurrent(taskId: string): Promise<void> {
    if (!this.state) return;
    const t = this.state.task_queue.find((x) => x.id === taskId);
    if (!t) return;
    t.status = 'skipped';
    this.state.task_queue = this.state.task_queue.filter((x) => x.id !== taskId);
    await this.persistState();
  }

  async reprioritize(taskId: string): Promise<void> {
    if (!this.state) return;
    const idx = this.state.task_queue.findIndex((x) => x.id === taskId);
    if (idx < 0) return;
    const [t] = this.state.task_queue.splice(idx, 1);
    this.state.task_queue.unshift(t);
    await this.persistState();
  }

  async comparisonReport(): Promise<ComparisonReport | null> {
    if (!this.state) return null;
    return this.comparator.generate(this.state.branch, this.state.escalated);
  }

  async mergeToMain(): Promise<void> {
    if (!this.state) throw new Error('no run to merge');
    await this.branches.mergeToMain(this.state.branch);
  }

  async persistState(): Promise<void> {
    if (!this.state) return;
    await fs.mkdir(config.runtime.stateDir, { recursive: true });
    const file = path.join(config.runtime.stateDir, 'run.json');
    await fs.writeFile(file, JSON.stringify(this.state, null, 2));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

export const nightshiftLoop = new NightShiftLoop();
