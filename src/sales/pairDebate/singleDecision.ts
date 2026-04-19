import { SessionManager } from '../../engines/session-manager.js';
import { config } from '../../config.js';
import type { EngineName } from '../../types.js';
import type { DossierPack, FinalDebateSynthesis } from './types.js';
import { parseFinalSynthesisFromText } from './synthesize.js';

const SINGLE_SYSTEM = `You are one senior AE + strategist. No debate — produce a single careful recommendation.
Output ONLY valid JSON (no markdown fences) matching:
{
  "agreement": string[],
  "remaining_disagreements": string[],
  "recommended_single_next_step": string,
  "why_now": string,
  "what_could_go_wrong": string[],
  "human_decision_required": boolean,
  "draft_artifact": { "type": string, "content": string },
  "confidence": string (optional),
  "what_would_change_the_recommendation": string[] (optional)
}
Be explicit about uncertainty.`;

export async function runSingleDecisionModel(params: {
  dossier: DossierPack;
  sessions: SessionManager;
  engine?: EngineName;
  model?: string;
}): Promise<{ synthesis: FinalDebateSynthesis; raw: string; tokens: number; cost_usd: number }> {
  const engine = params.engine ?? 'claude';
  const model =
    params.model ?? (engine === 'claude' ? config.engines.claudeModel : config.engines.codexModel);

  const prompt = [
    '# Dossier',
    params.dossier.body.slice(0, config.pairDebate.maxPromptChars),
    '',
    '# Timing',
    `decision_deadline: ${params.dossier.timing.decision_deadline ?? 'null'}`,
    `timing_sensitivity: ${params.dossier.timing.timing_sensitivity}`,
    '',
    'Produce the JSON decision now.',
  ].join('\n');

  const session = await params.sessions.create(
    engine,
    {
      projectDir: config.project.dir,
      model,
      maxTurns: 3,
      systemPrompt: SINGLE_SYSTEM,
      allowedTools: ['Read'],
    },
    `single-decision-${Date.now()}`
  );

  try {
    const result = await session.send(prompt);
    return {
      synthesis: parseFinalSynthesisFromText(result.text),
      raw: result.text,
      tokens: result.tokens,
      cost_usd: result.cost_usd,
    };
  } finally {
    await params.sessions.destroy(session.id);
  }
}
