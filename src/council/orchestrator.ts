import { SessionManager } from '../engines/session-manager.js';
import { BranchManager } from '../branch/manager.js';
import { SessionResult, Task, EngineName } from '../types.js';
import { config } from '../config.js';
import { Logger } from '../utils/logger.js';
import { brain as defaultBrain, BrainPersistence } from '../brain/persistence.js';
import {
  DEBATE_ADVOCATE_SYSTEM,
  DEBATE_SKEPTIC_SYSTEM,
  DEBATE_JUDGE_SYSTEM,
} from './debate-prompts.js';

interface Agent {
  name: string;
  emoji: string;
  persona: string;
  engine: EngineName;
  model: string;
}

function buildAgents(): Agent[] {
  const builderEngine: EngineName = config.engines.disableCodex ? 'claude' : 'codex';
  const builderModel = config.engines.disableCodex ? 'claude-sonnet-4-6' : 'gpt-5.4';
  return [
    {
      name: 'Architect',
      emoji: 'A',
      persona:
        'You are the Architect. Produce a precise plan before any code is written. ' +
        'Enumerate files to touch, edge cases, and failure modes. ' +
        'End your plan with a single line: [CONSENSUS: YES] or [CONSENSUS: NO].',
      engine: 'claude',
      model: 'claude-opus-4-6',
    },
    {
      name: 'Builder',
      emoji: 'B',
      persona:
        'You are the Builder. Implement the Architect plan exactly. ' +
        'Write production-quality code with tests. End with CHANGES and DONE sections.',
      engine: builderEngine,
      model: builderModel,
    },
    {
      name: 'Reviewer',
      emoji: 'R',
      persona:
        'You are the Reviewer. Adversarially check for bugs, security issues, and performance problems. ' +
        'End your review with [APPROVE] or [REJECT: <reasons>].',
      engine: 'claude',
      model: 'claude-sonnet-4-6',
    },
  ];
}

export interface CouncilRunOpts {
  /**
   * When true, the Reviewer step is replaced by a three-agent debate
   * (Advocate / Skeptic / Judge). Triggered by the loop for risky tasks.
   */
  useDebate?: boolean;
  /**
   * Run id — required when `useDebate` is true so the transcript can be
   * persisted to `runs/<id>/debates/<task>.md`.
   */
  runId?: string;
}

export class CouncilOrchestrator {
  private log = new Logger('council');

  constructor(
    private sessions: SessionManager,
    private branches: BranchManager,
    private brainStore: BrainPersistence = defaultBrain
  ) {}

  /**
   * A task is eligible for debate mode when its risk is high or its blast
   * radius (files_affected) is large. The loop calls
   * `CouncilOrchestrator.shouldDebate(task)` to decide whether to pass
   * `useDebate: true`.
   */
  static shouldDebate(task: Task): boolean {
    if (task.risk === 'high') return true;
    if (task.files_affected >= 5) return true;
    const flagged = ['auth', 'payments', 'security', 'migration'];
    return task.tags.some((t) => flagged.includes(t.toLowerCase()));
  }

