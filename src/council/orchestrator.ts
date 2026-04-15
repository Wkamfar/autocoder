import { SessionManager } from '../engines/session-manager.js';
import { BranchManager } from '../branch/manager.js';
import { SessionResult, Task, EngineName } from '../types.js';
import { config } from '../config.js';
import { Logger } from '../utils/logger.js';

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

export class CouncilOrchestrator {
  private log = new Logger('council');

  constructor(
    private sessions: SessionManager,
    private branches: BranchManager
  ) {}

  async run(task: Task, context: string): Promise<SessionResult> {
    this.log.info(`council starting for ${task.id}`);
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
    const [architect, builder, reviewer] = sessions;

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

      // 3. Reviewer
      const reviewPrompt =
        `${context}\n\n---\n\n## Architect's Plan\n${planResult.text.slice(0, 2000)}\n\n` +
        `## Builder's Output\n${buildResult.text.slice(0, 4000)}\n\n` +
        `Review the current git diff and the builder output. Respond with [APPROVE] or [REJECT].`;
      const reviewResult = await reviewer.send(reviewPrompt);
      combinedText += `\n=== REVIEWER ===\n${reviewResult.text}\n`;
      totalTokens += reviewResult.tokens;
      totalCost += reviewResult.cost_usd;

      const approved = /\[APPROVE\]/i.test(reviewResult.text);
      if (!approved) {
        combinedText += `\n=== COUNCIL VERDICT ===\nREJECTED\n`;
      } else {
        combinedText += `\n=== COUNCIL VERDICT ===\nAPPROVED\n`;
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
}
