import { EngineName, Task, TaskDecision } from '../types.js';
import { BrainPersistence } from '../brain/persistence.js';
import { config } from '../config.js';

export interface DecisionContext {
  errorStreak: number;
  completedTaskIds: Set<string>;
}

export class DecisionEngine {
  constructor(private brain: BrainPersistence) {}

  selectNextTask(queue: Task[], ctx: DecisionContext): TaskDecision | null {
    const available = queue.filter(
      (t) =>
        t.status === 'pending' &&
        t.depends_on.every((d) => ctx.completedTaskIds.has(d))
    );
    if (available.length === 0) return null;

    const scored = available.map((task) => {
      const engine = this.pickEngine(task);
      const mode = this.pickMode(task);
      const score = this.scoreTask(task, ctx);
      const reasoning = this.reasoning(task, engine, mode, score);
      return { task, engine, mode, priority: score, reasoning };
    });
    scored.sort((a, b) => b.priority - a.priority);
    return scored[0];
  }

  pickEngine(task: Task): EngineName {
    const raw = this.pickEngineRaw(task);
    if (raw === 'codex' && config.engines.disableCodex) return 'claude';
    if (raw === 'cursor' && config.engines.disableCursor) return 'claude';
    if (raw === 'local' && config.engines.disableLocal) return 'claude';
    return raw;
  }

  private pickEngineRaw(task: Task): EngineName {
    // IMPORTANT: every engine returned here must be able to modify files on
    // disk. DeepSeek (`local`) is a chat-only API with no tool use — it can
    // describe changes in text but cannot edit the repo, so tasks routed to
    // it always land with zero diff and fail evaluation. `local` is only
    // valid inside council roles that consume its text output directly.
    if (task.files_affected > 3 || task.complexity === 'high') return 'claude';
    if (task.files_affected <= 2 && task.complexity === 'medium' && !config.engines.disableCodex) {
      return 'codex';
    }
    // Documentation, low-complexity, and everything else go to Claude.
    // The fallback chain will downshift to Sonnet automatically if Opus is
    // cooling down; DeepSeek remains available as a last-resort emergency
    // tier but is effectively a no-op for file-editing work.
    return 'claude';
  }

  pickMode(task: Task): 'single' | 'council' {
    if (task.risk === 'high') return 'council';
    if (task.tags.includes('architecture') || task.tags.includes('auth') || task.tags.includes('payments'))
      return 'council';
    return 'single';
  }

  private scoreTask(task: Task, ctx: DecisionContext): number {
    let score = 100;
    // Deprioritize tasks that have already failed several times.
    score -= task.retry_count * 15;
    // Prefer smaller, simpler work when an error streak is building.
    if (ctx.errorStreak >= 2) {
      if (task.complexity === 'low') score += 20;
      if (task.complexity === 'high') score -= 20;
    }
    // Prefer tasks with more dependents unblocked (approximation: fewer deps = earlier).
    score -= task.depends_on.length * 2;
    return score;
  }

  private reasoning(
    task: Task,
    engine: EngineName,
    mode: 'single' | 'council',
    score: number
  ): string {
    return (
      `picked ${engine} (${mode}) for ${task.id}: ` +
      `complexity=${task.complexity}, risk=${task.risk}, files=${task.files_affected}, score=${score}`
    );
  }
}