  async run(task: Task, context: string, opts: CouncilRunOpts = {}): Promise<SessionResult> {
    this.log.info(`council starting for ${task.id}${opts.useDebate ? ' (debate mode)' : ''}`);
    const started = Date.now();

    const agents = buildAgents();
    const sessions = await Promise.all(
      agents.map((a) =>
        this.sessions.create(
          a.engine,
          {
            projectDir: config.project.dir,
            model: a.model,
            systemPrompt: a.persona,
            allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
            maxTurns: a.engine === 'claude' ? 15 : 1,
          },
          `council-${task.id}-${a.name.toLowerCase()}`
        )
      )
    );
    const [architect, builder] = sessions;

    let totalTokens = 0;
    let totalCost = 0;
    let combinedText = '';

    try {
      // 1. Architect plan
      const planPrompt = `${context}\n\n---\n\nProduce the architecture plan.`;
      const planResult = await architect.send(planPrompt);
      combinedText += `\n=== ARCHITECT ===\n${planResult.text}\n`;
      totalTokens += planResult.tokens;
      totalCost += planResult.cost_usd;

      const consensus = /\[CONSENSUS:\s*YES\]/i.test(planResult.text);
      if (!consensus) {
        this.log.warn(`council ${task.id}: architect did not reach consensus, proceeding anyway`);
      }

      // 2. Builder implements
      const buildPrompt =
        `${context}\n\n---\n\n## Architect's Plan\n${planResult.text}\n\n` +
        `Implement the plan now.`;
      const buildResult = await builder.send(buildPrompt);
      combinedText += `\n=== BUILDER ===\n${buildResult.text}\n`;
      totalTokens += buildResult.tokens;
      totalCost += buildResult.cost_usd;

      // 3. Review — either single Reviewer (default) or full debate.
      if (opts.useDebate) {
        const debate = await this.runDebate(task, context, planResult.text, buildResult.text);
        combinedText += debate.transcript;
        totalTokens += debate.tokens;
        totalCost += debate.cost_usd;
        combinedText += `\n=== COUNCIL VERDICT ===\n${debate.verdict}\n`;

        if (opts.runId) {
          await this.brainStore
            .writeDebate(opts.runId, task.id, debate.transcript.trim())
            .catch((err) => this.log.warn('failed to persist debate transcript', err));
        }
      } else {
        const reviewer = sessions[2];
        const reviewPrompt =
          `${context}\n\n---\n\n## Architect's Plan\n${planResult.text.slice(0, 2000)}\n\n` +
          `## Builder's Output\n${buildResult.text.slice(0, 4000)}\n\n` +
          `Review the current git diff and the builder output. Respond with [APPROVE] or [REJECT].`;
        const reviewResult = await reviewer.send(reviewPrompt);
        combinedText += `\n=== REVIEWER ===\n${reviewResult.text}\n`;
        totalTokens += reviewResult.tokens;
        totalCost += reviewResult.cost_usd;

        const approved = /\[APPROVE\]/i.test(reviewResult.text);
        combinedText += `\n=== COUNCIL VERDICT ===\n${approved ? 'APPROVED' : 'REJECTED'}\n`;
      }
    } finally {
      for (const s of sessions) await this.sessions.destroy(s.id).catch(() => {});
    }

    return {
      text: combinedText,
      tokens: totalTokens,
      cost_usd: totalCost,
      duration_ms: Date.now() - started,
      events: [],
    };
  }

