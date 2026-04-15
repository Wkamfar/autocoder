export type EngineName = 'claude' | 'codex' | 'cursor' | 'local';

export type TaskComplexity = 'low' | 'medium' | 'high';
export type TaskRisk = 'low' | 'medium' | 'high';

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'passed'
  | 'failed'
  | 'escalated'
  | 'skipped';

export interface Task {
  id: string;
  title: string;
  description: string;
  type:
    | 'feature'
    | 'refactor'
    | 'bugfix'
    | 'documentation'
    | 'test'
    | 'infra'
    | 'investigation';
  complexity: TaskComplexity;
  risk: TaskRisk;
  files_affected: number;
  /** Exact file paths this task will touch (best guess from planner) — used for conflict detection. */
  relevant_files: string[];
  /** Acceptance criteria used for TDD pre-task scaffolding. */
  acceptance_criteria: string[];
  depends_on: string[];
  tags: string[];
  objective_id: string;
  status: TaskStatus;
  retry_count: number;
  error_history: ErrorEntry[];
  created_at: string;
  /** Pre-task git tag name for rollback. */
  checkpoint_tag?: string;
}

export interface ModelTier {
  engine: EngineName;
  model: string;
  label: string;
  costTier: 'premium' | 'standard' | 'free';
}

export interface ErrorEntry {
  attempt: number;
  error: string;
  at: string;
}

export interface Objective {
  id: string;
  title: string;
  description: string;
  priority: number;
  max_runtime_minutes?: number;
  max_cost_usd?: number;
  tags?: string[];
}

export interface TaskResult {
  task_id: string;
  status: TaskStatus;
  engine: EngineName;
  mode: 'single' | 'council';
  tokens: number;
  cost_usd: number;
  duration_ms: number;
  summary: string;
  files_changed: string[];
  error?: string;
  is_novel_error?: boolean;
  learnings: string[];
}

export interface SessionOpts {
  projectDir: string;
  model?: string;
  allowedTools?: string[];
  maxTurns?: number;
  systemPrompt?: string;
  env?: Record<string, string>;
}

export type SessionStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'errored';

export interface CostInfo {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface SessionResult {
  text: string;
  tokens: number;
  cost_usd: number;
  duration_ms: number;
  events: unknown[];
  error?: string;
  rate_limited?: boolean;
  /** True if the session returned a successful response (not an error, not a rate limit). */
  ok?: boolean;
}

export interface ISession {
  readonly id: string;
  readonly engine: EngineName;
  start(opts: SessionOpts): Promise<void>;
  send(message: string): Promise<SessionResult>;
  stop(): Promise<void>;
  getStatus(): SessionStatus;
  getCost(): CostInfo;
}

export interface TaskDecision {
  task: Task;
  engine: EngineName;
  mode: 'single' | 'council';
  priority: number;
  reasoning: string;
}

export interface RunState {
  run_id: string;
  started_at: string;
  objective: Objective;
  branch: string;
  task_queue: Task[];
  completed: Task[];
  failed: Task[];
  escalated: Task[];
  current_task_id?: string;
  total_cost_usd: number;
  total_tokens: number;
  status: 'initializing' | 'running' | 'paused' | 'completed' | 'stopped' | 'errored';
  consecutive_escalations: number;
  injected_instructions: string[];
}

export interface ComparisonReport {
  branch: string;
  stats: {
    files_changed: number;
    insertions: number;
    deletions: number;
  };
  tests: {
    main: { passed: number; failed: number };
    branch: { passed: number; failed: number };
    new_tests_added: number;
    regressions: string[];
  };
  lint: {
    main_errors: number;
    branch_errors: number;
    improvement: number;
  };
  commits: { sha: string; message: string }[];
  escalated_tasks: Task[];
}
