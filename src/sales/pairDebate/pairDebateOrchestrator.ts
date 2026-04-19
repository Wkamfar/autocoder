import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { SessionManager } from '../../engines/session-manager.js';
import { config } from '../../config.js';
import { Logger } from '../../utils/logger.js';
import type { EngineName } from '../../types.js';
import type { DossierPack, PairDebateBlackboard, PairDebateRunResult, PairDebateTurnRecord } from './types.js';
import { emptyBlackboard, extractBlackboardJson, mergeBlackboard } from './blackboard.js';
import { seedFactsFromDossier } from './dossierBuilder.js';
import { runSynthesis } from './synthesize.js';
import { loadStrategyProfileSync } from '../intelligence/profileStorage.js';
import { formatAdaptiveCloserHints } from '../intelligence/adaptivePrompt.js';

const log = new Logger('pair-debate');

const CLOSER_SYSTEM = `You are the Closer in Pair Debate. Goal: maximize honest forward motion on the deal — craft the ask and the next move.
Rules:
- You MUST respond to BuyerMind's last turn when present — defend, revise, or concede; do not restart from scratch.
- Output markdown with sections ## Reasoning (short) then a fenced JSON block for the blackboard patch ONLY:
\`\`\`json
{ ... }
\`\`\`
The JSON must include all frozen fields you are updating (see schema in user message). Never delete open disagreement_register entries without status "resolved" and resolution_reason.
- Keep draft_email_v_next in the JSON when proposing email text.`;

const BUYER_SYSTEM = `You are BuyerMind. Simulate the buyer's internal resistance: procurement friction, politics, overload, reasons not to reply, silent rejection risk.
Rules:
- You MUST answer the Closer's last move — challenge assumptions, name risks, update missing_evidence.
- Output ## Reasoning then \`\`\`json ... \`\`\` blackboard patch with the same schema.
- Never agree for politeness. Preserve disagreement in disagreement_register.`;

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '\n…(truncated)';
}

function buildTurnPrompt(params: {
  dossier: DossierPack;
  blackboard: PairDebateBlackboard;
  transcript: string;
  role: 'closer' | 'buyer_mind';
  round: number;
  instruction: string;
}): string {
  const schema = `Blackboard JSON schema (all keys; arrays of strings; buyer_state_hypothesis string; disagreement_register array of { id, topic, closer_view, buyer_mind_view, status, resolution_reason? }):
facts_locked, hypotheses, open_questions, missing_evidence, risks, buyer_state_hypothesis, disagreement_register, recommended_next_move, draft_email_v_next`;

  return clip(
    [
      params.instruction,
      '',
      '# Dossier (truth layer)',
      params.dossier.body,
      '',
      '# Timing',
      `decision_deadline: ${params.dossier.timing.decision_deadline ?? 'null'}`,
      `timing_sensitivity: ${params.dossier.timing.timing_sensitivity}`,
      '',
      '# Current blackboard (full JSON — merge updates)',
      JSON.stringify(params.blackboard, null, 2),
      '',
      '# Transcript (prior turns)',
      params.transcript || '(none yet)',
      '',
      `# Round ${params.round} — ${params.role === 'closer' ? 'Closer' : 'BuyerMind'}`,
      '',
      '## Schema',
      schema,
    ].join('\n'),
    config.pairDebate.maxPromptChars
  );
}

async function appendJsonl(file: string, row: Record<string, unknown>): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, JSON.stringify(row) + '\n', 'utf8');
}