  /**
   * Two-round adversarial debate followed by a Judge verdict. Spawns its own
   * short-lived sessions so the Architect/Builder/Reviewer sessions from the
   * outer `run()` are not reused — the debaters must read the diff from
   * disk, not the other agents' tool-use histories.
   */
  private async runDebate(
    task: Task,
    context: string,
    architectPlan: string,
    builderOutput: string
  ): Promise<{ transcript: string; tokens: number; cost_usd: number; verdict: string }> {
    const diffSnippet = await this.collectDiff();

    const advocate = await this.sessions.create(
      'claude',
      {
        projectDir: config.project.dir,
        model: 'claude-sonnet-4-6',
        systemPrompt: DEBATE_ADVOCATE_SYSTEM,
        allowedTools: ['Read', 'Glob', 'Grep'],
        maxTurns: 3,
      },
      `debate-${task.id}-advocate`
    );
    const skeptic = await this.sessions.create(
      'claude',
      {
        projectDir: config.project.dir,
        model: 'claude-sonnet-4-6',
        systemPrompt: DEBATE_SKEPTIC_SYSTEM,
        allowedTools: ['Read', 'Glob', 'Grep'],
        maxTurns: 3,
      },
      `debate-${task.id}-skeptic`
    );
    const judge = await this.sessions.create(
      'claude',
      {
        projectDir: config.project.dir,
        model: 'claude-opus-4-6',
        systemPrompt: DEBATE_JUDGE_SYSTEM,
        allowedTools: ['Read', 'Glob', 'Grep'],
        maxTurns: 3,
      },
      `debate-${task.id}-judge`
    );

    let tokens = 0;
    let cost = 0;
    let transcript = '\n=== DEBATE ===\n';

    const sharedBrief =
      `${context.slice(0, 4000)}\n\n` +
      `## Architect's plan\n${architectPlan.slice(0, 1500)}\n\n` +
      `## Builder's output\n${builderOutput.slice(0, 3000)}\n\n` +
      `## Diff snippet\n${diffSnippet}\n\n`;

    try {
      // Round 1 — parallel, neither agent has seen the other yet.
      const [adv1, sk1] = await Promise.all([
        advocate.send(
          `${sharedBrief}Round 1: defend this change. Cite specific lines from the diff snippet.`
        ),
        skeptic.send(
          `${sharedBrief}Round 1: list your 3 strongest objections to merging, ranked S1/S2/S3. Cite specific lines from the diff snippet.`
        ),
      ]);
      tokens += adv1.tokens + sk1.tokens;
      cost += adv1.cost_usd + sk1.cost_usd;
      transcript += `\n--- Advocate (R1) ---\n${adv1.text}\n\n--- Skeptic (R1) ---\n${sk1.text}\n`;

      // Round 2 — each sees the other's round 1.
      const [adv2, sk2] = await Promise.all([
        advocate.send(
          `The Skeptic's round 1 objections:\n${sk1.text.slice(0, 3000)}\n\n` +
            `Round 2: rebut each objection or concede it (start bullet with "conceded:").`
        ),
        skeptic.send(
          `The Advocate's round 1 defense:\n${adv1.text.slice(0, 3000)}\n\n` +
            `Round 2: pick your single strongest remaining objection — the one most likely to block merge. Explain why the Advocate's defense does not cover it.`
        ),
      ]);
      tokens += adv2.tokens + sk2.tokens;
      cost += adv2.cost_usd + sk2.cost_usd;
      transcript += `\n--- Advocate (R2) ---\n${adv2.text}\n\n--- Skeptic (R2) ---\n${sk2.text}\n`;

      // Judge.
      const judgePrompt =
        `Task: ${task.title}\n` +
        `Risk: ${task.risk}, files: ${task.files_affected}\n\n` +
        `## Diff snippet\n${diffSnippet}\n\n` +
        `## Advocate R1\n${adv1.text}\n\n` +
        `## Skeptic R1\n${sk1.text}\n\n` +
        `## Advocate R2\n${adv2.text}\n\n` +
        `## Skeptic R2\n${sk2.text}\n\n` +
        `Render your verdict as specified.`;
      const verdict = await judge.send(judgePrompt);
      tokens += verdict.tokens;
      cost += verdict.cost_usd;
      transcript += `\n--- Judge ---\n${verdict.text}\n`;

      const verdictLine =
        (verdict.text.match(/^\[(APPROVE|REJECT:[^\]]*|REVISE:[^\]]*)\]\s*$/m) ??
          [null, 'UNPARSED — see transcript'])[0] ?? 'UNPARSED';

      return { transcript, tokens, cost_usd: cost, verdict: verdictLine };
    } finally {
      for (const s of [advocate, skeptic, judge]) {
        await this.sessions.destroy(s.id).catch(() => {});
      }
    }
  }

  /**
   * Collect a bounded diff snippet to feed the debaters. We cap at 8k chars
   * so the prompts stay well under the context limit even for large tasks.
   */
  private async collectDiff(): Promise<string> {
    const r = await this.branches.runShell('git diff HEAD~1..HEAD -U3 2>/dev/null || git diff --staged -U3 2>/dev/null || git diff -U3');
    const text = (r.stdout || '').trim() || '(no diff available)';
    const MAX = 8000;
    if (text.length <= MAX) return text;
    return text.slice(0, MAX) + '\n…(diff truncated at 8000 chars)…';
  }
}
