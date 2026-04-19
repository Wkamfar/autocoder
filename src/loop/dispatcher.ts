import { EngineName, ModelTier, SessionResult, Task, TaskDecision } from '../types.js';
import { SessionManager } from '../engines/session-manager.js';
import { config } from '../config.js';
import { Logger } from '../utils/logger.js';
import { modelFallback } from './model-fallback.js';
import { packageApproval } from '../safety/package-approval.js';

const AGENT_SYSTEM_PROMPT = `You are an autonomous coding agent inside the NightShift build loop.
You must operate with full autonomy on the current git branch.

Rules:
- Make the minimal set of edits needed for the task. Do not refactor unrelated code.
- Never modify .env files, credentials, or package lockfiles unless explicitly told.
- Prefer the smallest diff that makes the task pass its tests and lint.
- When you are done, print a final section titled "CHANGES" listing every file you modified and a one-sentence summary per file.
- Then print "DONE" on its own line.
`;

export class ExecutionDispatcher {
  private log = new Logger('dispatch');

  constructor(private sessions: SessionManager) {}

  async execute(
    decision: TaskDecision,
    context: string,
    overrides?: { tier?: ModelTier; projectDir?: string }
  ): Promise<SessionResult> {
    const { task, mode } = decision;
    if (mode === 'council') {
      throw new Error('council mode must be routed through CouncilOrchestrator');
    }

    // Intra-dispatch retry: if the first tier fails or hits a rate limit, try
    // the next available tier within the same call. This avoids bouncing the
    // task back to the queue just to have it re-picked by the loop.
    const maxAttempts = 3;
    let tier = overrides?.tier ?? modelFallback.getAvailable(decision.engine);
    let lastResult: SessionResult | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const engine = tier.engine;
      const sessionId = `task-${task.id}-${task.retry_count}-${attempt}`;

      let session;
      try {
        session = await this.sessions.create(
          engine,
          {
            projectDir: overrides?.projectDir ?? config.project.dir,
            model: tier.model,
            maxTurns: engine === 'claude' ? 25 : 1,
            systemPrompt: AGENT_SYSTEM_PROMPT + '\n\n' + packageApproval.guidancePrompt(),
            allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
          },
          sessionId
        );
      } catch (err) {
        // Engine disabled or binary missing → record failure and try next tier.
        modelFallback.recordFailure(tier, (err as Error).message);
        try {
          tier = modelFallback.getAvailable();
        } catch {
          throw err;
        }
        continue;
      }

      try {
        this.log.info(
          `dispatching ${task.id} to ${tier.label} (attempt ${attempt + 1}/${maxAttempts})`
        );
        const prompt = `${context}\n\n---\n\nBegin work now.`;
        const result = await session.send(prompt);

        if (modelFallback.detectRateLimit(result)) {
          result.rate_limited = true;
          modelFallback.recordFailure(tier, result.error ?? 'rate_limited');
          lastResult = result;
          try {
            tier = modelFallback.getAvailable();
          } catch {
            return result; // nowhere to fall back, return the rate-limited result
          }
          continue;
        }
        if (result.error) {
          modelFallback.recordFailure(tier, result.error);
          lastResult = result;
          try {
            tier = modelFallback.getAvailable();
          } catch {
            return result;
          }
          continue;
        }
        modelFallback.clear(tier);
        return result;
      } finally {
        await this.sessions.destroy(sessionId).catch(() => {});
      }
    }

    // All attempts exhausted — return the last failure so the loop can handle
    // retry counting and escalation.
    return (
      lastResult ?? {
        text: '',
        tokens: 0,
        cost_usd: 0,
        duration_ms: 0,
        events: [],
        error: 'all dispatch attempts exhausted',
        ok: false,
      }
    );
  }

  private modelFor(engine: EngineName): string {
    switch (engine) {
      case 'claude':
        return config.engines.claudeModel;
      case 'codex':
        return config.engines.codexModel;
      case 'cursor':
        return config.engines.cursorModel;
      case 'local':
        return config.engines.localModel;
      case 'gemini':
        return config.engines.geminiModel;
    }
  }

  extractPackageRequests(text: string): Array<{ manager: string; pkg: string; reason?: string }> {
    const re = /PACKAGE_REQUEST:\s*(\S+)\s+(\S+)(?:\s+(.*))?/g;
    const out: Array<{ manager: string; pkg: string; reason?: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out.push({ manager: m[1], pkg: m[2], reason: m[3]?.trim() });
    }
    return out;
  }

  extractChangedFiles(text: string): string[] {
    // Look for a CHANGES block followed by dashed bullets or lines with a path.
    const changesSection = /CHANGES[:\s]*([\s\S]*?)(?:DONE|$)/i.exec(text);
    if (!changesSection) return [];
    const body = changesSection[1];
    const paths: string[] = [];
    const lineRe = /(?:^|\n)\s*[-*]\s*(\S[^\s:]*\.[a-z0-9]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = lineRe.exec(body)) !== null) {
      paths.push(match[1]);
    }
    return [...new Set(paths)];
  }

  extractLearnings(text: string): string[] {
    const section = /LEARNINGS?[:\s]*([\s\S]*?)(?:DONE|$)/i.exec(text);
    if (!section) return [];
    return section[1]
      .split('\n')
      .map((l) => l.replace(/^\s*[-*]\s*/, '').trim())
      .filter((l) => l.length > 3);
  }
}