export async function runPairDebate(params: {
  dossier: DossierPack;
  sessions: SessionManager;
  options?: {
    maxRounds?: number;
    closerEngine?: EngineName;
    buyerEngine?: EngineName;
    closerModel?: string;
    buyerModel?: string;
  };
}): Promise<PairDebateRunResult> {
  const runId = randomUUID();
  const logDir = path.join(config.runtime.stateDir, 'pair-debate-runs');
  const jsonlPath = path.join(logDir, `${runId}.jsonl`);

  const maxRounds = params.options?.maxRounds ?? config.pairDebate.maxRounds;
  const closerEngine = params.options?.closerEngine ?? config.pairDebate.closerEngine;
  const buyerEngine = params.options?.buyerEngine ?? config.pairDebate.buyerEngine;
  const closerModel =
    params.options?.closerModel ||
    config.pairDebate.closerModel ||
    config.engines.claudeModel;
  const buyerModel =
    params.options?.buyerModel ||
    config.pairDebate.buyerModel ||
    (buyerEngine === 'codex' ? config.engines.codexModel : config.engines.claudeModel);

  let blackboard = emptyBlackboard(seedFactsFromDossier(params.dossier));
  const turns: PairDebateTurnRecord[] = [];
  let transcriptMd = '';
  let totalTokens = 0;
  let totalCost = 0;

  const profile = loadStrategyProfileSync();
  const adaptive = formatAdaptiveCloserHints(profile, {
    deal_stage: params.dossier.strategy_context?.deal_stage,
    deal_value_usd: params.dossier.strategy_context?.deal_value_usd,
  });
  const closerSystem = adaptive.trim() ? `${CLOSER_SYSTEM}\n\n${adaptive}` : CLOSER_SYSTEM;

  const closer = await params.sessions.create(
    closerEngine,
    {
      projectDir: config.project.dir,
      model: closerModel,
      maxTurns: 6,
      systemPrompt: closerSystem,
      allowedTools: ['Read'],
    },
    `pair-debate-closer-${runId}`
  );
  const buyer = await params.sessions.create(
    buyerEngine,
    {
      projectDir: config.project.dir,
      model: buyerModel,
      maxTurns: 6,
      systemPrompt: BUYER_SYSTEM,
      allowedTools: ['Read'],
    },
    `pair-debate-buyer-${runId}`
  );

  try {
    for (let round = 1; round <= maxRounds; round++) {
      const isCloserTurn = round % 2 === 1;
      const role = isCloserTurn ? 'closer' : 'buyer_mind';
      const instruction = isCloserTurn
        ? round === 1
          ? 'You open the debate: propose the best next move and blackboard updates.'
          : 'BuyerMind challenged your last move. Respond: revise, defend, or concede; update the blackboard.'
        : 'Challenge the Closer’s last move. Surface buyer-side risk and missing evidence.';

      const prompt = buildTurnPrompt({
        dossier: params.dossier,
        blackboard,
        transcript: transcriptMd,
        role,
        round,
        instruction,
      });

      const session = isCloserTurn ? closer : buyer;
      const started = Date.now();
      const result = await session.send(prompt);
      totalTokens += result.tokens;
      totalCost += result.cost_usd;

      const text = clip(result.text, config.pairDebate.maxResponseChars);
      const patch = extractBlackboardJson(text);
      blackboard = mergeBlackboard(blackboard, patch, role);

      const header = `### Round ${round} — ${isCloserTurn ? 'Closer' : 'BuyerMind'}\n\n`;
      transcriptMd += header + text + '\n\n';

      turns.push({
        round,
        role,
        raw_response: text,
        blackboard_after: JSON.parse(JSON.stringify(blackboard)) as PairDebateBlackboard,
      });

      await appendJsonl(jsonlPath, {
        ts: new Date().toISOString(),
        runId,
        round,
        role,
        duration_ms: Date.now() - started,
        tokens: result.tokens,
        cost_usd: result.cost_usd,
      });

      log.info(`round ${round} ${role} tokens=${result.tokens}`);
    }

    const synth = await runSynthesis({
      sessions: params.sessions,
      dossier: params.dossier,
      finalBlackboard: blackboard,
      transcriptMarkdown: transcriptMd,
      engine: config.pairDebate.synthesisEngine,
      model: config.pairDebate.synthesisModel || config.engines.claudeModel,
    });

    totalTokens += synth.tokens;
    totalCost += synth.cost_usd;

    await appendJsonl(jsonlPath, {
      ts: new Date().toISOString(),
      runId,
      event: 'synthesis',
      synthesis: synth.synthesis,
      raw_length: synth.raw.length,
    });

    return {
      run_id: runId,
      dossier: params.dossier,
      turns,
      final_blackboard: blackboard,
      synthesis: synth.synthesis,
      logPath: jsonlPath,
      total_cost_usd: totalCost,
      total_tokens: totalTokens,
    };
  } finally {
    await params.sessions.destroy(closer.id).catch(() => {});
    await params.sessions.destroy(buyer.id).catch(() => {});
  }
}
