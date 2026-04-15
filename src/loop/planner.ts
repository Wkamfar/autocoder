import { randomUUID } from 'node:crypto';
import { Objective, Task } from '../types.js';
import { SessionManager } from '../engines/session-manager.js';
import { Logger } from '../utils/logger.js';
import { config } from '../config.js';

const PLANNER_SYSTEM_PROMPT = `You are the Strategic Planner for the NightShift autonomous build system.
Your job: break an objective into a clean, ordered list of discrete engineering tasks.

OUTPUT RULES — read carefully:
- Output a single fenced JSON code block and nothing else outside of it.
- Use this schema (top-level array):
  [{"id":"t_001","title":"...","description":"...","type":"feature|refactor|bugfix|documentation|test|infra|investigation","complexity":"low|medium|high","risk":"low|medium|high","files_affected":<int>,"relevant_files":["src/foo.ts"],"acceptance_criteria":["..."],"depends_on":["t_000"],"tags":["..."]}]
- \`relevant_files\` must list every file you expect this task to touch — used for parallel conflict detection. Be specific; guess when unsure.
- \`acceptance_criteria\` is a list of short statements that, when all true, mean the task is done (used for TDD scaffolding).
- Tasks must be concrete and independently executable.
- depends_on uses other task ids from the same list.
- Prefer smaller tasks; a task should take one short agent session.
- Put infra/setup tasks first, risky/architectural tasks only when needed.

TASK GRANULARITY — critical:
- If the objective is a single-file doc task (e.g. "write a README", "update CHANGELOG", "add SECURITY.md"), output EXACTLY ONE task. Do not split it into "audit existing docs" + "write file". The executing agent will read whatever it needs inside that one task. Splitting wastes tokens and creates dependency chains that fail.
- If the objective touches ≤2 files total, prefer 1 task. 1 task is the minimum — do not pad with investigation/audit tasks.
- Only create multiple tasks when the work genuinely needs dependency ordering (e.g. schema before migration before handler) or when files are truly independent.
- Investigation/audit tasks are only warranted for genuinely unknown codebases with 10+ files to survey. Never for docs.
`;

export class StrategicPlanner {
  private log = new Logger('planner');

  constructor(private sessions: SessionManager) {}

  async plan(objective: Objective, brainContext: string): Promise<Task[]> {
    this.log.info(`planning objective: ${objective.id}`);

    let session;
    try {
      session = await this.sessions.create(
        'claude',
        {
          projectDir: config.project.dir,
          model: config.engines.claudeModel,
          maxTurns: 8,
          systemPrompt: PLANNER_SYSTEM_PROMPT,
          allowedTools: ['Bash', 'Read', 'Glob', 'Grep'],
        },
        `planner-${objective.id}`
      );
    } catch (err) {
      this.log.warn('claude planner unavailable — falling back to heuristic plan', err);
      return this.heuristicPlan(objective);
    }

    try {
      const prompt =
        `Objective: ${objective.title}\n\n${objective.description}\n\n` +
        `Tags: ${(objective.tags ?? []).join(', ') || 'none'}\n\n` +
        `## Brain context\n${brainContext.slice(0, 6000)}\n\n` +
        `Produce the task plan now.`;
      const result = await session.send(prompt);
      const tasks = this.parsePlan(result.text, objective.id);
      if (tasks.length === 0) {
        this.log.warn('planner returned no tasks, using heuristic fallback');
        return this.heuristicPlan(objective);
      }
      return tasks;
    } finally {
      await this.sessions.destroy(session.id);
    }
  }

  parsePlan(text: string, objectiveId: string): Task[] {
    const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
    const raw = fence ? fence[1] : text;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const arrMatch = /\[[\s\S]*\]/.exec(raw);
      if (!arrMatch) return [];
      try {
        parsed = JSON.parse(arrMatch[0]);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((r, i) => this.normalizeTask(r as Record<string, unknown>, i, objectiveId))
      .filter((t): t is Task => t !== null);
  }

  private normalizeTask(
    raw: Record<string, unknown>,
    idx: number,
    objectiveId: string
  ): Task | null {
    if (!raw || typeof raw !== 'object') return null;
    const title = typeof raw.title === 'string' ? raw.title : '';
    const description = typeof raw.description === 'string' ? raw.description : title;
    if (!title) return null;
    return {
      id: typeof raw.id === 'string' ? raw.id : `t_${String(idx).padStart(3, '0')}`,
      title,
      description,
      type: (raw.type as Task['type']) || 'feature',
      complexity: (raw.complexity as Task['complexity']) || 'medium',
      risk: (raw.risk as Task['risk']) || 'medium',
      files_affected:
        typeof raw.files_affected === 'number' ? Math.max(1, raw.files_affected) : 2,
      relevant_files: Array.isArray(raw.relevant_files)
        ? (raw.relevant_files as string[])
        : [],
      acceptance_criteria: Array.isArray(raw.acceptance_criteria)
        ? (raw.acceptance_criteria as string[])
        : [],
      depends_on: Array.isArray(raw.depends_on) ? (raw.depends_on as string[]) : [],
      tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
      objective_id: objectiveId,
      status: 'pending',
      retry_count: 0,
      error_history: [],
      created_at: new Date().toISOString(),
    };
  }

  heuristicPlan(objective: Objective): Task[] {
    const base: Array<Partial<Task>> = [
      {
        id: 't_001',
        title: `Scope & investigate: ${objective.title}`,
        type: 'investigation',
        complexity: 'low',
        risk: 'low',
      },
      {
        id: 't_002',
        title: `Draft architecture for ${objective.title}`,
        type: 'feature',
        complexity: 'medium',
        risk: 'medium',
        depends_on: ['t_001'],
      },
      {
        id: 't_003',
        title: `Implement core module`,
        type: 'feature',
        complexity: 'high',
        risk: 'medium',
        depends_on: ['t_002'],
      },
      {
        id: 't_004',
        title: `Write tests for core module`,
        type: 'test',
        complexity: 'medium',
        risk: 'low',
        depends_on: ['t_003'],
      },
      {
        id: 't_005',
        title: `Document module usage`,
        type: 'documentation',
        complexity: 'low',
        risk: 'low',
        depends_on: ['t_003'],
      },
    ];
    return base.map((p, i) => ({
      id: p.id ?? `t_${String(i).padStart(3, '0')}`,
      title: p.title ?? `Task ${i}`,
      description: `${p.title}\n\nContext:\n${objective.description}`,
      type: (p.type ?? 'feature') as Task['type'],
      complexity: (p.complexity ?? 'medium') as Task['complexity'],
      risk: (p.risk ?? 'medium') as Task['risk'],
      files_affected: 2,
      relevant_files: [],
      acceptance_criteria: [],
      depends_on: p.depends_on ?? [],
      tags: objective.tags ?? [],
      objective_id: objective.id,
      status: 'pending',
      retry_count: 0,
      error_history: [],
      created_at: new Date().toISOString(),
    }));
  }

  newRunId(): string {
    return `run_${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}_${randomUUID().slice(0, 6)}`;
  }
}
